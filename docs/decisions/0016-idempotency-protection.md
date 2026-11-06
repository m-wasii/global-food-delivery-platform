# ADR 0016: Idempotency Protection

## Decision

Protect mutating checkout and payment operations with **Stripe-style idempotency keys**: store the first successful response for a `(scope, key)` pair and **replay** it on retries; reject key reuse when the request fingerprint differs; treat in-flight keys as conflict.

Builds on [ADR 0014](./0014-payment-abstraction.md) (`idempotencyKey` required on provider verbs) and closes the store/replay gap deferred from [ADR 0015](./0015-payment-state-machine.md).

## Sources aligned

- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — client key, ≤255 chars, ~24h retention, replay saved body, error on param mismatch
- [Stripe: Advanced error handling](https://docs.stripe.com/error-low-level) — `409` while in-flight; keep the same key on retries; new key only for a different operation
- Industry: one key **per logical operation**; fingerprint sorted JSON params so field order cannot false-conflict

## Shape

| Piece | Role |
| --- | --- |
| `hashIdempotencyRequest` / `decideIdempotency` | Pure fingerprint + execute / replay / conflict |
| `runWithIdempotency` | Begin → execute → complete; abandon on throw |
| `InMemoryIdempotencyStore` | Used by `NoopPaymentProvider` |
| `PrismaIdempotencyStore` / `IdempotencyRecord` | Durable store for API confirm (and later rails) |
| Checkout `Idempotency-Key` header | Required on `POST .../checkout`; scope `checkout.confirm:{userId}:{restaurantId}` |

## Explicitly deferred

- Automatic pruning job for expired rows (rows older than TTL are ignored and overwritten)
- Concurrent `409` wait/retry helper on clients
- Webhook delivery idempotency (provider adapters)

## Consequences

- Double-submit / network retry of confirm returns the **same order** payload without a second charge/order.
- Noop authorize/capture/cancel/refund replay matching keys; mismatch throws `IdempotencyConflictError`.
- Real PSPs still receive their own keys; this layer protects platform-side effects before/around the rail.
