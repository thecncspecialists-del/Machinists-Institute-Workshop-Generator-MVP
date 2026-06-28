import { ActionHistoryStatus, DebugIssueStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { VALIDATION_LIMITS } from "@/lib/validation-limits";

export const runtime = "nodejs";

const createIssueSchema = z.object({
  title: z.string().trim().min(3).max(VALIDATION_LIMITS.debugIssueTitleMax),
  description: z.string().trim().min(8).max(VALIDATION_LIMITS.debugIssueDescriptionMax),
  pageUrl: z.string().trim().max(VALIDATION_LIMITS.pageUrlMax).optional().nullable()
});

const updateIssueSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(DebugIssueStatus),
  adminResponse: z.string().trim().max(VALIDATION_LIMITS.debugIssueDescriptionMax).optional().nullable()
});

const issueSelect = {
  id: true,
  title: true,
  description: true,
  pageUrl: true,
  status: true,
  adminResponse: true,
  reporterName: true,
  reporterEmail: true,
  resolvedByName: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true
};

let debugIssueTablesReady = false;

async function ensureDebugIssueTables() {
  if (debugIssueTablesReady) return;

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DebugIssueStatus') THEN
        CREATE TYPE "DebugIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED');
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "debug_issues" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "page_url" TEXT,
      "status" "DebugIssueStatus" NOT NULL DEFAULT 'OPEN',
      "admin_response" TEXT,
      "reporter_user_id" TEXT,
      "reporter_name" TEXT,
      "reporter_email" TEXT,
      "resolved_by_id" TEXT,
      "resolved_by_name" TEXT,
      "resolved_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "debug_issues_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debug_issues_status_idx" ON "debug_issues"("status");`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "debug_issues_reporter_user_id_created_at_idx" ON "debug_issues"("reporter_user_id", "created_at");`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debug_issues_updated_at_idx" ON "debug_issues"("updated_at");`);

  debugIssueTablesReady = true;
}

async function runDebugIssueMutationGuard(request: Request, actor: { id: string; email?: string | null }) {
  return runApiMutationGuard({
    request,
    actor,
    area: "debug_issues",
    guardActionType: "debug_issue_mutation_guard",
    idempotencyActionType: "debug_issue_mutation",
    rateLimit: {
      actionTypes: ["debug_issue_mutation", "debug_issue_mutation_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
}

export async function GET() {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureDebugIssueTables();

  const isAdmin = authResult.user.role === Role.ADMIN;
  const issues = await prisma.debugIssue.findMany({
    where: isAdmin ? {} : { reporterUserId: authResult.user.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: issueSelect,
    take: isAdmin ? 200 : 50
  });

  return NextResponse.json({ role: authResult.user.role, issues });
}

export async function POST(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const actor = { id: authResult.user.id, email: authResult.user.email };
    const guard = await runDebugIssueMutationGuard(request, actor);
    if (guard.response) return guard.response;

    await ensureDebugIssueTables();
    const payload = createIssueSchema.parse(await request.json());
    const issue = await prisma.debugIssue.create({
      data: {
        title: payload.title,
        description: payload.description,
        pageUrl: payload.pageUrl || null,
        reporterUserId: authResult.user.id,
        reporterName: authResult.user.name,
        reporterEmail: authResult.user.email
      },
      select: issueSelect
    });
    await recordActionHistory({
      actor,
      actionType: "debug_issue_mutation",
      description: "Submitted a debug issue.",
      area: "debug_issues",
      affectedType: "debug_issue",
      affectedId: issue.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { title: issue.title, pageUrl: issue.pageUrl }
    });

    return NextResponse.json({ issue });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid issue." : "Unable to submit issue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (authResult.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const actor = { id: authResult.user.id, email: authResult.user.email };
    const guard = await runDebugIssueMutationGuard(request, actor);
    if (guard.response) return guard.response;

    await ensureDebugIssueTables();
    const payload = updateIssueSchema.parse(await request.json());
    const fixed = payload.status === DebugIssueStatus.FIXED;
    const issue = await prisma.debugIssue.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        adminResponse: payload.adminResponse || null,
        resolvedById: fixed ? authResult.user.id : null,
        resolvedByName: fixed ? authResult.user.name ?? authResult.user.email ?? "Admin" : null,
        resolvedAt: fixed ? new Date() : null
      },
      select: issueSelect
    });
    await recordActionHistory({
      actor,
      actionType: "debug_issue_mutation",
      description: "Updated debug issue status.",
      area: "debug_issues",
      affectedType: "debug_issue",
      affectedId: issue.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { title: issue.title, status: issue.status }
    });

    return NextResponse.json({ issue });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid update." : "Unable to update issue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
