# ADR 0002: Authentication Model (Server Sessions)

## Decision

Use **email/password authentication** with **server-side sessions** and **email verification before login**.

- The NestJS API owns identity and sessions.
- **Register** creates an unverified `User` and sends a verification email. It does **not** create a session.
- The user must **verify email**, then **log in** to get a session.
- After login, the API creates a session row in Postgres and sets an **opaque session id** in an **httpOnly** cookie.
- Authenticated requests resolve the cookie → session → `User`.
- Logout deletes or invalidates the session row so the cookie no longer grants access.
- A **Remember me** control on **login only** chooses session persistence: checked keeps the user signed in across browser restarts; unchecked issues a short-lived session for this visit only.
- Roles (Customer, RestaurantUser, Courier, Admin) are enforced later (EAT-20); this ADR only defines how identity is established.

## Rationale

- EAT-19 requires logout to invalidate the active session. Server sessions make revoke immediate and obvious.
- The platform is a modular monolith with Postgres already in place; a `Session` table fits that stack.
- Next.js is a browser client of the API, not the source of truth for auth.
- Requiring verification before login reduces fake/typo accounts and keeps “login” as the single place sessions are issued.
- Password registration (EAT-18) needs a local credential store; OAuth can be added later without changing the session model.

## Identity rules

- One `User` per unique email (case-normalized on write/lookup).
- Passwords are hashed with a modern password hash (e.g. Argon2id or bcrypt); never stored or logged in plaintext.
- Each user has verification state (e.g. `emailVerifiedAt: DateTime?`). `null` means unverified.
- Login is rejected until the email is verified.
- The session cookie value is an opaque random secret. Persist only a **hash** of that secret in the database so a DB leak does not yield usable session tokens.
- Cookie flags: `HttpOnly`, `Secure` in production, `SameSite=Lax` (tighten to `Strict` if cross-site posting is never required).
- Unauthenticated calls to protected routes receive `401`. Authorization by role is out of scope here.

## Auth flows

### Remember me

- UI: checkbox (or equivalent) on **login**, default **unchecked**. Not shown on register (register never issues a session).
- Client sends `rememberMe: boolean` with login credentials.
- **Checked** — create a **persistent** session and cookie (`Max-Age` / `Expires` aligned with session TTL). On the next visit the cookie is still present, so the user is already authenticated.
- **Unchecked** — create a **short-lived** session. Prefer a **browser session cookie** (no `Max-Age`) so closing the browser ends the client half of the session; the server row still expires on its short TTL for cleanup.
- Remember me only affects **duration / cookie persistence**. It does not change password verification or which user is authenticated.

### Register (customer)

1. Client submits email, password, and display name.
2. API validates input, rejects duplicate email, hashes the password, creates `User` with `emailVerifiedAt = null`.
3. API creates a single-use verification token (store only a **hash**; set a short expiry, e.g. **24 hours**) and sends an email with a verification link.
4. API does **not** create a session or set a cookie. Response directs the client to check email / proceed to login after verifying.

### Verify email

1. User opens the link (token in query or path).
2. API looks up the token hash, rejects if missing, used, or expired.
3. API sets `emailVerifiedAt`, invalidates the token, and returns success.
4. Client sends the user to the **login** screen (still no session until they log in).

Resend verification: allowed for unverified accounts, rate-limited; previous unused tokens for that user are invalidated when a new one is issued.

### Login

1. Client submits email, password, and `rememberMe`.
2. API verifies the password hash.
3. If the email is not verified, reject login (e.g. `403` with a clear “verify your email” message; do not create a session).
4. API creates a `Session` (user id, hashed token, created/expires timestamps, optional `rememberMe` flag).
5. API sets the session cookie with persistence matching **Remember me** and returns a minimal user payload (no password fields).

### Authenticated request

1. Client sends the cookie on API requests (`credentials: 'include'` from the web app).
2. Auth guard loads the session by hashed cookie value, checks expiry and revocation.
3. Request context receives the authenticated `User` (and later, roles).

### Logout

1. Client calls logout.
2. API invalidates the current session (delete row or set `revokedAt`).
3. API clears the cookie.

## Session lifecycle

| Event | Behavior |
| --- | --- |
| Create | On successful **login** only (after email is verified). Never on register or verify-email. |
| Absolute expiry (Remember me **on**) | Persistent session dies after a fixed max age (recommended default: **30 days**). Cookie uses matching `Max-Age`. |
| Absolute expiry (Remember me **off**) | Short-lived session (recommended default: **24 hours** server-side). Cookie is a browser session cookie (no `Max-Age`) when possible. |
| Idle / sliding | Not required for v1. If added later, sliding must never exceed the absolute max for that session’s remember-me class. |
| Logout | Invalidate this session immediately and clear the cookie. |
| Password change (future) | Invalidate all sessions for that user, or all except the current one — decide at implementation time. |
| Stolen cookie | Until expiry/logout, the thief has the session. Mitigate with TTLs, `Secure`/`HttpOnly`, and HTTPS. Prefer shorter TTL when Remember me is off. |

No JWT access tokens in v1. The cookie is not a signed claim set; it is a pointer to server state.

## Out of scope (for now)

- OAuth / “Sign in with …” (may land later; still create/link `User` and issue the same session after any provider-specific verification rules).
- JWT access/refresh tokens.
- Managed auth providers (Clerk, Auth0, etc.).
- Role checks and permission matrices (EAT-20).
- Password reset (follow-up; can reuse the same hashed one-time token pattern as email verification).

## Consequences

- EAT-18 implements registration, password hashing, verification token + email send, and verify/resend endpoints against these identity rules.
- EAT-19 implements login (including unverified rejection), logout, session persistence, Remember me, cookie handling, and auth guards.
- EAT-20 attaches roles to the authenticated user without changing the session mechanism.
- Local/dev needs a mail strategy (Ethereal, Mailhog, or logged link) so verification is testable without real SMTP.
- Cross-origin local/dev setup must allow credentials (correct API/web origins and CORS).
- Horizontal scaling stays simple: any API instance reads the same session store in Postgres.
