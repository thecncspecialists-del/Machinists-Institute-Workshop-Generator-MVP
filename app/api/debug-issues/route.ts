import { ActionHistoryStatus, DebugIssueMessageAuthorRole, DebugIssueStatus, Role, type Prisma } from "@prisma/client";
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

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(DebugIssueStatus),
  adminResponse: z.string().trim().max(VALIDATION_LIMITS.debugIssueDescriptionMax).optional().nullable()
});

const replySchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(VALIDATION_LIMITS.debugIssueDescriptionMax)
});

const idOnlySchema = z.object({
  id: z.string().uuid()
});

const issueInclude = {
  messages: {
    orderBy: { createdAt: "asc" as const }
  },
  viewStates: true,
  _count: {
    select: { messages: true }
  }
};

type IssueWithRelations = Prisma.DebugIssueGetPayload<{
  include: typeof issueInclude;
}>;

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

function serializeIssue(issue: IssueWithRelations, viewerId: string) {
  const fallbackMessage =
    issue.messages.length === 0
      ? [
          {
            id: `${issue.id}-initial`,
            issueId: issue.id,
            authorUserId: issue.reporterUserId,
            authorName: issue.reporterName,
            authorEmail: issue.reporterEmail,
            authorRole: DebugIssueMessageAuthorRole.STAFF,
            body: issue.description,
            createdAt: issue.createdAt
          }
        ]
      : [];
  const viewerState = issue.viewStates.find((state) => state.userId === viewerId) ?? null;
  const adminActivityAt = issue.lastAdminActivityAt?.toISOString() ?? null;
  const lastSeenAt = viewerState?.lastSeenAt?.toISOString() ?? null;
  const dismissedAt = viewerState?.dismissedAt?.toISOString() ?? null;
  const adminActivityMs = issue.lastAdminActivityAt?.getTime() ?? 0;
  const lastSeenMs = viewerState?.lastSeenAt?.getTime() ?? 0;
  const dismissedMs = viewerState?.dismissedAt?.getTime() ?? 0;
  const unread =
    adminActivityMs > 0 &&
    lastSeenMs < adminActivityMs &&
    dismissedMs < adminActivityMs;

  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    pageUrl: issue.pageUrl,
    status: issue.status,
    adminResponse: issue.adminResponse,
    reporterName: issue.reporterName,
    reporterEmail: issue.reporterEmail,
    resolvedByName: issue.resolvedByName,
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    archivedByName: issue.archivedByName,
    archivedAt: issue.archivedAt?.toISOString() ?? null,
    lastAdminActivityAt: adminActivityAt,
    lastReporterActivityAt: issue.lastReporterActivityAt?.toISOString() ?? null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    messageCount: issue._count.messages || fallbackMessage.length,
    unread,
    messages: [...fallbackMessage, ...issue.messages].map((message) => ({
      id: message.id,
      issueId: message.issueId,
      authorUserId: message.authorUserId,
      authorName: message.authorName,
      authorEmail: message.authorEmail,
      authorRole: message.authorRole,
      body: message.body,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

async function findIssueForUser(id: string, user: { id: string; role: Role }) {
  return prisma.debugIssue.findFirst({
    where: {
      id,
      ...(user.role === Role.ADMIN ? {} : { reporterUserId: user.id, archivedAt: null })
    },
    include: issueInclude
  });
}

async function markIssueSeen(issueId: string, userId: string, seenAt = new Date()) {
  await prisma.debugIssueViewState.upsert({
    where: {
      issueId_userId: {
        issueId,
        userId
      }
    },
    update: {
      lastSeenAt: seenAt,
      dismissedAt: null
    },
    create: {
      issueId,
      userId,
      lastSeenAt: seenAt
    }
  });
}

export async function GET(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "archived" ? "archived" : "active";
  const focus = url.searchParams.get("focus")?.trim() ?? "";
  const isAdmin = authResult.user.role === Role.ADMIN;

  if (view === "archived" && !isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const where: Prisma.DebugIssueWhereInput = {
    ...(isAdmin ? {} : { reporterUserId: authResult.user.id }),
    ...(view === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(focus ? { id: focus } : {})
  };

  const issues = await prisma.debugIssue.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: issueInclude,
    take: focus ? 1 : isAdmin ? 250 : 50
  });

  if (focus && issues[0]) {
    await markIssueSeen(issues[0].id, authResult.user.id);
  }

  return NextResponse.json({
    role: authResult.user.role,
    view,
    issues: issues.map((issue) => serializeIssue(issue, authResult.user.id))
  });
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

    const payload = createIssueSchema.parse(await request.json());
    const now = new Date();
    const issue = await prisma.debugIssue.create({
      data: {
        title: payload.title,
        description: payload.description,
        pageUrl: payload.pageUrl || null,
        reporterUserId: authResult.user.id,
        reporterName: authResult.user.name,
        reporterEmail: authResult.user.email,
        lastReporterActivityAt: now,
        messages: {
          create: {
            authorUserId: authResult.user.id,
            authorName: authResult.user.name,
            authorEmail: authResult.user.email,
            authorRole: DebugIssueMessageAuthorRole.STAFF,
            body: payload.description,
            createdAt: now
          }
        },
        viewStates: {
          create: {
            userId: authResult.user.id,
            lastSeenAt: now
          }
        }
      },
      include: issueInclude
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

    return NextResponse.json({ issue: serializeIssue(issue, authResult.user.id) });
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

  try {
    const actor = { id: authResult.user.id, email: authResult.user.email };
    const guard = await runDebugIssueMutationGuard(request, actor);
    if (guard.response) return guard.response;

    const rawPayload = await request.json();
    const action = typeof rawPayload.action === "string" ? rawPayload.action : "update-status";
    const now = new Date();

    if (action === "mark-read") {
      const payload = idOnlySchema.parse(rawPayload);
      const issue = await findIssueForUser(payload.id, authResult.user);
      if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
      await markIssueSeen(issue.id, authResult.user.id, now);
      return NextResponse.json({ ok: true });
    }

    if (action === "reply") {
      const payload = replySchema.parse(rawPayload);
      const issue = await findIssueForUser(payload.id, authResult.user);
      if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
      const isAdmin = authResult.user.role === Role.ADMIN;
      const saved = await prisma.debugIssue.update({
        where: { id: issue.id },
        data: {
          ...(isAdmin ? { lastAdminActivityAt: now } : { lastReporterActivityAt: now }),
          messages: {
            create: {
              authorUserId: authResult.user.id,
              authorName: authResult.user.name,
              authorEmail: authResult.user.email,
              authorRole: isAdmin ? DebugIssueMessageAuthorRole.ADMIN : DebugIssueMessageAuthorRole.STAFF,
              body: payload.body,
              createdAt: now
            }
          }
        },
        include: issueInclude
      });
      await markIssueSeen(issue.id, authResult.user.id, now);
      await recordActionHistory({
        actor,
        actionType: "debug_issue_mutation",
        description: isAdmin ? "Replied to a debug issue as admin." : "Replied to a debug issue.",
        area: "debug_issues",
        affectedType: "debug_issue",
        affectedId: saved.id,
        status: ActionHistoryStatus.SUCCESS,
        metadata: { title: saved.title, action: "reply" }
      });
      return NextResponse.json({ issue: serializeIssue(saved, authResult.user.id) });
    }

    if (action === "archive" || action === "unarchive") {
      if (authResult.user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      const payload = idOnlySchema.parse(rawPayload);
      const issue = await findIssueForUser(payload.id, authResult.user);
      if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
      if (action === "archive" && issue.status !== DebugIssueStatus.FIXED) {
        return NextResponse.json({ error: "Only fixed issues can be archived." }, { status: 400 });
      }
      const saved = await prisma.debugIssue.update({
        where: { id: issue.id },
        data:
          action === "archive"
            ? {
                archivedAt: now,
                archivedById: authResult.user.id,
                archivedByName: authResult.user.name ?? authResult.user.email ?? "Admin"
              }
            : {
                archivedAt: null,
                archivedById: null,
                archivedByName: null
              },
        include: issueInclude
      });
      await recordActionHistory({
        actor,
        actionType: "debug_issue_mutation",
        description: action === "archive" ? "Archived debug issue." : "Unarchived debug issue.",
        area: "debug_issues",
        affectedType: "debug_issue",
        affectedId: saved.id,
        status: ActionHistoryStatus.SUCCESS,
        metadata: { title: saved.title, action }
      });
      return NextResponse.json({ issue: serializeIssue(saved, authResult.user.id) });
    }

    if (authResult.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const payload = updateStatusSchema.parse(rawPayload);
    const fixed = payload.status === DebugIssueStatus.FIXED;
    const adminNote = payload.adminResponse?.trim() ?? "";
    const issue = await prisma.debugIssue.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        adminResponse: adminNote || null,
        resolvedById: fixed ? authResult.user.id : null,
        resolvedByName: fixed ? authResult.user.name ?? authResult.user.email ?? "Admin" : null,
        resolvedAt: fixed ? now : null,
        lastAdminActivityAt: now,
        ...(adminNote
          ? {
              messages: {
                create: {
                  authorUserId: authResult.user.id,
                  authorName: authResult.user.name,
                  authorEmail: authResult.user.email,
                  authorRole: DebugIssueMessageAuthorRole.ADMIN,
                  body: adminNote,
                  createdAt: now
                }
              }
            }
          : {})
      },
      include: issueInclude
    });
    await markIssueSeen(issue.id, authResult.user.id, now);
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

    return NextResponse.json({ issue: serializeIssue(issue, authResult.user.id) });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid update." : "Unable to update issue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
