# ADR 0011: Partner Web App and Branch URL Context

## Decision

Ship restaurant operations as a **separate Next.js app** (`apps/partner-web` on port **3002**), not as routes inside `customer-web`. Authenticated partner pages nest under:

```text
/r/[restaurantId]/b/[branchId]/…
```

Nav areas for the shell: **Orders · Menu · Hours/Availability · Branches · Team**.

## Why a second app

- Customer and partner UX, release cadence, and auth gating diverge quickly (discovery vs kitchen ops).
- Same monorepo / pnpm workspace keeps shared API contracts; splitting UIs avoids accidental customer chrome in ops screens.
- Cookie session auth stays on the Nest API (`credentials: 'include'`). CORS allows both `PUBLIC_WEB_URL` and `PARTNER_WEB_URL`.

## URL context

- Restaurant + branch IDs live in the path so deep links, refreshes, and future multi-tab ops stay unambiguous.
- Membership comes from `GET /restaurants/mine`; branches from `GET /restaurants/:id/branches`.
- A header switcher rewrites the path while preserving the current nav area.
- OWNER and STAFF share the same ops UI; owner-only mutations stay API-enforced (ADR 0003).

## Auth gate

- Login reuses `POST /auth/login` + session cookie.
- Partner shell requires `partner` on `GET /auth/me` capabilities (derived from an ACTIVE `RestaurantMembership`).
- Non-partners are logged out / redirected away from the dashboard.

## Team / STAFF invites (explicit non-goal for EAT-39)

- Prisma already models `RestaurantMembership` with `OWNER | STAFF`.
- There is **no** invite create/list/accept API yet.
- The Team page is a **functional stub** (“Invite STAFF (API TBD)”) until invite endpoints exist. Do not build a full IAM product in the shell.

## Consequences

- Local run: `pnpm --filter @food-delivery/partner-web dev` → http://localhost:3002
- Order queue UI is a later issue (EAT-40); Orders page only placeholders for now.
- Future invite APIs should wire into Team without changing the URL IA.
