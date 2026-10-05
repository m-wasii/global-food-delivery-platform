# API (`@food-delivery/api`)

NestJS modular-monolith entrypoint for the platform.

## Run locally

From the repo root:

```bash
pnpm --filter @food-delivery/api dev
```

Default port is `3001` (`API_PORT` overrides it).

## Health

```bash
curl.exe -i http://localhost:3001/health
```

The JSON includes `checks.database` and `checks.redis` (`up` or `down`). When both are up, `status` is `"ok"` and the response is HTTP 200. If either dependency is down, `status` is `"error"` and the response is HTTP 503.

On Windows PowerShell use `curl.exe`, not `curl` (`curl` is an alias for `Invoke-WebRequest`).

## Add a module

Follow the `HealthModule` pattern:

1. Create a folder under `src/`, e.g. `src/orders/`
2. Add a Nest module and controller (and services as needed)
3. Import the module in `AppModule`

Example wiring (same shape as health):

```ts
// src/app.module.ts
@Module({
  imports: [HealthModule /*, OrdersModule */],
})
export class AppModule {}
```

Keep domain code inside its own module folder so boundaries stay clear as the monolith grows.
