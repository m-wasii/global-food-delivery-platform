/**
 * Invite-only STAFF onboarding.
 *
 * Status (EAT-39): API does not expose membership invite endpoints yet.
 * RestaurantMembership exists in Prisma with OWNER | STAFF; only OWNER is
 * created at restaurant onboard. See ADR 0011.
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
        Membership model already supports <code>OWNER</code> / <code>STAFF</code>;
        invite create/accept endpoints are not implemented yet.
      </p>
    </section>
  );
}
