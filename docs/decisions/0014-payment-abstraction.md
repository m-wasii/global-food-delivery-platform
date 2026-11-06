# ADR 0014: Payment Abstraction

## Decision

Talk to payment rails through a **`PaymentProvider`** Nest injectable so order/checkout logic never imports a vendor SDK. Verbs follow current PSP norms (Stripe PaymentIntents manual capture + Adyen Checkout modifications): **authorize**, **capture**, **cancel**, **refund**, **getStatus**. Default local implementation is **`NoopPaymentProvider`** (in-memory).

## Sources aligned

- [Stripe: place a hold / manual capture](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) — auth then capture; partial capture releases remainder; cancel releases hold
- [Stripe: PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle) — `requires_action`, `processing`, `requires_capture`, `succeeded`, `canceled`
- [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests) — idempotency key on every mutating POST
- [Adyen Checkout modifications](https://docs.adyen.com/api-explorer/Checkout/latest/overview) — captures / cancels / refunds
- Industry: one key **per operation** (not per payment); amounts in minor units + ISO 4217

## Shape

| Piece | Role |
| --- | --- |
| `PaymentProvider` | Port: `authorize` / `capture` / `cancel` / `refund` / `getStatus` / `parseWebhook` |
| `PAYMENT_PROVIDER` | DI token; swap Stripe/Adyen/regional without rewriting callers |
| `PaymentSnapshot` | `provider`, `providerPaymentId`, `status`, `amountCents`, `amountCapturableCents`, `amountReceivedCents`, `refundedAmountCents` |
| `NoopPaymentProvider` | In-memory baseline (`provider = "noop"`) |
| Amounts | Integer **minor units** + ISO 4217 currency |
| Idempotency | `idempotencyKey` **required** on authorize/capture/cancel/refund; store/replay in [ADR 0016](./0016-idempotency-protection.md) |

### Status vocabulary

| Domain | Typical PSP mapping |
| --- | --- |
| `REQUIRES_ACTION` | Stripe `requires_action` (SCA / 3DS) |
| `PROCESSING` | Async method / capture in flight |
| `AUTHORIZED` | Stripe `requires_capture` / Adyen Authorised |
| `CAPTURED` | Stripe `succeeded` / Adyen Captured |
| `PARTIALLY_REFUNDED` / `REFUNDED` | Refund ladder |
| `FAILED` / `CANCELED` | Decline or voided auth |

Auth-then-capture matches food delivery (hold at checkout, capture when the kitchen commits; cancel/void if rejected). Full persistence and order↔payment coupling: [ADR 0015](./0015-payment-state-machine.md) (EAT-46).

## Explicitly deferred

- Non-refund payment webhook kinds (auth/capture/cancel); refund path closed in [ADR 0018](./0018-refund-webhooks.md) (**EAT-80**)
- Client secrets / SCA challenge UI
- Marketplace split instructions (Adyen for Platforms)
- Payment method tokens / saved cards
- Append-only ledger + reconciliation jobs

## Consequences

- Checkout/orders inject `PAYMENT_PROVIDER`, never a concrete rail.
- `Payment` Prisma model + FSM: [ADR 0015](./0015-payment-state-machine.md).
- Milestone 06 can add real providers behind the same token without touching order transition code.
