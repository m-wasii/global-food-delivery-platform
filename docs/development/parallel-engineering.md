# Parallel Engineering Operating Model

**Status:** Proposed working agreement  
**Applies to:** Human engineers and coding agents working in this repository

## 1. Goal and architectural premise

The goal is to increase delivery throughput by allowing multiple contributors to make useful progress at the same time, without creating avoidable merge conflicts or weakening integration quality.

The platform is intentionally a **modular monolith first**. Parallel engineering does not require extracting microservices, introducing distributed infrastructure, or splitting the repository into separate deployables. It requires clear domain ownership, stable interfaces, bounded changes, and an integration path that does not force every contributor to wait for the previous contributor's entire feature.

The unit of planning should be an independently verifiable product or engineering outcome—not a chronological implementation step.

## 2. Organize work around bounded contexts

Use these as default ownership lanes. Assign every issue one primary lane and one human accountable owner. The accountable owner may delegate implementation to Cursor agents; being assigned in Linear does not mean that person must implement the code personally. A lane is an ownership boundary, not a separate deployment or a prohibition on cross-domain collaboration.

| Workstream | Primary responsibility | Typical ownership surfaces |
| --- | --- | --- |
| Marketplace & Customer Experience | Restaurant discovery, catalog, customer identity/address flows, cart, customer-facing journeys | `apps/customer-web/**`; customer-facing API work in restaurants, media, addresses, and cart |
| Restaurant & Partner Operations | Restaurant/branch operations, menu management, incoming orders, kitchen workflow, partner experience | `apps/partner-web/**`; partner-facing restaurant and order API work |
| Courier & Dispatch | Courier onboarding/profile, availability, location, candidate selection, offers, delivery lifecycle | `apps/api/src/couriers/**`; future dispatch/delivery modules and courier-facing surfaces |
| Commerce & Payments | Checkout rules, pricing, promotions, payments, refunds, commission, settlement | `apps/api/src/checkout/**`, `payments/**`, promotion/commerce modules and their tests |
| Platform & Integration | Cross-cutting architecture, authentication contracts, database/migration coordination, CI, observability, test infrastructure, integration | `packages/database/**`, `apps/api/src/common/**`, root configuration, CI and shared test infrastructure |

Keep work vertical where possible: a contributor should own the behavior, tests, and relevant UI/API changes for a bounded feature. Do not split backend and frontend into separate dependent tickets merely because they live in different folders. Split them only where the interface is stable enough for both sides to proceed independently.

The Platform & Integration lane enables the other lanes; it must not become the team that implements every shared-file change. Domain owners remain responsible for their domain's schema needs, tests, and integration readiness.


## 2A. Cursor-driven multi-agent execution

For this project, the human project owner remains accountable for priorities, product decisions, architecture approval, and final acceptance. Linear assignees represent that accountability; they are not a record of who is typing the code.

**Cursor is the primary engineering driver** for implementation. It should inspect the repository and relevant Linear issues, prepare bounded execution briefs, launch and coordinate parallel agents, monitor their changes, run integration checks, and report decisions or blockers that require human input.

Use this division of responsibility:

| Role | Responsibility |
| --- | --- |
| Human project owner | Priorities, scope trade-offs, architecture decisions, risk acceptance, review of material changes, final acceptance |
| Cursor driver | Converts approved issues into execution plans; selects agent boundaries; prepares briefs; starts isolated work; coordinates merges; runs integrated verification |
| Cursor implementation agents | Implement one bounded deliverable each, follow its brief, test their changes, report files changed, decisions, risks, and verification evidence |
| Linear | Tracks the accountable owner, workstream, status, dependencies, and acceptance criteria |
| GitHub | Holds isolated branches/PRs, review evidence, and the integrated source of truth |

### Delegation rules

- Keep the issue assigned to the human accountable owner unless responsibility genuinely transfers to another human.
- Cursor should create one execution brief per implementation agent. Each brief must state the goal, acceptance criteria, allowed/owned paths, paths that must not be edited, contracts, dependencies, test commands, branch/worktree, and hand-back format.
- Give every concurrent coding agent an isolated worktree and branch. Do not let agents concurrently edit the same working tree.
- Prefer disjoint file ownership. If two deliverables need the same shared file, have the Cursor driver define a short integration contract and designate one agent as the sole editor for that file.
- Agents should return implementation evidence, not just completion claims: commit/branch reference, files changed, tests run and results, migration impact, known limitations, and any follow-up required.
- Cursor integrates the work, resolves conflicts deliberately, runs cross-workstream checks, and updates Linear only after verifying the actual repository state.
- Escalate product ambiguity, material architecture changes, destructive data decisions, security-sensitive trade-offs, or failed integration that requires a scope decision to the human owner. Do not ask the human to approve routine implementation details already covered by the brief.
- Do not spawn agents merely to maximize agent count. Parallelize only when tasks have sufficiently independent ownership and interfaces; keep a single agent on tightly coupled work.

