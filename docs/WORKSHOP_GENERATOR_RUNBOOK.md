# Workshop Generator Admin Runbook

## Purpose

This runbook supports technical operations for the Machinists Institute Workshop Generator.

This app is an internal staff-facing tool used to import course reference data, open a course workspace, and generate standardized Canvas-ready workshop HTML.

## Architecture summary

Primary stack:

1. Next.js App Router
2. TypeScript
3. Prisma + PostgreSQL
4. Auth.js credentials login

Core functional areas:

1. Workshop Generator UI (`/workshop-generator`)
2. Course Catalog and Course Workspace (`/courses`, `/workshop-generator/course-workspace`)
3. Workshop API endpoints (`/api/workshops`, `/api/workshops/[id]`)

## Environment variables

Required:

1. `DATABASE_URL`
2. `AUTH_SECRET`
3. `NEXTAUTH_URL`
4. `AUTH_URL`
5. `ADMIN_EMAIL` (for admin account provisioning workflow)
6. `ADMIN_PASSWORD` (for admin account provisioning workflow)

Optional:

1. `APP_DEFAULT_CONTRIBUTOR`
2. `OPENAI_API_KEY` (legacy generator routes in this repo)
3. `OPENAI_MODEL` (legacy generator routes in this repo)

## Database models

MVP workshop data model:

1. `workshops`
2. `users`
3. `accounts`
4. `sessions`
5. `verification_tokens`
6. `action_history`

Notes:

1. Workshop records store structured `input_json`, not only generated HTML.
2. Course and term are plain strings (`course_label`, `term_code`) by design.
3. `term_code` must follow `SP/SU/FA/WI + YYYY`.

## Deployment

Standard release flow:

1. Merge approved PR into `main`.
2. Confirm CI/build success.
3. Confirm Vercel deployment success.
4. Apply production schema changes:
   - `npm run db:push`
   - or existing migration deployment command when your migration process is active.
5. Run smoke checks:
   - sign in
   - open generator
   - generate preview
   - copy HTML
   - save workshop
   - reopen workspace from the course catalog

## Rollback

1. Roll back deployment in Vercel.
2. Restore database backup if schema/data rollback is required.
3. Re-run smoke checks on restored version.

## Common issues

Sign-in errors:

1. Confirm `AUTH_SECRET`, `AUTH_URL`, and `NEXTAUTH_URL`.
2. Confirm user record and password hash exist.

Workshop save errors:

1. Confirm user session is valid.
2. Confirm `title`, `courseLabel`, and `termCode` are provided.
3. Confirm `termCode` format is valid.

Search issues:

1. Confirm workshop rows exist.
2. Confirm rows are not archived (`archived_at` is null).

## Data retention

MVP assumption:

1. Workshop records remain available until archived or removed by authorized staff.
2. Prefer archive behavior over destructive delete.

## Future template management notes

Current template label:

1. `workshop-template-v1`

Current assumption embedded in HTML output:

1. `ASSUMPTION: Starter Canvas workshop template pending replacement with official Machinists Institute HTML format.`

When official template governance is introduced:

1. Add template version table if needed.
2. Keep generating from structured input so historic workshops can be regenerated.
