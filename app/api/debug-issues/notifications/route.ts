import { ActionHistoryStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const notificationMutationSchema = z.object({
  issueId: z.string().uuid(),
  action: z.enum(["dismiss", "mark-read"]).default("dismiss")
});

async function runNotificationMutationGuard(request: Request, actor: { id: string; email?: string | null }) {
  return runApiMutationGuard({
    request,
    actor,
    area: "debug_issues",
    guardActionType: "debug_issue_notification_guard",
    idempotencyActionType: "debug_issue_notification",
    rateLimit: {
      actionTypes: ["debug_issue_notification", "debug_issue_notification_guard"],
      max: 120,
      windowMs: 5 * 60 * 1000
    }
  });
}

function isUnreadForUser(issue: {
  lastAdminActivityAt: Date | null;
  viewStates: Array<{ lastSeenAt: Date | null; dismissedAt: Date | null }>;
}) {
  const adminActivityAt = issue.lastAdminActivityAt?.getTime();
  if (!adminActivityAt) return false;
  const viewState = issue.viewStates[0] ?? null;
  const seenAt = viewState?.lastSeenAt?.getTime() ?? 0;
  const dismissedAt = viewState?.dismissedAt?.getTime() ?? 0;
  return seenAt < adminActivityAt && dismissedAt < adminActivityAt;
}

export async function GET() {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (authResult.user.role === Role.ADMIN) {
    return NextResponse.json({ notifications: [] });
  }

  const issues = await prisma.debugIssue.findMany({
    where: {
      reporterUserId: authResult.user.id,
      archivedAt: null,
      lastAdminActivityAt: { not: null }
    },
    orderBy: [{ lastAdminActivityAt: "desc" }, { updatedAt: "desc" }],
    include: {
      viewStates: {
        where: { userId: authResult.user.id },
        take: 1
      }
    },
    take: 50
  });

  const notifications = issues.filter(isUnreadForUser).slice(0, 10).map((issue) => ({
    issueId: issue.id,
    title: issue.title,
    status: issue.status,
    adminResponse: issue.adminResponse,
    lastAdminActivityAt: issue.lastAdminActivityAt?.toISOString() ?? null,
    updatedAt: issue.updatedAt.toISOString()
  }));

  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runNotificationMutationGuard(request, actor);
  if (guard.response) return guard.response;

  try {
    const payload = notificationMutationSchema.parse(await request.json());
    const issue = await prisma.debugIssue.findFirst({
      where: {
        id: payload.issueId,
        ...(authResult.user.role === Role.ADMIN ? {} : { reporterUserId: authResult.user.id })
      },
      select: { id: true, title: true }
    });
    if (!issue) {
      return NextResponse.json({ error: "Issue not found." }, { status: 404 });
    }

    const now = new Date();
    await prisma.debugIssueViewState.upsert({
      where: {
        issueId_userId: {
          issueId: issue.id,
          userId: authResult.user.id
        }
      },
      update:
        payload.action === "mark-read"
          ? { lastSeenAt: now, dismissedAt: null }
          : { dismissedAt: now },
      create:
        payload.action === "mark-read"
          ? { issueId: issue.id, userId: authResult.user.id, lastSeenAt: now }
          : { issueId: issue.id, userId: authResult.user.id, dismissedAt: now }
    });

    await recordActionHistory({
      actor,
      actionType: "debug_issue_notification",
      description: payload.action === "mark-read" ? "Marked debug issue notification read." : "Dismissed debug issue notification.",
      area: "debug_issues",
      affectedType: "debug_issue",
      affectedId: issue.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { title: issue.title, action: payload.action }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid notification update." : "Unable to update notification.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
