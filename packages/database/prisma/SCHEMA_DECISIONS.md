# Database schema decisions

This document records invariants that Prisma's schema alone cannot fully enforce. Keep these rules in the service layer and cover them with integration tests; where noted, add PostgreSQL constraints in the initial migration.

## Monetary values

- Store monetary values in the smallest currency unit as BigInt (for example, cents where the currency uses cents).
- Never add amounts with different currencies. Every order and its item/fee/discount amounts must use the order's currency.
- Calculate OrderItem.lineTotalCents from the unit price, quantity, and any explicitly modeled item-level adjustments.
- Calculate Order.totalCents as subtotal + delivery fee + service fee + tax - discount. Recalculate on the server inside the order-creation transaction; never trust totals sent by a client.
- Validate all prices, fees, taxes, discounts, payment amounts, and line totals as non-negative, and require quantity to be greater than zero. Add PostgreSQL CHECK constraints for these rules in the initial migration.

## Order creation and lifecycle

- Create the order, its item snapshots, delivery-address snapshot, initial OrderStatusHistory row, and any initial payment record in a single database transaction.
- Validate every status transition against an explicit transition map. The enum lists allowed states; it does not itself validate transitions.
- Set placedAt when an order is successfully placed and deliveredAt only when it reaches DELIVERED.
- Record every status transition in OrderStatusHistory; do not rewrite or delete history during ordinary operations.
- Treat payment-provider callbacks as untrusted and idempotently process them using provider event/payment identifiers. Never mark an order paid based only on a browser redirect.

## Addresses and ownership

- Copy the delivery address into OrderDeliveryAddress at checkout. This snapshot is the source of truth for the historical order, even if the customer later edits or removes their saved address.
- If sourceAddressId is supplied, verify that the address belongs to the ordering user. The optional reference is only provenance, not the historical address itself.
- Customer addresses use Address.userId; branch addresses have no customer owner and are linked to a RestaurantBranch. Do not expose one user's saved addresses to another user.

## Menus and branch-specific availability

- Menu belongs to a restaurant; BranchMenu assigns a menu to a branch.
- Validate that the branch and menu belong to the same restaurant before creating a BranchMenu.
- Validate that each BranchMenuItem.menuItemId belongs to the menu assigned through its BranchMenu. A normal foreign key cannot enforce this cross-table invariant by itself.
- Effective item price/currency comes from the branch override when present, otherwise from the base menu item. Validate the effective price and currency before checkout.
- Check RestaurantBranch.isActive, RestaurantBranch.acceptsOrders, BranchMenu.isActive, and effective item availability before accepting an order.

## Identity and database operations

- Normalize email addresses (at minimum trim whitespace and lowercase) before writes. Keep uniqueness enforced by the database; consider a case-insensitive unique index if normalization cannot be guaranteed for every writer.
- Use soft deletion or restrictive deletion for business records referenced by orders. Historical order snapshots must not depend on a live menu item's existence.
- updatedAt is maintained by Prisma's @updatedAt behavior for Prisma writes; direct SQL writers must update it themselves or use database triggers.
- Generate and review the initial Prisma migration, add the CHECK constraints described above, then run migration and client-generation checks against PostgreSQL before merging.