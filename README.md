# Machinists Institute Canvas Asset Builder

An internal curriculum tool for importing course reference data and generating standardized Canvas-ready instructional assets from structured staff input.

## Start Here

1. [docs/WORKSHOP_GENERATOR_DAILY_USE.md](./docs/WORKSHOP_GENERATOR_DAILY_USE.md)
2. [docs/WORKSHOP_GENERATOR_RUNBOOK.md](./docs/WORKSHOP_GENERATOR_RUNBOOK.md)
3. [EXISTING_ASSETS_REGISTRY.md](./EXISTING_ASSETS_REGISTRY.md)

## Operating Model

1. This is an internal staff-facing tool.
2. Canvas remains the system of record for student-facing content.
3. Primary asset workflow is generate -> preview -> copy HTML -> paste into Canvas manually.
4. Course Catalog is the entry point for imported course reference data.
5. Course Workspace keeps the selected course active while workshops and units are built.

## Core Features

1. Course Catalog (`/courses`)
2. Course Workspace (`/workshop-generator/course-workspace`)
3. Workshop Builder (`/workshop-generator`)
4. Live Canvas-style preview
5. One-click copy of generated HTML
6. Authenticated course import and workshop APIs

## Stack Alignment

1. Next.js + TypeScript
2. Prisma + PostgreSQL
3. Auth.js credentials login
4. Existing platform-style API mutation guard and action history logging
5. Canvas-first reference strategy with local structured recipes, not bulk document storage

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

## Current Constraints

1. No Canvas API publishing yet.
2. No automatic Canvas publishing yet.
3. No rich text editor yet.
4. No student-facing routes.
5. No local long-term PDF or full HTML history storage.

## Template Note

Generated output includes:

`ASSUMPTION: Starter Canvas workshop template pending replacement with official Machinists Institute HTML format.`
