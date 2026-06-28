import { DebugIssueStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffUser: vi.fn(),
  runApiMutationGuard: vi.fn(),
  recordActionHistory: vi.fn(),
  debugIssueCreate: vi.fn(),
  debugIssueFindFirst: vi.fn(),
  debugIssueFindMany: vi.fn(),
  debugIssueUpdate: vi.fn(),
  viewStateUpsert: vi.fn()
}));

vi.mock("@/lib/require-staff-user", () => ({
  requireStaffUser: mocks.requireStaffUser
}));

vi.mock("@/lib/api-mutation-guards", () => ({
  runApiMutationGuard: mocks.runApiMutationGuard
}));

vi.mock("@/lib/action-history", () => ({
  recordActionHistory: mocks.recordActionHistory
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    debugIssue: {
      create: mocks.debugIssueCreate,
      findFirst: mocks.debugIssueFindFirst,
      findMany: mocks.debugIssueFindMany,
      update: mocks.debugIssueUpdate
    },
    debugIssueViewState: {
      upsert: mocks.viewStateUpsert
    }
  }
}));

import { GET, PATCH } from "@/app/api/debug-issues/route";
import { GET as GET_NOTIFICATIONS, PATCH as PATCH_NOTIFICATIONS } from "@/app/api/debug-issues/notifications/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.edu",
  name: "Staff User",
  role: Role.STAFF
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.edu",
  name: "Admin User",
  role: Role.ADMIN
};

function issue(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-28T12:00:00.000Z");
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Broken layout",
    description: "The page layout overlaps.",
    pageUrl: "https://example.test/courses",
    status: DebugIssueStatus.OPEN,
    adminResponse: null,
    reporterUserId: staffUser.id,
    reporterName: staffUser.name,
    reporterEmail: staffUser.email,
    resolvedById: null,
    resolvedByName: null,
    resolvedAt: null,
    archivedById: null,
    archivedByName: null,
    archivedAt: null,
    lastAdminActivityAt: null,
    lastReporterActivityAt: now,
    createdAt: now,
    updatedAt: now,
    messages: [],
    viewStates: [],
    _count: { messages: 0 },
    ...overrides
  };
}

function mutationRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.test/api/debug-issues", {
    method: "PATCH",
    headers: {
      host: "app.example.test",
      origin: "https://app.example.test",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("debug issue request center routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffUser.mockResolvedValue({ response: null, user: staffUser });
    mocks.runApiMutationGuard.mockResolvedValue({ response: null, idempotency: { key: null } });
    mocks.debugIssueFindMany.mockResolvedValue([]);
    mocks.debugIssueFindFirst.mockResolvedValue(null);
    mocks.debugIssueUpdate.mockResolvedValue(issue());
    mocks.viewStateUpsert.mockResolvedValue({});
  });

  it("limits staff GET requests to their own active issues", async () => {
    const response = await GET(new Request("https://app.example.test/api/debug-issues?view=active"));

    expect(response.status).toBe(200);
    expect(mocks.debugIssueFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        reporterUserId: staffUser.id,
        archivedAt: null
      })
    }));
  });

  it("allows admins to request archived issues", async () => {
    mocks.requireStaffUser.mockResolvedValue({ response: null, user: adminUser });

    const response = await GET(new Request("https://app.example.test/api/debug-issues?view=archived"));

    expect(response.status).toBe(200);
    expect(mocks.debugIssueFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archivedAt: { not: null }
      })
    }));
  });

  it("blocks non-admin archive attempts", async () => {
    const response = await PATCH(mutationRequest({ action: "archive", id: "11111111-1111-4111-8111-111111111111" }));

    expect(response.status).toBe(403);
  });

  it("rejects archiving unresolved issues", async () => {
    mocks.requireStaffUser.mockResolvedValue({ response: null, user: adminUser });
    mocks.debugIssueFindFirst.mockResolvedValue(issue({ status: DebugIssueStatus.IN_PROGRESS }));

    const response = await PATCH(mutationRequest({ action: "archive", id: "11111111-1111-4111-8111-111111111111" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Only fixed issues can be archived." });
  });

  it("records admin activity when status changes", async () => {
    mocks.requireStaffUser.mockResolvedValue({ response: null, user: adminUser });
    mocks.debugIssueUpdate.mockResolvedValue(issue({ status: DebugIssueStatus.FIXED, lastAdminActivityAt: new Date() }));

    const response = await PATCH(mutationRequest({
      action: "update-status",
      id: "11111111-1111-4111-8111-111111111111",
      status: "FIXED",
      adminResponse: "Fixed in production."
    }));

    expect(response.status).toBe(200);
    expect(mocks.debugIssueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastAdminActivityAt: expect.any(Date),
        messages: expect.objectContaining({ create: expect.objectContaining({ authorRole: "ADMIN" }) })
      })
    }));
  });

  it("records reporter activity when staff replies", async () => {
    mocks.debugIssueFindFirst.mockResolvedValue(issue());
    mocks.debugIssueUpdate.mockResolvedValue(issue({ messages: [{ id: "message-1", issueId: "11111111-1111-4111-8111-111111111111", authorUserId: staffUser.id, authorName: staffUser.name, authorEmail: staffUser.email, authorRole: "STAFF", body: "Thanks", createdAt: new Date() }], _count: { messages: 1 } }));

    const response = await PATCH(mutationRequest({
      action: "reply",
      id: "11111111-1111-4111-8111-111111111111",
      body: "Thanks"
    }));

    expect(response.status).toBe(200);
    expect(mocks.debugIssueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastReporterActivityAt: expect.any(Date)
      })
    }));
  });

  it("returns only unread admin updates in notifications", async () => {
    const adminActivity = new Date("2026-06-28T12:10:00.000Z");
    mocks.debugIssueFindMany.mockResolvedValue([
      issue({
        lastAdminActivityAt: adminActivity,
        viewStates: [{ lastSeenAt: new Date("2026-06-28T12:00:00.000Z"), dismissedAt: null }]
      }),
      issue({
        id: "22222222-2222-4222-8222-222222222222",
        lastAdminActivityAt: adminActivity,
        viewStates: [{ lastSeenAt: new Date("2026-06-28T12:15:00.000Z"), dismissedAt: null }]
      })
    ]);

    const response = await GET_NOTIFICATIONS();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notifications).toHaveLength(1);
    expect(payload.notifications[0].issueId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("dismisses notifications through view state", async () => {
    mocks.debugIssueFindFirst.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", title: "Broken layout" });

    const response = await PATCH_NOTIFICATIONS(new Request("https://app.example.test/api/debug-issues/notifications", {
      method: "PATCH",
      headers: {
        host: "app.example.test",
        origin: "https://app.example.test",
        "content-type": "application/json"
      },
      body: JSON.stringify({ issueId: "11111111-1111-4111-8111-111111111111", action: "dismiss" })
    }));

    expect(response.status).toBe(200);
    expect(mocks.viewStateUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ dismissedAt: expect.any(Date) })
    }));
  });
});