### Linear issue assignment versus agent execution

Linear is the planning and accountability layer, not the live agent scheduler. A single issue may be implemented by one Cursor agent or decomposed by the Cursor driver into a small set of parallel execution tasks. Create separate Linear child issues only when the sub-deliverables are independently meaningful, need separate progress/acceptance tracking, or require distinct ownership. Do not create a Linear ticket for every agent action or prompt.

The Cursor driver should maintain an execution map linking each active issue to its agent brief, branch/worktree, owned paths, and integration status. Keep this lightweight and current; do not turn it into a second project-management system.

## 3. Rebuild the roadmap as outcomes plus a dependency graph

Structure Linear planning (or the chosen issue tracker) as:

1. **Product outcome / milestone** — the capability users or operators will have.
2. **Workstream** — the bounded context that owns the deliverable.
3. **Deliverable issues** — independently testable changes that can be owned and merged.

Do not use a single numbered sequence as the implied execution order. A milestone may contain several workstreams that advance concurrently.

Create a dependency only when a real technical or product constraint prevents work from starting or being accepted. Examples of valid blockers include a required data contract that does not yet exist, a migration that must precede a query, or an authorization capability needed by an endpoint. Do not create dependencies because one issue appears earlier in a narrative roadmap, because two features will eventually integrate, or because a UI is expected to ship after an API.

Classify work in practical terms:

- **Independent:** can start and be verified now.
- **Contract-first:** needs a small interface/schema decision, after which implementation can proceed in parallel.
- **Integration-gated:** implementation can proceed using agreed contracts or fakes, but final end-to-end acceptance waits for a named integration point.
- **Blocked:** cannot make meaningful progress until a specific prerequisite is complete.

A parent issue should describe a coherent capability. Avoid turning every small implementation action into its own issue; add child issues only when they create independently ownable work.

## 4. Make interfaces the hand-off boundary

When two workstreams need to interact, agree on the interface before asking either side to wait for the other side's implementation.

For API-facing work, record the relevant request/response shape, validation rules, authorization requirements, error cases, pagination semantics, and state-transition behavior. Keep API documentation/OpenAPI and shared DTOs aligned with the implementation.

This enables parallel execution:

- The API owner can implement against the accepted contract.
- The web owner can build against a mock adapter or deterministic fixture matching that contract.
- Both sides add contract-level tests.
- A small integration task verifies the real implementation against the agreed behavior.

For domain-to-domain interactions, expose a narrow service interface or domain event and document ownership of the data. Avoid reaching into another module's persistence tables or private implementation details.

Do not wait for a complete backend feature before beginning frontend work when the contract can be agreed earlier. Do not let a mock become a second, unofficial specification: fixtures must be derived from the accepted contract and updated with it.

## 5. Protect the shared-file hotspots

The current repository has a few files where otherwise independent contributors can collide. Treat these as explicit coordination points:

### Prisma schema and migrations

The Prisma schema currently lives in one shared file: `packages/database/prisma/schema.prisma`. Multiple domain branches editing that file at once are likely to create merge conflicts and migration drift.

- Every issue that changes persistence must declare the models/enums/relations and migration it expects to touch.
- Prefer additive, domain-scoped schema changes. Avoid unrelated schema cleanup in a feature PR.
- Do not have two active branches edit the same model or migration at the same time. Coordinate schema changes through a short schema-contract decision and an integration owner.
- Keep migration creation and application in a deliberate merge order; never resolve a conflict by silently rewriting an already shared migration.
- Let domain contributors prepare their domain changes and tests in parallel against the agreed model shape; serialize only the genuinely shared schema/migration integration step.

As a separate enablement task, evaluate whether the pinned Prisma version and migration workflow support splitting the schema into domain-owned files. Do not combine that structural change with a product feature.

### Nest application registration

Each domain owns its Nest module, controllers, providers, and tests. Keep edits to `apps/api/src/app.module.ts` to a single integration owner or a short, coordinated integration batch. A domain PR should not also make unrelated edits to the root module.

### Root configuration and shared infrastructure

Changes to `package.json`, `pnpm-lock.yaml`, shared TypeScript/Jest/Vitest configuration, environment templates, CI workflows, and global middleware should be called out in the issue before implementation. Batch unrelated dependency/configuration changes rather than letting every workstream edit these files opportunistically.

## 6. Branch and pull-request workflow

