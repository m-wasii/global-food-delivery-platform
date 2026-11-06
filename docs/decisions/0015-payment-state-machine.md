# ADR 0015: Payment State Machine

## Decision

Persist payments as an explicit **finite state machine** linked 1:1 to an order. Invalid status transitions are rejected. Every change (including creation) is appended to **`PaymentStatusHistory`**. Order transitions that imply money movement must keep **order status and payment status consistent** — divergence throws; it is never silent.

Builds on [ADR 0014](./0014-payment-abstraction.md) status vocabulary and `PaymentProvider` verbs.

## Sources aligned

- [Stripe PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle) — `requires_action` → `processing` / `requires_capture` → `succeeded` / `canceled`; declines retry via a new attempt
- [Stripe auth-then-capture](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) — hold at checkout, capture when fulfillment commits, cancel releases hold
- Restaurant ordering practice: authorize estimate at checkout, capture after accept; void pre-capture cancels; refund post-capture ([Integrate Payments guide](https://www.integratepayments.com/article/restaurant-online-ordering-payment-integration-a-developers-guide))
- Industry FSM shape: monotonic money states + terminal fail/void; unmatched gateway vs ledger → surface for reconciliation, do not absorb ([Shipt / Throttle-style payment states](https://usethrottle.dev/docs/developers/reference/payment-states/))

## States (M06)

Same vocabulary as ADR 0014:

`REQUIRES_ACTION → PROCESSING → AUTHORIZED → CAPTURED → PARTIALLY_REFUNDED → REFUNDED`

Also: `FAILED`, `CANCELED` (terminals except **retry** from `FAILED` → `REQUIRES_ACTION` | `PROCESSING` | `AUTHORIZED` with `attemptCount++`).

| From | Allowed to |
| --- | --- |
| `REQUIRES_ACTION` | `PROCESSING`, `AUTHORIZED`, `FAILED`, `CANCELED` |
| `PROCESSING` | `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELED` |
| `AUTHORIZED` | `CAPTURED`, `CANCELED`, `FAILED` |
| `CAPTURED` | `PARTIALLY_REFUNDED`, `REFUNDED` |
| `PARTIALLY_REFUNDED` | `REFUNDED` |
| `REFUNDED` / `CANCELED` | ∅ |
| `FAILED` | `REQUIRES_ACTION`, `PROCESSING`, `AUTHORIZED` (retry) |

Partial-refund amount bumps that stay `PARTIALLY_REFUNDED` update amounts + history reason without a same-status graph edge (graph forbids `from === to`).

## Order ↔ payment consistency

| Order status | Allowed payment statuses |
| --- | --- |
| `PENDING` | `REQUIRES_ACTION`, `PROCESSING`, `AUTHORIZED` |
| `CONFIRMED` / `PREPARING` / `READY` | `CAPTURED` |
| `COMPLETED` | `CAPTURED`, `PARTIALLY_REFUNDED`, `REFUNDED` |
| `CANCELLED` | `CANCELED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| `REJECTED` | `CANCELED`, `FAILED` |

`assertOrderPaymentConsistent` runs whenever either side would move. Capture-on-accept and void-on-reject remain the intended coupling (callers in later issues); this ADR guarantees the invariant.

## Persistence

| Piece | Role |
| --- | --- |
| `Payment` | One current payment per order (`orderId` unique); provider ids; amounts; `attemptCount`; `reconciliationNeeded` |
| `PaymentStatusHistory` | Append-only `from → to` (+ optional reason / actor) |
| `payment-transitions.ts` | Pure allow-list |
| `order-payment-consistency.ts` | Pure order↔payment matrix |
| `PaymentsService` | Create / transition / apply provider snapshot; set `reconciliationNeeded` when provider snapshot ≠ local status |

## Explicitly deferred

- Webhook ingress / `parseWebhook` (refund path → **EAT-80**)
- Background reconciliation jobs / ledger
- Multi-payment instalments per order

Refund productization (records + rules): [ADR 0017](./0017-refund-records.md) (EAT-48).

## Consequences

- Checkout may create `Payment` after `PaymentProvider.authorize`; partner accept/reject must not leave order `CONFIRMED` with payment still `AUTHORIZED`, etc.
- `reconciliationNeeded` is a flag, not a status — keeps the money FSM clean while surfacing drift.
- Idempotency key store/replay: [ADR 0016](./0016-idempotency-protection.md) (EAT-47).
