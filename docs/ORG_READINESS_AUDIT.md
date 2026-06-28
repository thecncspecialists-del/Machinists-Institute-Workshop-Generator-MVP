# Org Readiness Audit

Date: 2026-06-28

## Checkpoint Summary

Completed conservative checkpoints:

- `036e7b1b` - stabilized homepage tests and builder layout regression coverage.
- `a2777125` - hardened API mutation guardrails, admin authorization, validation limits, idempotency, rate limiting, and audit logging.
- `3361ae15` - moved schema lifecycle out of request handlers and into Prisma migrations/checklists.
- `304319b0` - extracted admin/debug overlay controllers and added client idempotency keys for those mutations.

Each checkpoint passed:

```bash
npm run test
npm run build
```

Each checkpoint was pushed to `main` and reached a Ready Vercel production deployment.

## Security And Guardrails

- Staff auth is required for import, asset, generator, workspace, workshop, unit, and debug issue surfaces.
- Admin user management now uses shared admin authorization and blocks self-demotion and last-admin demotion.
- Mutation routes now share origin checks, rate limits, optional idempotency replay, and action-history logging.
- Validation limits are centralized for admin names, debug issue text, import file size, page URLs, and AI generation input payloads.
- Runtime schema creation was removed from request handlers. Prisma schema and migrations are now the source of truth.
- `.env` files and common secret/key files are ignored by git; no tracked secret files were found in the final scan.

## Dependency Audit

Command:

```bash
npm audit --omit=dev
```

Result: 5 vulnerabilities, with 1 high and 4 moderate.

- `xlsx@0.18.5`: high severity advisories for prototype pollution and ReDoS; npm reports no direct fix available.
- `next@15.5.18` via `postcss@8.4.31`: moderate advisory; npm's suggested force fix is not safe because it proposes a breaking downgrade.
- `next-auth@4.24.14` via `uuid@8.3.2`: moderate advisory; npm's suggested force fix is not safe because it proposes a breaking downgrade.

Current mitigations:

- Import endpoints require staff authentication.
- Import files are capped by `VALIDATION_LIMITS.importFileMaxBytes`.
- Import preview/commit failures do not bypass authorization or validation.

Required follow-up before broad external rollout:

- Replace `xlsx` with a maintained parser or isolate spreadsheet parsing in a sandboxed worker/service.
- Track safe upstream upgrade paths for `next`, `postcss`, `next-auth`, and `uuid`.
- Keep `npm audit --omit=dev` in the release checklist until advisories are resolved or formally accepted.

## Database Migration Status

- Added baseline migration `20260628181000_baseline_org_readiness_schema`.
- Removed request-time DDL for course workspaces, workshop units, and debug issues.
- Updated `db:init` to use `prisma migrate deploy`.
- Added `docs/DATABASE_MIGRATION_CHECKPOINT.md`.

Production database action still required:

- Back up production Postgres.
- Run `npx prisma migrate status`.
- If the schema already matches the baseline, mark the baseline applied with:

```bash
npx prisma migrate resolve --applied 20260628181000_baseline_org_readiness_schema
```

- Then use `npm run db:migrate:deploy` for future migration checkpoints.

## Residual Risks

- Browser-level smoke testing of authenticated production workflows still needs a human session.
- Spreadsheet parsing remains the highest dependency risk until `xlsx` is replaced or isolated.
- Admin/debug overlays were refactored safely, but the larger builder components still need additional controller/presentation splits in smaller future commits.
- E2E coverage is still missing for import preview/commit, AI missing-key behavior, asset review, and full builder save flows.
