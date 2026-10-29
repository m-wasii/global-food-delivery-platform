# ADR 0004: Media Storage Abstraction

## Decision

Store restaurant and menu images as **`MediaAsset` rows**, referenced by foreign keys from business entities. Access storage through a **`MediaStorageProvider`** interface so the backend (external URL today, object storage later) can change without rewriting restaurant/menu code.

## Shape

| Piece | Role |
| --- | --- |
| `MediaAsset` | Canonical media record: `provider`, optional `storageKey`, `publicUrl`, optional mime/size, optional `uploadedByUserId` |
| `Restaurant.coverMediaId` | Optional cover image FK |
| `MenuItem.imageMediaId` | Optional item image FK |
| `MediaStorageProvider` | Nest injectable contract; default `ExternalUrlMediaStorageProvider` registers HTTPS URLs |

Business APIs never persist raw image URL strings on menu/restaurant rows. Clients create/register media first (or pass a URL to the media API), then attach the returned `mediaId`.

## Consequences

- Milestone 03 keeps a local/external-URL provider; S3/R2 can implement the same interface later.
- External URL registration accepts **HTTPS only**; new rows record `uploadedByUserId` (legacy migrated URLs may be null).
- Existing inline `MenuItem.imageUrl` values are migrated into `MediaAsset` rows during the schema migration.
- Discovery/detail responses expose `publicUrl` from the related asset, not a denormalized string on the item.
