# Machinists Institute Workshop Generator

An instructor and curriculum designer tool that generates standardized Canvas-ready workshop HTML from structured workshop information.

## Start Here

1. [docs/WORKSHOP_GENERATOR_DAILY_USE.md](./docs/WORKSHOP_GENERATOR_DAILY_USE.md)
2. [docs/WORKSHOP_GENERATOR_RUNBOOK.md](./docs/WORKSHOP_GENERATOR_RUNBOOK.md)
3. [EXISTING_ASSETS_REGISTRY.md](./EXISTING_ASSETS_REGISTRY.md)

## Operating Model

1. This is an internal staff-facing tool.
2. Primary workflow is generate -> preview -> copy HTML -> paste into Canvas manually.
3. Saving to Workshop Commons is optional and stores structured inputs for reuse.
4. Reuse existing infrastructure assets before creating anything new.

## Core Features

1. Single-page Workshop Generator (`/workshop-generator`)
2. Live Canvas-style preview
3. One-click copy of generated HTML
4. Save structured workshop input to commons
5. Search and reopen saved workshops

## Stack Alignment

1. Next.js + TypeScript
2. Prisma + PostgreSQL
3. Auth.js credentials login
4. Existing platform-style API mutation guard and action history logging

## Local Development

1. Install dependencies:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

2. Copy and configure environment:

```powershell
Copy-Item .env.example .env
```

3. Generate Prisma client and apply schema:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run db:generate
& 'C:\Program Files\nodejs\npm.cmd' run db:push
```

4. Start the app:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

5. Open:

`http://localhost:3002/sign-in`

## Environment Variables

Required:

1. `DATABASE_URL`
2. `AUTH_SECRET`
3. `AUTH_URL`
4. `NEXTAUTH_URL`

Optional:

1. `ADMIN_EMAIL`
2. `ADMIN_PASSWORD`
3. `APP_DEFAULT_CONTRIBUTOR`

## MVP Constraints

1. No Course table dependency for generator workflow.
2. No Term table dependency for generator workflow.
3. No Canvas API publishing in MVP.
4. No rich text editor in MVP.
5. No student-facing routes.

## Template Note

Generated output includes:

`ASSUMPTION: Starter Canvas workshop template pending replacement with official Machinists Institute HTML format.`
