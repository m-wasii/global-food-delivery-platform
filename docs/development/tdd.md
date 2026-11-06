# Test-Driven Development

From Milestone 05 onward, all new production behavior and bug fixes follow TDD.

## Workflow

1. **RED** — Write one failing test for a single behavior.
2. **Verify RED** — Run it and confirm it fails because the behavior is missing (not because of a typo).
3. **GREEN** — Add the smallest implementation that makes the test pass.
4. **Verify GREEN** — Re-run; keep the suite green and clean.
5. **REFACTOR** — Improve names/structure without changing behavior; stay green.
6. Repeat.

Do not write production code first. If you already did, delete it and start from a failing test.

## Commands

```bash
# All packages
pnpm test

# API only (Vitest)
pnpm --filter @food-delivery/api test

# Partner web helpers (Vitest)
pnpm --filter @food-delivery/partner-web test
```

API tests live next to the code as `*.spec.ts` (for example `apps/api/src/cart/pricing.spec.ts`). Partner shell helpers: `apps/partner-web/lib/**/*.spec.ts`.

## Design for testability

- Put rules and calculations in pure modules; keep Nest controllers and Next pages thin.
- Prefer testing real code. Mock only at I/O boundaries (DB, HTTP, Redis).
- When adding helpers in a web app, introduce Vitest with the first helper and test that before building pages.
- Do not backfill unrelated legacy UI. When you change existing code, add a failing regression test first.

## Exceptions

Ask before skipping TDD for throwaway spikes, generated code, or pure configuration. Delete spike code before shipping the real change under TDD.