- Use one issue, one owner, and one isolated branch/worktree per contributor.
- Branch from the current `main` branch. Prefer independent PRs over stacked PR chains.
- Stack PRs only when the dependent change genuinely cannot compile or be reviewed against a merged contract or stable interface. Record the exact prerequisite and keep the stack short.
- Keep PRs focused on one deliverable. A PR should make its own behavior understandable and testable.
- Merge completed, green, independently useful work promptly. Do not hold a finished PR for unrelated work in the same milestone.
- Use draft PRs for genuinely unfinished work, not as a long-lived substitute for a contract or task boundary.
- Avoid concurrent edits to the same files. When overlap is unavoidable, agree on the owner and merge order before coding.
- After merging, contributors rebase or update their remaining branches from `main`; do not build a long chain of branches on stale feature branches.

Suggested branch format: `feat/EAT-123-short-description` or `fix/EAT-123-short-description`.

## 7. Issue readiness and completion

An issue is **ready to start** when it states:

- The outcome and observable acceptance criteria.
- Its primary workstream and one directly responsible owner.
- The folders/modules it owns or expects to change.
- The API/domain contract it consumes or provides.
- Any schema, migration, or shared-file impact.
- Real blockers, plus work that can proceed in parallel.
- Required tests and the verification command(s).

An issue is **done** when:

- Its acceptance criteria are met and tests were written/updated using the repository's TDD workflow.
- Relevant package tests, typecheck, lint, and build checks pass.
- Database changes are covered by a migration and the migration has been exercised in the documented local/CI path.
- API or domain contracts and ADRs are updated when the change affects a cross-domain decision.
- The PR is integrated into `main`, not merely implemented on a long-lived branch.
- No undocumented follow-up or manual integration step is required for the accepted scope.

## 8. Integration and quality cadence

Keep `main` in a buildable, testable state. Integrate small completed changes continuously instead of waiting for an entire milestone to finish.

For parallel contributors, make the CI feedback loop fast and attributable. The current CI workflow runs typecheck, lint, test, and build as sequential steps in one job. Consider splitting independent checks into parallel jobs after shared dependency setup/caching, while retaining all required checks as merge gates. This is a separate platform improvement; do not weaken checks to make the queue appear faster.

Use a small number of explicit integration checkpoints per milestone:

1. **Contract checkpoint:** schemas/interfaces and ownership decisions are accepted.
2. **Implementation checkpoint:** each lane's independently testable deliverables are merged.
3. **End-to-end checkpoint:** the integrated user/operator journey is smoke-tested across the participating lanes.

These checkpoints coordinate integration; they are not reasons to serialize all implementation.

## 9. Example: parallelizing the next Courier & Dispatch slice

The existing courier ADRs already establish a useful seam:

- EAT-51 / ADR 0021 establishes the courier profile and onboarding eligibility model.
- EAT-52 / ADR 0022 establishes online/offline availability and the `canCourierReceiveOffers` gate.
- ADR 0021 identifies location as a separate subsequent concern (EAT-53).
- ADR 0022 identifies dispatch scoring (EAT-55) and offer send/accept (EAT-56) as later concerns.

A parallel plan can therefore be:

| Deliverable | Can begin when | Integration gate |
| --- | --- | --- |
| Courier location contract + ingestion/storage | Existing courier identity and city model are understood | Location freshness and query contract accepted |
| Dispatch candidate scoring rules | Define a pure input contract containing courier eligibility, online state, location, and order requirements; use fixtures initially | Replace fixtures with the location provider and validate candidate filtering |
| Offer lifecycle/state machine + API contract | Define order/offer states and idempotency/expiry semantics | Connect offer creation to selected candidates and live courier state |
| Courier/dispatch observability and smoke fixtures | Agree on lifecycle events and metrics | Verify the integrated dispatch/offer path |

This deliberately separates the pure dispatch logic and offer lifecycle from live location plumbing. Final dispatch acceptance remains gated on real location and candidate integration, but contributors do not need to wait idle for the entire preceding feature chain.

The exact issue boundaries and acceptance criteria should be reconciled with the current Linear backlog before tickets are moved or created.

## 10. Lightweight issue template

Use this structure for new or substantially rewritten issues:

```markdown
## Outcome
What becomes possible when this issue is done?

## Acceptance criteria
Observable behavior and failure cases.

## Primary workstream / owner
One lane and one directly responsible engineer or agent.

## Ownership boundary
Expected modules/folders; files explicitly shared with other work.

## Contract
Inputs, outputs, authorization, errors, events, and compatibility expectations.

## Data impact
Models, enums, relations, migration, and seed/fixture changes (or none).

## Parallelization
- Can start when:
- Can run in parallel with:
- Integration gate:
- True blockers:

## Verification
Tests, typecheck/lint/build commands, migration checks, and smoke path.
```

Keep the template lightweight: fill only the fields that materially affect implementation or coordination. The purpose is to make independence and integration visible, not to add administrative work.
