import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  runApiMutationGuard: vi.fn(),
  recordIdempotentMutationResult: vi.fn(),
  recordActionHistory: vi.fn(),
  userCount: vi.fn(),
  userFindMany: vi.fn(),
  courseCount: vi.fn(),
  courseFindMany: vi.fn(),
  courseFindUnique: vi.fn(),
  courseUpdate: vi.fn(),
  courseOutcomeCount: vi.fn(),
  courseOutcomeFindMany: vi.fn(),
  courseWorkspaceCount: vi.fn(),
  courseWorkspaceFindMany: vi.fn(),
  workshopCount: vi.fn(),
  workshopFindMany: vi.fn(),
  workshopUnitCount: vi.fn(),
  workshopUnitFindMany: vi.fn(),
  curriculumAssetCount: vi.fn(),
  curriculumAssetFindMany: vi.fn(),
  debugIssueCount: vi.fn(),
  debugIssueFindMany: vi.fn(),
  actionHistoryCount: vi.fn(),
  actionHistoryFindMany: vi.fn(),
  courseImportBatchCount: vi.fn(),
  courseImportBatchFindMany: vi.fn()
}));

vi.mock("@/lib/require-staff-user", () => ({
  requireAdminUser: mocks.requireAdminUser
}));

vi.mock("@/lib/api-mutation-guards", () => ({
  runApiMutationGuard: mocks.runApiMutationGuard,
  recordIdempotentMutationResult: mocks.recordIdempotentMutationResult
}));

vi.mock("@/lib/action-history", () => ({
  recordActionHistory: mocks.recordActionHistory
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: mocks.userCount, findMany: mocks.userFindMany },
    course: { count: mocks.courseCount, findMany: mocks.courseFindMany, findUnique: mocks.courseFindUnique, update: mocks.courseUpdate },
    courseOutcome: { count: mocks.courseOutcomeCount, findMany: mocks.courseOutcomeFindMany },
    courseWorkspace: { count: mocks.courseWorkspaceCount, findMany: mocks.courseWorkspaceFindMany },
    workshop: { count: mocks.workshopCount, findMany: mocks.workshopFindMany },
    workshopUnit: { count: mocks.workshopUnitCount, findMany: mocks.workshopUnitFindMany },
    curriculumAsset: { count: mocks.curriculumAssetCount, findMany: mocks.curriculumAssetFindMany },
    debugIssue: { count: mocks.debugIssueCount, findMany: mocks.debugIssueFindMany },
    actionHistory: { count: mocks.actionHistoryCount, findMany: mocks.actionHistoryFindMany },
    courseImportBatch: { count: mocks.courseImportBatchCount, findMany: mocks.courseImportBatchFindMany }
  }
}));

import { GET as getDatabaseBrowser } from "@/app/api/admin/database-browser/route";
import { PATCH as patchCourseLinks } from "@/app/api/admin/database-browser/course-links/route";
import { GET as getDatabaseBrowserReport } from "@/app/api/admin/database-browser/report/route";
import { queryDatabaseBrowser } from "@/lib/admin-database-browser";
import { databaseBrowserDatasetIds } from "@/lib/admin-database-browser-shared";

const adminUser = {
  id: "admin-1",
  email: "admin@example.edu",
  name: "Admin User"
};

const courseId = "11111111-1111-4111-8111-111111111111";

