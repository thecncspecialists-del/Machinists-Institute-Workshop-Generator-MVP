# Production Readiness Checklist

This app is currently built for local/internal curriculum drafting. Treat these
items as release blockers before exposing it to a broader audience.

## Data and Schema

- Convert the current `scripts/init-db.mjs` schema into Prisma migrations before
  production deployment.
- Back up Postgres before any schema migration and before large catalog imports.
- Keep imported course data append-only unless a migration explicitly documents
  how official reference rows are replaced or superseded.

## Access and Secrets

- Add authentication and role-aware authorization before network deployment.
- Store `DATABASE_URL` and `OPENAI_API_KEY` in the deployment platform secret
  manager, not in committed files.
- Rotate `OPENAI_API_KEY` when moving between local, staging, and production.

## Verification

- Add browser e2e coverage for import preview, import commit, draft generation
  failure when AI is unconfigured, save asset, and asset review status updates.
- Run `npm run test` and `npm run build` before release.
- Confirm Canvas preview images load from `/public` in the deployed environment.

## Integrations

- Keep Canvas and external system publishing manual until a scoped integration
  has explicit approval, audit logging, and rollback behavior.
