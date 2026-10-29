# ADR 0005: Cart Model

## Decision

Persist carts in **PostgreSQL**, scoped to **restaurant (brand)** with a required **selected branch** for fulfillment. Customers may hold **multiple active carts** (one per restaurant). Empty carts are deleted. Per-branch catalog offering is **opt-in**.

## Shape

| Concept | Role |
| --- | --- |
| `Cart` | Mutable basket for `(userId, restaurantId)`. Always has `selectedBranchId`. |
| `CartItem` | Live `menuItemId` + `quantity` (+ optional notes). No price snapshot — orders snapshot later. |
| `UserRestaurantPreference` | Sticky favored branch per `(userId, restaurantId)`. Nearest covering branch on first open; remembered after. |
| `BranchMenuItemAvailability` | Opt-in offer at a branch. No row ⇒ not sold here. `isAvailable: false` ⇒ out of stock at this branch. |

## Rules

- Auth-only carts (no guest merge in M04).
- Cart exists iff it has ≥1 line; removing the last line deletes the cart.
- Switching `selectedBranchId` keeps lines; responses flag lines not offered / out of stock at the new branch (hard validation stays with later issues).
- Linear “one restaurant at a time” means **each cart** is single-restaurant, not a single global cart.

## Consequences

- Checkout (later) still creates an `Order` against `restaurantBranchId` (= cart’s selected branch).
- Discovery/menu UIs should resolve preferred branch on restaurant open (`GET …/preferred-branch`).
- Partners must opt menu items into each branch before those items can be added to a cart for that branch.
