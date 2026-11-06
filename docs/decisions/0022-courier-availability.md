# ADR 0022: Courier Availability (EAT-52)

## Decision

Model live courier availability as a **boolean `isOnline` on `CourierProfile`**, distinct from capability/`status`. Couriers toggle online/offline via authenticated HTTP; only **dispatch-eligible + online** couriers enter the offer pool (`canCourierReceiveOffers`).

## Sources aligned

- [OTO Flex fleet management](https://docs.tryoto.com/modules/oto-flex/fleet-management) — **Status** (employment) ≠ **On Duty**; Active + off duty receives nothing
- [Nash: How Fleet works](https://help.usenash.com/articles/9791053329-how-fleet-works) — availability is a simple on/off switch set by the driver; shifts are a separate planned window (deferred)
- [Ordering.tools own delivery](https://www.ordering.tools/en/tutorials/own-delivery-setup) — only Online drivers are offered for dispatch
- Existing split in [ADR 0021](./0021-courier-model.md)

## Shape

| Piece | Role |
| --- | --- |
| `CourierProfile.isOnline` | Live on-duty switch; default `false` |
| `CourierProfile.onlineChangedAt` | Last toggle timestamp |
| `canCourierGoOnline` | Pure: only `isCourierDispatchEligible` may flip online |
| `canCourierReceiveOffers` | Pure: dispatch-eligible **and** `isOnline` |
| `PUT /couriers/me/availability` | Courier sets `{ isOnline }`; rejects go-online when not eligible |
| `GET /couriers/me/availability` | Current `isOnline`, timestamps, offer-eligibility flags |

Going offline is always allowed for an ACTIVE courier (auth guard). Going online while PENDING/SUSPENDED/incomplete onboarding → `400`.

## Explicitly deferred

- Scheduled shifts / planned working windows
- Auto-offline on suspend or stale location (EAT-53+)
- Capacity / concurrent-order limits
- Admin override of courier online state
- Offer send / accept (EAT-56); dispatch scoring (EAT-55) consumes `canCourierReceiveOffers`

## Consequences

- Auth capability stays on `status === ACTIVE`; availability is orthogonal.
- Dispatch candidate filters must call `canCourierReceiveOffers` (or equivalent), not capability alone.
- Location (EAT-53) remains a separate filter on top of this gate.
