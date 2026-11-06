# ADR 0019: Fees and Commission Rules (EAT-49)

## Decision

Persist an **auditable marketplace settlement** on every order at create time, separate from the customer-facing pricing breakdown ([ADR 0006](./0006-pricing-engine.md) / [ADR 0009](./0009-order-creation-snapshots.md)).

| Layer | Owner | Fields |
| --- | --- | --- |
| Customer-facing fees | `priceCart` | `serviceFee`, `deliveryFee`, `tax`, `total` |
| Restaurant commission | `settleOrder` | `commission` on `(itemsSubtotal - discount)` |
| Platform revenue | `settleOrder` | `commission + serviceFee + deliveryFee` (tax excluded) |
| Restaurant net | `settleOrder` | `commissionBase - commission` |

All amounts remain integer **minor units**. Commission rate is **basis points** (`COMMISSION_RATE_BPS`, default `1500` = 15%).

## Sources aligned

- [Stripe Connect: application fees / marketplace monetization](https://docs.stripe.com/connect/marketplace/tasks/app-fees) — platform retains a fee; connected account receives the remainder
- [Stripe Connect: separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers) — food-delivery split pattern (restaurant vs platform; courier deferred)
- Industry audit practice: order-level commission base + rate + net payout lines (not blended statement totals)

## Shape

| Piece | Role |
| --- | --- |
| `settleOrder` | Pure settlement from priced inputs + rate |
| `planSettlementClawback` | Proportional clawback plan for refunds (books); PSP split instructions still deferred |
| `loadCommissionRateBps` | Env default; snapshotted onto the order so later rate changes cannot rewrite history |
| `Order` columns | `commissionBaseCents`, `commissionRateBps`, `commissionCents`, `restaurantNetCents`, `platformRevenueCents` |
| Order API `settlement` | Unit-agnostic mirror of those columns (alongside `pricing`) |

## Explicitly deferred

- Per-restaurant / tiered commission schedules
- Courier / driver payout split
- PSP marketplace split instructions on authorize/capture ([ADR 0014](./0014-payment-abstraction.md))
- Coupons (EAT-50) and tax jurisdictions (EAT-70)

## Consequences

- Checkout → `OrdersService.createFromCheckout` always freezes settlement with pricing.
- Refund flows may call `planSettlementClawback` against the snapshotted settlement; wiring into `RefundsService` stays additive.
- ADR 0017 / 0018 commission-clawback deferrals are closed at the **planning** layer by this decision.
