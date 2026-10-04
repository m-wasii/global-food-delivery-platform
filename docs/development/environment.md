# Local environment

## Setup

1. From the repo root, copy the example env file:
  ```bash
  cp .env.example .env
  ```
  ```
  PowerShell: Copy-Item .env.example .env

  ```
2. Start PostgreSQL and Redis:
  ```
   docker compose up -d
  ```
  Compose reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env`.
3. Generate the Prisma client and run migrations (from repo root):

```
pnpm db:generate
pnpm db:migrate -- --name init
```

## Variables


| Variable                                              | Used by                                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `NODE_ENV`                                            | Runtime mode                                         |
| `API_PORT`                                            | Nest API listen port                                 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Docker Compose Postgres                              |
| `DATABASE_URL`                                        | API / database clients (same credentials as Compose) |
| `REDIS_URL`                                           | Redis connection                                     |
| `NEXT_PUBLIC_API_URL`                                 | Customer web → API base URL                          |


Defaults in `.env.example` are for local development only.

## Secrets

- Commit `.env.example` only.
- Keep real values in `.env` (gitignored). Also ignored: `.env.local`.
- Never commit passwords, tokens, or production URLs.

