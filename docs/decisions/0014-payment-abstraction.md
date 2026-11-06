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
| `PaymentProvider` | Port: `authorize` / `capture` / `cancel` / `refund` / `getStatus` |
| `PAYMENT_PROVIDER` | DI token; swap Stripe/Adyen/regional without rewriting callers |
| `PaymentSnapshot` | `provider`, `providerPaymentId`, `status`, `amountCents`, `amountCapturableCents`, `amountReceivedCents`, `refundedAmountCents` |
| `NoopPaymentProvider` | In-memory baseline (`provider = "noop"`) |
| Amounts | Integer **minor units** + ISO 4217 currency |
| Idempotency | `idempotencyKey` **required** on authorize/capture/cancel/refund (store/replay = EAT-47) |

### Status vocabulary

| Domain | Typical PSP mapping |
| --- | --- |
| `REQUIRES_ACTION` | Stripe `requires_action` (SCA / 3DS) |
| `PROCESSING` | Async method / capture in flight |
| `AUTHORIZED` | Stripe `requires_capture` / Adyen Authorised |
| `CAPTURED` | Stripe `succeeded` / Adyen Captured |
| `PARTIALLY_REFUNDED` / `REFUNDED` | Refund ladder |
| `FAILED` / `CANCELED` | Decline or voided auth |

Auth-then-capture matches food delivery (hold at checkout, capture when the kitchen commits; cancel/void if rejected). Full persistence and order↔payment coupling land in **EAT-46**.

## Explicitly deferred

- Webhook normalization / `parseWebhook` (provider adapters later)
- Client secrets / SCA challenge UI
- Marketplace split instructions (Adyen for Platforms)
- Payment method tokens / saved cards
- Append-only ledger + reconciliation jobs

## Consequences

- Checkout/orders inject `PAYMENT_PROVIDER`, never a concrete rail.
- No `Payment` Prisma model in this ADR — state machine + reconciliation is EAT-46.
- Milestone 06 can add real providers behind the same token without touching order transition code.
