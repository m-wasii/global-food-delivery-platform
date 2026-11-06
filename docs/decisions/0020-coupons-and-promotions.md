# ADR 0020: Coupons and Promotions (EAT-50)

## Decision

Evaluate promotions with a **pure, deterministic** rule engine on the server. The client may propose a promo code; the server alone decides eligibility, discount amount, and whether redemption is still available. Never trust a client-supplied discount amount.

## Sources aligned

- [Stripe: Coupons vs promotion codes](https://docs.stripe.com/billing/subscriptions/coupons) — rule object (coupon) vs customer-facing code; `max_redemptions`, date windows, percent/amount off
- [Stripe Coupons API](https://docs.stripe.com/api/coupons) — percent_off / amount_off + currency, redeem_by, max_redemptions
- Industry practice: eligibility → discount calculation → atomic redemption inside the order transaction ([RAITHub promotions engine notes](https://www.raithub.com/blog/ecommerce-coupons-promotions-engine))

## Shape

| Piece | Role |
| --- | --- |
| `Promotion` | Durable rule: code, type (`PERCENT_OFF` \| `AMOUNT_OFF`), limits, window, optional restaurant scope |
| `evaluatePromotion` | Pure eligibility + discount from rule + cart context |
| `calculatePromotionDiscount` | Pure minor-unit discount (clamped to items subtotal) |
| `PromotionRedemption` | One row per successful checkout redeem; ties user + order + promotion |
| Atomic `redeemedCount` bump | Conditional update rejects overuse under concurrency |
| Checkout `promoCode` | Optional on preview/confirm; invalid/overused → `400` |

Discount feeds existing `priceCart({ discount })` ([ADR 0006](./0006-pricing-engine.md)). Settlement still uses `(itemsSubtotal - discount)` ([ADR 0019](./0019-fees-and-commission.md)).

## Explicitly deferred

- Stacking multiple promos on one order (exclusive single code)
- Free-shipping / buy-X-get-Y / product-scoped line discounts
- Promo admin HTTP CRUD (seed / ops insert for now)
- Reserve-then-confirm under flash-sale scale (Redis)

## Consequences

- Checkout preview and confirm call the same evaluation path.
- Confirm records a redemption inside the order create transaction (or rejects).
- ADR 0006 / 0019 “coupons deferred” notes are closed by this decision for order-level codes.
