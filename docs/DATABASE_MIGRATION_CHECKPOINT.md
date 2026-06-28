# Database Migration Checkpoint

Use this checklist before every production schema checkpoint. The app now treats
`prisma/schema.prisma` and `prisma/migrations` as the schema source of truth;
request handlers must not create or alter tables at runtime.

## Before Production

1. Confirm the target branch has passed `npm run test` and `npm run build`.
2. Export a fresh Postgres backup from the production provider.
3. Record the current production deployment URL and git commit.
4. Verify migration status against the target database:

```bash
npx prisma migrate status
```

For the current production database, the baseline migration represents tables
that were introduced before Prisma migrations existed. If production already
matches the baseline schema, mark it as applied instead of replaying it:

```bash
npx prisma migrate resolve --applied 20260628181000_baseline_org_readiness_schema
```

Then run:

```bash
npm run db:migrate:deploy
```

## Smoke Test After Deploy

1. Sign in as a staff user and open the course catalog.
2. Open an existing class workspace and confirm homepage/workshop/unit previews load.
3. Save a homepage edit, a workshop edit, and a unit edit.
4. Submit a debug issue as staff, then update its status as admin.
5. Confirm admin user management still blocks unsafe self-demotion and last-admin demotion.
6. Review action history rows for the mutations above.

## Rollback Notes

- Do not roll back schema by deleting tables in production.
- Restore from the fresh backup if a migration corrupts or removes data.
- If only application code is faulty, redeploy the last known-good Vercel
  deployment and leave the database unchanged until a forward fix is ready.
