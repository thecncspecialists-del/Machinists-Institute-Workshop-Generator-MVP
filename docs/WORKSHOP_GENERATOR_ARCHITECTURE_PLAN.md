# Machinists Institute Workshop Generator Architecture Plan

## Executive summary

The application has been reoriented into a generator-first, staff-authenticated workflow that mirrors the reference platform approach:

1. Auth.js credentials login
2. Prisma/PostgreSQL persistence
3. API mutation guard pattern with idempotency and rate limiting
4. Structured workshop input as source of truth
5. Canvas-ready HTML generation and copy
6. Optional save/search/reopen commons

This keeps MVP maintenance-light while preserving a reusable architecture for future internal apps.

## Proposed architecture

```text
Instructor / Staff User
        |
        v
Machinists Institute Workshop Generator (Next.js App Router)
        |
        |-- /workshop-generator
        |     |-- Structured input form
        |     |-- Live Canvas-style preview
        |     |-- HTML generator utility
        |     |-- Copy HTML action
        |
        |-- /workshop-generator/commons
        |     |-- Search workshops
        |     |-- Open workshop back into generator
        |
        |-- /api/workshops, /api/workshops/[id]
        |     |-- Auth/session checks
        |     |-- API mutation guard
        |     |-- Save/search/load structured workshop data
        |
        |-- Auth Layer (Auth.js + Prisma adapter)
        |
        |-- PostgreSQL (Prisma models)
        |
        v
Canvas LMS (manual paste of copied HTML)
```

## Module/folder structure

Implemented structure:

1. `app/workshop-generator/page.tsx`
2. `app/workshop-generator/commons/page.tsx`
3. `app/workshop-generator/actions.ts`
4. `app/api/workshops/route.ts`
5. `app/api/workshops/[id]/route.ts`
6. `components/workshop-generator/*`
7. `lib/workshop-generator/*`
8. `auth.ts`
9. `app/api/auth/[...nextauth]/route.ts`
10. `lib/api-mutation-guards.ts`
11. `lib/action-history.ts`

## Data model starter schema

Core additions:

1. `Workshop`
2. `WorkshopVisibility`
3. `User`
4. `Role`
5. `Account`
6. `Session`
7. `VerificationToken`
8. `ActionHistory`
9. `ActionHistoryStatus`

Workshop records store:

1. `title`
2. `courseLabel`
3. `termCode`
4. `inputJson`
5. `summary`
6. `tags`
7. `templateVersion`
8. creator metadata and timestamps

## Auth/role model

MVP auth model:

1. Credentials login (Auth.js)
2. Staff-only internal access for workshop pages and workshop APIs
3. Roles:
   - `STAFF`
   - `ADMIN`
4. Workshop overwrite behavior is admin-only; default is save-as-copy

## Storage and report/document pipeline approach

MVP workshop pipeline:

1. No file upload requirement
2. No S3 dependency for workshop workflow
3. Generated HTML is derived output, not authoritative storage artifact
4. Structured `inputJson` is the source of truth

## CI/CD and release flow

Aligned to existing platform flow:

1. GitHub PR to `main`
2. Vercel preview and production deploy
3. Prisma schema deploy/push using existing process
4. Smoke checks:
   - sign in
   - generate preview
   - copy HTML
   - save workshop
   - search and reopen

## Phase-by-phase roadmap

Phase 1: architecture alignment  
Phase 2: generator MVP (form, preview, copy)  
Phase 3: save to commons  
Phase 4: commons search and reopen  
Phase 5: docs and handoff  
Phase 6: production readiness validation

## File scaffold plan

Implemented starter files include:

1. `lib/workshop-generator/workshop-schema.ts`
2. `lib/workshop-generator/default-workshop-input.ts`
3. `lib/workshop-generator/term-code.ts`
4. `lib/workshop-generator/workshop-template-v1.ts`
5. `lib/workshop-generator/generate-workshop-html.ts`
6. `components/workshop-generator/WorkshopGeneratorShell.tsx`
7. `components/workshop-generator/WorkshopForm.tsx`
8. `components/workshop-generator/WorkshopPreview.tsx`
9. `components/workshop-generator/CopyHtmlButton.tsx`
10. `components/workshop-generator/SaveWorkshopDialog.tsx`
11. `components/workshop-generator/WorkshopCommonsSearch.tsx`
12. `app/workshop-generator/page.tsx`
13. `app/workshop-generator/actions.ts`

## Existing assets registry template

See:

1. `EXISTING_ASSETS_REGISTRY.md`

## Risks and mitigations

1. Risk: scope creep into full curriculum platform  
   Mitigation: keep UI focused on generator + optional commons.

2. Risk: term/course stewardship burden  
   Mitigation: text fields + term format validation only.

3. Risk: stale HTML after template change  
   Mitigation: store structured input + template version.

4. Risk: unauthorized or noisy writes  
   Mitigation: session checks + mutation guards + action history.

## Immediate next actions

1. Run `npm run db:push` in target environment.
2. Provision at least one staff/admin login.
3. Fill placeholders in `EXISTING_ASSETS_REGISTRY.md`.
4. Confirm production URL/env vars in runbook.
5. Validate copy/paste output in a real Canvas page.

## First 7 days execution plan

Day 1: environment alignment and auth validation  
Day 2: workshop template tuning with SMEs  
Day 3: term/course entry QA and copy flow validation  
Day 4: commons save/search behavior review  
Day 5: production dry run and smoke checks  
Day 6: instructor pilot and feedback pass  
Day 7: handoff closeout and release decision

## Explicit assumptions

1. Existing auth/account controls are available to reuse.
2. Existing PostgreSQL instance is available.
3. Existing deployment flow is GitHub + Vercel.
4. Canvas integration remains manual copy/paste in MVP.
5. Official institute HTML template may still need final replacement.
