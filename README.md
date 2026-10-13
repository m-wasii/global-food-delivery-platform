# Global Food Delivery Platform

A globally scalable food delivery platform connecting customers, restaurants, couriers, and payment providers through a modular, production-oriented architecture.

## Project

This repository implements the **Global Food Delivery Platform** project tracked in Linear.

- Product planning: Linear
- Source control: GitHub
- Architecture: modular monolith first, with deliberate evolution toward distributed components where justified
- Primary backend: NestJS + TypeScript
- Customer web: Next.js
- Database: PostgreSQL
- Cache / background infrastructure: Redis
- ORM: Prisma
- Local infrastructure: Docker Compose



## Prerequisites

- Node.js `>=26.10.0`
- [pnpm](https://pnpm.io) `12.8.1` (this repo pins it via `packageManager` in root `package.json`)
- Docker with Compose

Enable the pinned pnpm with Corepack (ships with Node):

```bash
corepack enable
```



## Local setup

From a fresh machine:

### 1. Clone and install

```bash
git clone https://github.com/m-wasii/global-food-delivery-platform.git
cd global-food-delivery-platform
pnpm install
```



### 2. Create a local env file

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Defaults in `.env.example` are for local development only. Variable details: [docs/development/environment.md](docs/development/environment.md).

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```



### 4. Generate Prisma client and apply migrations

```bash
pnpm db:generate
pnpm db:migrate
```



### 5. Run the apps

All packages in parallel:

```bash
pnpm dev
```

Or individually:

```bash
pnpm --filter @food-delivery/api dev
pnpm --filter @food-delivery/customer-web dev
```


| Service      | Default URL                                            |
| ------------ | ------------------------------------------------------ |
| API          | [http://localhost:3001](http://localhost:3001)         |
| Customer web | [http://localhost:3000](http://localhost:3000)         |
| API docs     | [http://localhost:3001/api](http://localhost:3001/api) |




### 6. Verify

```bash
curl.exe -i http://localhost:3001/health
```

Expect HTTP 200 and `"status":"ok"` when Postgres and Redis are up. On Windows PowerShell use `curl.exe` (plain `curl` is an alias for `Invoke-WebRequest`).

## Useful scripts


| Script           | Purpose                |
| ---------------- | ---------------------- |
| `pnpm lint`      | Lint all packages      |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm test`      | Run tests              |
| `pnpm build`     | Build all packages     |




## Status

Foundation phase — core repo, database, API health, docs, and CI are in place.