/**
 * Invite-only STAFF onboarding.
 *
 * Status (EAT-39): API does not expose membership invite endpoints yet
 * (create/list/accept invite). RestaurantMembership exists in Prisma with
 * OWNER | STAFF roles, but only OWNER is created at restaurant onboard.
 *
 * TODO: When invite APIs land, wire this page to:
 * - list ACTIVE memberships for the restaurant
 * - create invite (email + STAFF role) — OWNER only (API-enforced)
 * - show pending invites / revoke
 *
 * Do not invent a full IAM product in the partner shell.
 */
export default function TeamPage() {
  return (
    <section>
      <h1>Team</h1>
      <p>
        Invite STAFF (API TBD). OWNER vs STAFF share the same ops UI; the API
        enforces owner-only actions.
      </p>
      <p>
        Membership model already supports <code>OWNER</code> / <code>STAFF</code>; invite
        create/accept endpoints are not implemented yet. See ADR 0011.
      </p>
    </section>
  );
}
