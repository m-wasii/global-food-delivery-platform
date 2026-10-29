# ADR 0007: Checkout Flow

## Decision

Checkout is a **two-step** API on the cart: **preview** (final pricing summary) then **confirm** (create order). Fulfillment is **`DELIVERY` or `PICKUP`**. Discovery already limits restaurants to those covering the browse pin for delivery; checkout **re-checks delivery radius only when the delivery address differs from that discovery address**.

## Shape

| Step | Endpoint | Behavior |
| --- | --- | --- |
| Preview | `POST /carts/:restaurantId/checkout/preview` | `assertValidForCheckout` + price; no mutation |
| Confirm | `POST /carts/:restaurantId/checkout` | Same gates; create `Order` (`PENDING`) with line snapshots; delete cart |

| Fulfillment | Address | Radius | Delivery fee |
| --- | --- | --- | --- |
| `DELIVERY` | Required (`deliveryAddressId` or user default) | Recheck unless `discoveryAddressId === deliveryAddressId` | From pricing defaults |
| `PICKUP` | None | Skipped | `0` |

## Consequences

- Order `deliveryAddressId` is nullable for pickup; `fulfillmentType` is stored on the order.
- Deeper order lifecycle (state machine, history) remains EAT-35+; immutable snapshot hardening may deepen in EAT-36.
- Customer web ships a minimal checkout page that shows the preview total then confirms.
