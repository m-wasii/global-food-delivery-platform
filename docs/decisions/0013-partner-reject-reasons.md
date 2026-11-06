# ADR 0013: Partner Reject Reason Codes

## Decision

Partner rejection of an incoming order (`PENDING → REJECTED`) goes through the existing `POST /orders/:id/transition` endpoint. Reject requires a structured **`rejectReason`** enum; an optional free-text **`reason`** note may be appended (same pattern as cancel in [ADR 0010](./0010-cancellation-rules.md)).

## Rules (M05)

| Actor | From | To | Reason |
| --- | --- | --- | --- |
| Partner (restaurant member) / admin | `PENDING` | `REJECTED` | Required enum `rejectReason` (+ optional `reason` note) |

Enum codes: `OUT_OF_STOCK`, `TOO_BUSY`, `CLOSING_SOON`, `OTHER`.

History stores `CODE` or `CODE: note` in `OrderStatusHistory.reason`.

Accept (`PENDING → CONFIRMED`) needs no reason code.

## Why

- Enum reasons keep ops analytics clean; free text alone is noisy.
- Reusing the transition endpoint avoids a parallel reject API beside the state machine ([ADR 0008](./0008-order-state-machine.md)).
- Mirroring cancel keeps the DTO / history contract consistent for clients.

## Consequences

- `TransitionOrderDto` validates `rejectReason` when `toStatus` is `REJECTED` (and `cancelReason` when `CANCELLED`).
- Partner-web Accept/Reject UX (EAT-41) calls the same transition route with credentials.
