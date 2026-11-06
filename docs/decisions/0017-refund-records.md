# ADR 0017: Refund Records

## Decision

Persist each refund as its own **`Refund`** row, always FK'd to both **`paymentId`** and **`orderId`**, with pure **`planRefund`** rules for full/partial amounts. Issuing a refund calls `PaymentProvider.refund`, appends a ledger row, then bumps the payment FSM (`CAPTURED` → `PARTIALLY_REFUNDED` → `REFUNDED`). Further partials that stay `PARTIALLY_REFUNDED` still write history without a same-status graph edge ([ADR 0015](./0015-payment-state-machine.md)).

Closes the “Refund API productization” deferral from ADR 0015 (EAT-48).

## Sources aligned

- [Stripe Refunds](https://docs.stripe.com/refunds) / [Create a refund](https://docs.stripe.com/api/refunds/create) — separate Refund object linked to PaymentIntent/charge; multiple partials until the captured remainder is exhausted; cannot refund more than charged; cancel uncaptured auths instead of refunding; HTTP `POST /v1/refunds` with `payment_intent` + optional `amount`
- [Stripe Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — `Idempotency-Key` header (≤255) on mutating POSTs; replay first response; conflict on param mismatch
- [Adyen Refund](https://docs.adyen.com/online-payments/refund) — refund only after capture; full/partial; sum of partials ≤ captured amount; async outcome via webhooks
- Industry: server-side remaining balance; never accept a free-floating provider payment id from the client; idempotency key per refund operation ([ADR 0016](./0016-idempotency-protection.md))
- NestJS: thin controllers + DTO validation + `@ApiHeader` for documented required headers

## Shape

| Piece | Role |
| --- | --- |
| `planRefund` / `refundableRemainingCents` | Pure caps + next payment status + order↔money consistency |
| `createRefundDraft` | Forces `paymentId` + `orderId` on every persistable row |
| `Refund` / `RefundStatus` | Append-only ledger (`PENDING` / `SUCCEEDED` / `FAILED`) |
| `RefundsService.issue` | Provider refund → Refund row → Payment amounts/status + history; platform `Idempotency-Key` store/replay |
| `POST /payments/:paymentId/refunds` | Thin Nest controller (EAT-79); authenticated; required `Idempotency-Key`; body returns refund linked to order + payment |
| `listForOrder` / `listForPayment` | Traceability queries for ops / customer history |

## Explicitly deferred (owned)

- Partner / customer refund UI surfaces (HTTP API shipped in EAT-79)
- Async webhook flips → closed in [ADR 0018](./0018-refund-webhooks.md) (**EAT-80**)
- Marketplace split / commission clawback planning → [ADR 0019](./0019-fees-and-commission.md) (`planSettlementClawback`); PSP transfer clawback still deferred with ADR 0014
- Automatic order cancellation coupling

## Consequences

- Acceptance (“traceable to an order and payment”) is a schema invariant, not a display convenience.
- Kitchen-active orders (`CONFIRMED` / `PREPARING` / `READY`) still cannot move money to refund statuses — complete or cancel the order first (ADR 0015 matrix).
- Noop synthesizes `providerRefundId` as `{providerPaymentId}:r:{cumulativeRefunded}`; real rails will store `re_…` / pspReference later.
