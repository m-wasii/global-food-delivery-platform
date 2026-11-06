# ADR 0012: Partner Order Queue + Kitchen Timing from History

## Decision

Expose a **membership-gated partner order list** for the restaurant incoming queue, and **derive kitchen timing** from existing `OrderStatusHistory` rows — no new denormalized timestamp columns on `Order`.

Partner web shell / routing is owned by EAT-39 (separate ADR / app). This decision covers the API contract only.

## Partner list API (EAT-40 foundation)

| Piece | Choice |
| --- | --- |
| Path | `GET /partner/orders` |
| Auth | `SessionAuthGuard` + `RequirePartnerGuard`, then `assertActiveMember(userId, restaurantId)` |
| Filters | **Required** `restaurantId`; optional `branchId`, `status` (repeat or comma-separated), `page` / `pageSize` |
| Freshness | Client polls every **3–5s** (no SSE/WebSocket in M05) |
| Transitions | Unchanged: `POST /orders/:id/transition` and `GET /orders/:id` |

### New vs older (queue UX)

Each list item includes:

- `createdAt`, `status`, `updatedAt`
- `isNew` — `true` when `status === PENDING` (awaiting accept/reject)

Clients may further age-highlight using `createdAt`. Full queue UI is EAT-40 front-end work; this ADR only locks the API contract.

## Kitchen timing (EAT-44)

Timestamps are the **first** `OrderStatusHistory.createdAt` where `toStatus` matches:

| Field | `toStatus` |
| --- | --- |
| `pendingAt` | `PENDING` |
| `acceptedAt` | `CONFIRMED` |
| `preparingAt` | `PREPARING` |
| `readyAt` | `READY` |
| `completedAt` | `COMPLETED` |
| `cancelledAt` | `CANCELLED` |
| `rejectedAt` | `REJECTED` |

Implemented as pure helpers (`deriveKitchenTiming` / `orderTimingFields`) and attached as nullable ISO strings on:

- `GET /partner/orders` list items (queue wait ages)
- `GET /orders/:id` and transition responses (analytics / dispatch feed)

History rows remain the system of record; no denormalized columns on `Order`.

### Why not denormalize

- History is already append-only and authoritative (ADR 0008).
- Queue pages load a small page of orders; joining/including history is cheap.
- Avoids dual-write drift on every transition.

Revisit denormalized columns only if list latency or analytics volume becomes a measured problem.

## Consequences

- Partner-web polls `GET /partner/orders`; never sees another restaurant’s orders.
- Wrong `branchId` for the restaurant → `400`.
- Customer `GET /orders` remains unchanged.
