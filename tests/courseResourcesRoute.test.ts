import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  runApiMutationGuard: vi.fn(),
  recordIdempotentMutationResult: vi.fn(),
  recordActionHistory: vi.fn(),
  courseFindUnique: vi.fn(),
  courseUpdate: vi.fn()
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
    course: {
      findUnique: mocks.courseFindUnique,
      update: mocks.courseUpdate
    }
  }
}));

import { PATCH } from "@/app/api/courses/[id]/resources/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.edu",
  name: "Admin User"
};

const courseId = "11111111-1111-4111-8111-111111111111";

function request(body: Record<string, unknown>) {
  return new Request(`https://app.example.test/api/courses/${courseId}/resources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("PATCH /api/courses/[id]/resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue({ response: null, user: adminUser });
    mocks.runApiMutationGuard.mockResolvedValue({ response: null, idempotency: { key: "resource-key" } });
    mocks.courseFindUnique.mockResolvedValue({
      id: courseId,
      syllabusUrl: null,
      canvasShellUrl: null
    });
    mocks.courseUpdate.mockResolvedValue({
      id: courseId,
      syllabusUrl: "https://example.edu/syllabus.pdf",
      canvasShellUrl: "https://canvas.example.edu/template"
    });
  });

  it("requires admin access", async () => {
    mocks.requireAdminUser.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
      user: null
    });

    const response = await PATCH(request({}), { params: Promise.resolve({ id: courseId }) });

    expect(response.status).toBe(403);
    expect(mocks.courseUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-http URLs", async () => {
    const response = await PATCH(request({ syllabusUrl: "javascript:alert(1)", canvasShellUrl: "https://canvas.example.edu/template" }), {
      params: Promise.resolve({ id: courseId })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("http:// or https://");
    expect(mocks.courseUpdate).not.toHaveBeenCalled();
  });

  it("updates course resource links and records history", async () => {
    const response = await PATCH(request({ syllabusUrl: "https://example.edu/syllabus.pdf", canvasShellUrl: "https://canvas.example.edu/template" }), {
      params: Promise.resolve({ id: courseId })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.course.syllabusUrl).toBe("https://example.edu/syllabus.pdf");
    expect(mocks.courseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: courseId },
        data: {
          syllabusUrl: "https://example.edu/syllabus.pdf",
          canvasShellUrl: "https://canvas.example.edu/template"
        }
      })
    );
    expect(mocks.recordActionHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "course_resource_update",
        affectedId: courseId,
        metadata: expect.objectContaining({
          changedFields: ["syllabusUrl", "canvasShellUrl"]
        })
      })
    );
    expect(mocks.recordIdempotentMutationResult).toHaveBeenCalled();
  });
});
