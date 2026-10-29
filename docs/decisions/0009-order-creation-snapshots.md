# ADR 0009: Order Creation Snapshots

## Decision

Order creation is owned by **`OrdersService.createFromCheckout`**. Checkout validates and prices, then delegates persistence. Everything shown on a historical order is **copied at create time** so later menu/address/branch edits cannot rewrite the past.

## Snapshots

| Data | Storage |
| --- | --- |
| Line name, unit price, qty, line total | `OrderItem` columns |
| Optional `menuItemId` | Soft FK (`onDelete: SetNull`) for analytics only |
| Restaurant / branch display names | `Order.restaurantName`, `Order.branchName` |
| Delivery address (delivery only) | Columns on `Order` (+ optional live `deliveryAddressId`) |
| Pricing breakdown | `itemsSubtotalCents`, fees, tax, `totalCents`, `taxRateBps` |

Builders live in `order-creation.ts` (pure) so immutability can be unit-tested without the DB.

## Consequences

- Checkout no longer inserts orders directly.
- EAT-37 history UI should read snapshot fields, not join live menu/address rows for display.
