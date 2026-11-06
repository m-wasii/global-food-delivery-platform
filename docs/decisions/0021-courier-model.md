# ADR 0021: Courier Model (EAT-51)

## Decision

Represent couriers as a **`CourierProfile` capability row** on the shared `User` identity (same pattern as partner memberships / admin grants from EAT-20). Customers remain users without a courier profile; couriers are users **plus** a distinct courier record with vehicle, contact, and onboarding fields.

## Sources aligned

- [OTO Flex fleet management](https://docs.tryoto.com/modules/oto-flex/fleet-management) — separate **status** (employment) from **on duty** (shift); vehicle type feeds feasibility
- [Ondi driver model](https://docs-ondi.web.app/lastmile-delivery/driver) — one driver profile per user; primary vehicle + zones; status ≠ operation status
- [BetterTaxi driver status](https://bettersuite.io/docs/operators/taxi/onboard-drivers) — onboarding/approval workflow before a driver can go online
- Existing platform pattern: `User` + capability tables ([ADR 0002](./0002-authentication-model.md), EAT-20)

## Shape

| Piece | Role |
| --- | --- |
| `User` | Shared auth identity (email/password/sessions) |
| `CourierProfile` | Courier-specific record: capability status, phone, vehicle, home city, onboarding timestamps |
| `CourierVehicleType` | `BICYCLE` \| `SCOOTER` \| `MOTORCYCLE` \| `CAR` |
| `CapabilityStatus` | Reused: `PENDING` → `ACTIVE` → `SUSPENDED` (platform employment / approval) |
| `isCourierOnboardingComplete` | Pure check: phone + vehicle (+ license when motorized) + operating city |
| `isCourierDispatchEligible` | Pure check: `ACTIVE` + complete onboarding (live online gate: [ADR 0022](./0022-courier-availability.md)) |

Vehicle details live **on the profile** for v1 (one active vehicle). A separate fleet/`Vehicle` table is deferred.

## Status vs availability

| Concern | Owner | Notes |
| --- | --- | --- |
| Capability / employment | `CourierProfile.status` | Only `ACTIVE` grants courier capability (existing auth guards) |
| Online / offline | [ADR 0022](./0022-courier-availability.md) (EAT-52) | `isOnline`; ACTIVE courier may still be offline |
| Location | EAT-53 | Latest position separate from profile |

## Onboarding fields

- `phone` — courier contact (not on `User` today)
- `vehicleType`, optional `vehiclePlate`
- `licenseNumber` — required for scooter / motorcycle / car before onboarding is complete
- `operatingCityId` — home / preferred platform city (reuse `OperatingCity`)
- `submittedAt`, `activatedAt`, optional `reviewNotes`

Default status on create: `PENDING`. Activation sets `status = ACTIVE` and `activatedAt` (CRUD/admin flows land in later issues).

## Explicitly deferred

- Online/offline and offer eligibility gating → [ADR 0022](./0022-courier-availability.md) (EAT-52)
- Live location (EAT-53)
- Document/KYC uploads and expiry auto-suspend
- Multi-vehicle fleet assignment
- Courier payout / bank details
- HTTP courier onboarding CRUD (seed / ops insert for now)

## Consequences

- Auth capability resolution stays on `CourierProfile.status === ACTIVE`.
- Dispatch (EAT-55+) filters with `canCourierReceiveOffers` (eligibility + online) plus later location.
- Architecture domain “Courier & Delivery” references this ADR and ADR 0022.