describe("database browser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue({ response: null, user: adminUser });
    mocks.runApiMutationGuard.mockResolvedValue({ response: null, idempotency: { key: "db-key" } });
    for (const mock of [
      mocks.userCount,
      mocks.courseCount,
      mocks.courseOutcomeCount,
      mocks.courseWorkspaceCount,
      mocks.workshopCount,
      mocks.workshopUnitCount,
      mocks.curriculumAssetCount,
      mocks.debugIssueCount,
      mocks.actionHistoryCount,
      mocks.courseImportBatchCount
    ]) {
      mock.mockResolvedValue(0);
    }
    for (const mock of [
      mocks.userFindMany,
      mocks.courseFindMany,
      mocks.courseOutcomeFindMany,
      mocks.courseWorkspaceFindMany,
      mocks.workshopFindMany,
      mocks.workshopUnitFindMany,
      mocks.curriculumAssetFindMany,
      mocks.debugIssueFindMany,
      mocks.actionHistoryFindMany,
      mocks.courseImportBatchFindMany
    ]) {
      mock.mockResolvedValue([]);
    }
    mocks.courseFindUnique.mockResolvedValue({
      id: courseId,
      syllabusUrl: null,
      canvasShellUrl: null,
      physicalInventoryUrl: null,
      curriculumUrl: null,
      certsUrl: null,
      amatrolUrl: null,
      toolingUUrl: null,
      electudeUrl: null,
      enrollmentTrackerUrl: null
    });
    mocks.courseUpdate.mockResolvedValue({
      id: courseId,
      courseCode: "MACH 100",
      courseName: "Safety",
      syllabusUrl: "https://example.edu/syllabus.pdf",
      canvasShellUrl: null,
      physicalInventoryUrl: null,
      curriculumUrl: null,
      certsUrl: null,
      amatrolUrl: null,
      toolingUUrl: null,
      electudeUrl: null,
      enrollmentTrackerUrl: null
    });
  });

  it("requires admin access for the browser API", async () => {
    mocks.requireAdminUser.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
      user: null
    });

    const response = await getDatabaseBrowser(new Request("https://app.example.test/api/admin/database-browser?dataset=users"));

    expect(response.status).toBe(403);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("supports every configured dataset with paginated responses", async () => {
    for (const dataset of databaseBrowserDatasetIds) {
      const result = await queryDatabaseBrowser(new URLSearchParams({ dataset, pageSize: "25" }));

      expect(result.dataset).toBe(dataset);
      expect(result.pageSize).toBe(25);
      expect(Array.isArray(result.columns)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
    }
  });

  it("caps unsupported page sizes to the safe default", async () => {
    const response = await getDatabaseBrowser(new Request("https://app.example.test/api/admin/database-browser?dataset=users&pageSize=999"));
    const payload = await response.json();

    expect(payload.pageSize).toBe(50);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it("passes course search and sort into Prisma", async () => {
    await getDatabaseBrowser(new Request("https://app.example.test/api/admin/database-browser?dataset=courses&q=safety&sort=courseName&direction=desc"));

    expect(mocks.courseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ courseName: expect.objectContaining({ contains: "safety" }) })
          ])
        }),
        orderBy: expect.arrayContaining([expect.objectContaining({ courseName: expect.objectContaining({ sort: "desc" }) })])
      })
    );
  });

  it("exports CSV for the filtered visible dataset without secret fields", async () => {
    mocks.courseCount.mockResolvedValue(1);
    mocks.courseFindMany.mockResolvedValue([
      {
        id: courseId,
        courseCode: "MACH 100",
        courseName: "Safety",
        updatedAt: new Date("2026-06-29T12:00:00.000Z"),
        syllabusUrl: "https://example.edu/syllabus.pdf",
        canvasShellUrl: "https://canvas.example.edu/template",
        physicalInventoryUrl: null,
        curriculumUrl: null,
        certsUrl: null,
        amatrolUrl: null,
        toolingUUrl: null,
        electudeUrl: null,
        enrollmentTrackerUrl: null
      }
    ]);

    const response = await getDatabaseBrowserReport(new Request("https://app.example.test/api/admin/database-browser/report?dataset=course-links&q=MACH"));
    const csv = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("database-browser-course-links");
    expect(csv).toContain("MACH 100");
    expect(csv).not.toContain("passwordHash");
    expect(mocks.courseFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5000 }));
  });

  it("rejects non-admin course link edits", async () => {
    mocks.requireAdminUser.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
      user: null
    });

    const response = await patchCourseLinks(buildPatchRequest({ courseId, links: { syllabusUrl: "https://example.edu/syllabus.pdf" } }));

    expect(response.status).toBe(403);
    expect(mocks.courseUpdate).not.toHaveBeenCalled();
  });

  it("rejects unsafe course link URLs", async () => {
    const response = await patchCourseLinks(buildPatchRequest({ courseId, links: { syllabusUrl: "javascript:alert(1)" } }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("http:// or https://");
    expect(mocks.courseUpdate).not.toHaveBeenCalled();
  });

  it("updates course links and records action history", async () => {
    const response = await patchCourseLinks(buildPatchRequest({ courseId, links: { syllabusUrl: "https://example.edu/syllabus.pdf" } }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.course.links.syllabusUrl).toBe("https://example.edu/syllabus.pdf");
    expect(mocks.courseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: courseId },
        data: { syllabusUrl: "https://example.edu/syllabus.pdf" }
      })
    );
    expect(mocks.recordActionHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "database_browser_course_link_update",
        affectedId: courseId
      })
    );
    expect(mocks.recordIdempotentMutationResult).toHaveBeenCalled();
  });
});

function buildPatchRequest(body: Record<string, unknown>) {
  return new Request("https://app.example.test/api/admin/database-browser/course-links", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-idempotency-key": "test-key" },
    body: JSON.stringify(body)
  });
}
