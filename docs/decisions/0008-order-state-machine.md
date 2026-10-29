# ADR 0008: Order State Machine

## Decision

Orders move through an explicit **finite state machine**. Invalid transitions are rejected. Every change (including creation) is appended to **`OrderStatusHistory`**.

## States (M04)

`PENDING → CONFIRMED → PREPARING → READY → COMPLETED`

Terminals: `CANCELLED`, `REJECTED` (from `PENDING`; `CANCELLED` also from `CONFIRMED` / `PREPARING`).

Courier/delivery states wait for Milestone 07.

## Enforcement

| Piece | Role |
| --- | --- |
| `order-transitions.ts` | Pure allow-list + actor capability matrix |
| `OrdersService.transition` | Authz + persist status + history row |
| Checkout | Creates `PENDING` and history `(null → PENDING, reason: created)` |

## Actor roles

| Role | May request |
| --- | --- |
| Customer (order owner) | `CANCELLED` |
| Partner (restaurant member) | `CONFIRMED`, `REJECTED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| Admin | Any status in the graph |

Cancellation *windows* and rich reasons stay EAT-38; accept/reject UX stays EAT-41 — both call this machine.

## Consequences

- Legacy `PLACED` is migrated to `CONFIRMED`.
- `GET /orders/:id` returns history + `allowedTransitions`; `POST /orders/:id/transition` applies a move.
