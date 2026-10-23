# ADR 0003: Restaurant Onboarding Model

## Decision

Model the restaurant marketplace as **brand + branches**, with **membership-based ownership**, **dual operating status**, and **Foodpanda-style service coverage** (platform city + delivery radius), not freeform map polygons.

## Shape

| Concept | Role |
| --- | --- |
| `Restaurant` | Brand / legal partner entity. Owns menus (shared across branches). |
| `RestaurantBranch` | Operational unit customers order from. Has address, map pin, delivery radius, and status. |
| `RestaurantMembership` | Links a `User` to a `Restaurant` with role `OWNER` or `STAFF` and capability status. |
| `OperatingCity` | Platform-defined coverage city (e.g. Lahore). Branches must belong to an active city. |

A restaurant **must** support one or more branches. Orders always target a **branch**, never the brand alone.

## Ownership

- Creating a restaurant creates an `OWNER` membership for the creating user (implemented in EAT-24).
- **Owner** actions (create/edit restaurant, add branches, activate/deactivate brand or branches, manage memberships): require `RestaurantMembership` with `role = OWNER` and `status = ACTIVE` for that `restaurantId`.
- **Staff** actions (later ops flows): require `ACTIVE` membership for that restaurant; role rules are enforced per endpoint.
- `RequirePartnerGuard` only proves the user has *some* active membership. Per-restaurant checks use an ownership/membership helper keyed by `restaurantId`.
- Admins may activate/suspend restaurants outside membership rules.

Ownership is always enforced in the API, never only in the UI.

## Operating status

### Restaurant (`RestaurantStatus`)

| Status | Meaning |
| --- | --- |
| `PENDING` | Submitted; not yet platform-approved. Hidden from discovery. |
| `ACTIVE` | Approved to operate. Branches may go live. |
| `SUSPENDED` | Platform-blocked. All branches treated as unavailable for ordering. |

Default on create: `PENDING`.

### Branch (`BranchStatus`)

| Status | Meaning |
| --- | --- |
| `INACTIVE` | Configured or paused; not orderable. |
| `ACTIVE` | Orderable **only if** the parent restaurant is `ACTIVE`, the branch’s `OperatingCity` is `isActive`, and service-area fields are set. |

Default on create: `INACTIVE`.

Discovery and ordering (later issues) require:

`restaurant.status = ACTIVE` ∧ `branch.status = ACTIVE` ∧ `operatingCity.isActive` ∧ valid pin + radius.

Hours/item availability (EAT-29) layer on top of this; they do not replace status.

## Service area (Foodpanda-style)

- The **platform** chooses which cities are covered via `OperatingCity` (seed/admin). Partners do not draw custom Google polygons.
- Each branch stores:
  - `operatingCityId` — which platform city it serves under
  - `latitude` / `longitude` — delivery origin pin
  - `deliveryRadiusKm` — circular coverage from that pin
- A customer address is in range when it has coordinates and Haversine distance to the branch pin is `≤ deliveryRadiusKm`.
- City membership alone is not enough: the customer must also fall inside the branch radius.
- Richer geography (regions, zones, PostGIS) is deferred to Milestone 09 (`EAT-66`+).

## Menus

Menus remain **restaurant-scoped** (shared catalog). Per-branch item availability comes later (EAT-29 / EAT-43), not separate menus per branch in Milestone 03.

## Partner UI

Milestone 03 ships **partner APIs** and **customer discovery UI**. Restaurant dashboard shell stays Milestone 05 (`EAT-39`).

## Consequences

- Schema gains `OperatingCity`, restaurant/branch status enums, and branch geo/radius fields.
- EAT-24 implements CRUD against this model and enforces owner checks.
- EAT-26 discovery filters by city + status + radius.
- No Google Places polygon editor or partner-defined geo fences in v1.
