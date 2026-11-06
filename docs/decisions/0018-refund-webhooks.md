# ADR 0018: Refund Webhooks

## Decision

Normalize PSP refund settlement through **`PaymentProvider.parseWebhook`**, then apply the result with pure **`planRefundWebhookApply`** so `Refund.status` and payment amounts stay correct when the rail settles asynchronously (or fails after an optimistic succeed).

Closes the `parseWebhook` deferral for the refund path from [ADR 0014](./0014-payment-abstraction.md) / [ADR 0015](./0015-payment-state-machine.md) (EAT-80). Builds on [ADR 0017](./0017-refund-records.md) ledger rows.

## Sources aligned

- [Stripe event types](https://docs.stripe.com/api/events/types) — `refund.updated`, `refund.failed`; Refund object `status` (`pending` / `succeeded` / `failed` / `canceled`)
- [Stripe Refund object](https://docs.stripe.com/api/refunds/object) — `id` (`re_…`), `payment_intent`, `amount`, `failure_reason`; refunds can succeed and later fail
- [Stripe refund webhook changelog](https://docs.stripe.com/changelog/acacia/2024-10-28/refund-webhook-update) — listen to refund.* for all refund types
- [Adyen Refund](https://docs.adyen.com/online-payments/refund) — async outcome via Standard webhooks `REFUND` / `REFUND_FAILED` (`success` true/false on `REFUND`); `pspReference` is the refund id, `originalReference` the payment

## Shape

| Piece | Role |
| --- | --- |
| `NormalizedRefundWebhook` | Provider-neutral refund settlement event |
| `parseStripeRefundWebhook` / `parseAdyenRefundWebhook` / `parseNoopRefundWebhook` | Pure payload → event (real adapters call their parser from `parseWebhook`) |
| `PaymentProvider.parseWebhook` | Port method; `NoopPaymentProvider` uses the noop envelope |
| `planRefundWebhookApply` | Idempotent status flip + amount bump/reverse |
| Payment FSM unwind | `REFUNDED` → `PARTIALLY_REFUNDED` \| `CAPTURED`; `PARTIALLY_REFUNDED` → `CAPTURED` on failure |
| `RefundsService.applyProviderWebhook` | parse → find Refund by `providerRefundId` → apply plan; marks `reconciliationNeeded` on plan failure |
| `POST /payments/webhooks` | Thin ingress (signature verification deferred with real rails) |

### Amount accounting

Refund amounts are counted on the payment **only while the refund row is `SUCCEEDED`**:

| Transition | Payment `refundedAmountCents` |
| --- | --- |
| `PENDING` → `SUCCEEDED` | += refund amount |
| `SUCCEEDED` → `FAILED` | -= refund amount |
| `PENDING` → `FAILED` | unchanged |
| Same status (duplicate delivery) | no-op |

## Explicitly deferred

- Webhook signature verification (Stripe `Stripe-Signature` / Adyen HMAC)
- Non-refund payment webhook kinds (auth/capture/cancel ingress)
- `REFUNDED_REVERSED` / charge.dispute coupling
- Marketplace split clawback → **EAT-49**

## Consequences

- Duplicate PSP deliveries are safe: matching status short-circuits before amount mutation.
- Failed refunds cannot leave captured money marked refunded; unwind transitions are first-class in the payment FSM.
- Broader payment webhook ingress can share `parseWebhook` + `POST /payments/webhooks` without a second adapter.
