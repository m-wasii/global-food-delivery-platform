# ADR 0010: Cancellation Rules

## Decision

Customer cancellation is gated by the existing order state machine **plus** a fixed **time window** from `order.createdAt`. Cancel always goes through `POST /orders/:id/transition` with `toStatus: CANCELLED`.

## Rules (M04)

| Actor | States | Clock | Reason |
| --- | --- | --- | --- |
| Customer (owner) | `PENDING` / `CONFIRMED` / `PREPARING` | Must be within `CUSTOMER_CANCEL_WINDOW_MINUTES` (default **7**) | Required enum `cancelReason` (+ optional `reason` note) |
| Partner / admin | Same machine allow-list | No window | Same required `cancelReason` |

Enum codes: `CHANGED_MIND`, `WRONG_ITEMS`, `TOO_LONG`, `OTHER`.

History stores `CODE` or `CODE: note` in `OrderStatusHistory.reason`.

## Why

- State-only cancel was too loose after kitchen work starts; a short customer window matches “change of mind” without per-restaurant config yet.
- Enum reasons keep analytics clean; free text alone is noisy.
- Reusing the transition endpoint avoids a second cancel API beside EAT-35.

## Consequences

- `GET /orders/:id` omits `CANCELLED` from `allowedTransitions` for customers when the window is closed.
- Window length is env-configurable; per-restaurant windows stay a later change if needed.
