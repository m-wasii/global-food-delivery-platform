# EatWave parallel engineering execution

The live execution tracker is the [EatWave Linear project](https://linear.app/eatwave/project/global-food-delivery-platform-a9b245134626). The [Parallel Engineering Operating Model](https://linear.app/eatwave/document/eatwave-parallel-engineering-operating-model-d65c7862be00) defines workstreams, current issue scope, dependencies and shared ownership. This repository guide defines the implementation rules Cursor and contributors must follow.

## Execution model

- Existing milestones 01–10 remain capability outcomes, not a sequential engineering queue.
- Work is organized into bounded work packages across Courier & Delivery, Reliability & Platform, Global Platform, AI & Intelligence, and Architecture & Integration.
- Cursor is the coordinating driver. It prepares independent execution briefs, assigns isolated writers, tracks handoffs, reviews evidence and coordinates integration.
- Linear remains the only execution/status tracker. Do not create a duplicate GitHub Projects board or mirror every agent assignment into new tickets.
- Start with no more than three concurrent write agents. Read-only discovery and review can run in parallel.
- A task is parallel-ready only when allowed paths, owner, dependencies, stable interfaces and acceptance checks are explicit.

## Shared ownership boundaries

The following files and surfaces are single-writer integration points:

| Surface | Rule |
| --- | --- |
| `packages/database/prisma/schema.prisma` and migrations | One designated schema owner at a time. Other agents submit model/migration intent for integration. |
| `packages/types/src/` and shared API/event contracts | Contract owner approves the interface before consumers implement against it. |
| `apps/api/src/app.module.ts` | Integrator owns module registration; domain writers own their module files. |
| Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Integrator only; do not edit from parallel domain tasks. |
| `docker-compose.yml`, environment templates and CI | One named owner at a time. |
| Cross-domain events | EAT-62 owns event envelope/schema coordination; producers and consumers do not redefine contracts independently. |

Default domain scopes:
- API writers stay inside the domain directory assigned to them under `apps/api/src/<domain>/` and its tests.
- Customer UI writers stay within `apps/customer-web/`; partner UI writers stay within `apps/partner-web/`.
- Cross-domain changes require an explicit contract and contract test.
- Stop and report scope collisions rather than editing another writer's files.

## Worktree and runtime isolation

One write agent owns one branch and one worktree under `.worktrees/<branch-slug>/`. Never share a writable worktree.

Create a worktree from the primary checkout:

```powershell
.\scripts\new-worktree.ps1 feat/<short-scope>
```

Each writer must:
- install dependencies in its own worktree; do not share or symlink `node_modules`;
- keep its own untracked `.env`;
- use unique PostgreSQL and Redis host ports, API/customer/partner web ports, and a unique Compose project name;
- use its own database/volume and never share a writable database or migration run;
- treat the pnpm package store as shareable cache, but not generated clients or mutable runtime state.

Example environment allocation (choose a different set for each active worktree):

| Resource | Primary | Writer A | Writer B | Writer C |
| --- | ---: | ---: | ---: | ---: |
| PostgreSQL host | 5432 | 15432 | 25432 | 35432 |
| Redis host | 6379 | 16379 | 26379 | 36379 |
| API | 3001 | 3101 | 3201 | 3301 |
| Customer web | 3000 | 3100 | 3200 | 3300 |
| Partner web | 3002 | 3102 | 3202 | 3302 |

Set `POSTGRES_HOST_PORT` and `REDIS_HOST_PORT` in the worktree's `.env`, update `DATABASE_URL` and `REDIS_URL` to those host ports, and set `API_PORT` to its assigned port. Start Compose with a unique project name, e.g. `docker compose -p eatwave-writer-a up -d`. Start Next.js with explicit `--port` values where necessary. Compose project names isolate container/volume names; they do not make host ports unique by themselves.

## Contract-first parallelism

Before a dependent implementation wave:
1. Agree the public API, event, database and state-transition contracts.
2. Name one owner for each shared contract and integration hotspot.
3. Record the assumptions in the Linear issue or execution brief.
4. Give each writer disjoint paths and tests against the agreed contract.
5. Integrate through PRs and contract tests; do not rely on compile-only success.

The database owner serializes Prisma schema changes and migration generation. Avoid agents independently generating migrations against divergent schemas.

## Work package brief

Every write agent receives:
1. Linear issue(s) and expected outcome.
2. Branch and worktree path.
3. Allowed paths and excluded shared paths.
4. True blockers and stable contract assumptions.
5. Interfaces being added or consumed.
6. TDD sequence and verification commands.
7. Acceptance criteria and integration notes.

## Quality gates and handoff

Follow [TDD](../development/tdd.md). At minimum, run the focused domain tests and relevant typecheck. Before integration, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Report failures and unavailable checks honestly. Each PR must include changed paths, test evidence, contracts touched, migration implications, skipped work and residual risks. The coordinator reviews compatibility and end-to-end behaviour. Merged PRs alone do not prove a milestone complete.

Never commit implementation work directly to `main`. Push narrow branches and open PRs. **Only the user authorizes merges**; CI passing is not merge permission. Resolve conflicts in the owning branch/worktree and remove the worktree after merge or abandonment.
