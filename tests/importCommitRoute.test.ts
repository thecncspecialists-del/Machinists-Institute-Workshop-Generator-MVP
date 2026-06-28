import { describe, expect, it, vi, beforeEach } from "vitest";

const transactionMock = vi.fn();
const parseCourseCatalogMock = vi.fn();
const saveCourseImportBatchMock = vi.fn();
const logBackendErrorMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock
  }
}));

vi.mock("@/lib/importParser", () => ({
  parseCourseCatalog: parseCourseCatalogMock
}));

vi.mock("@/lib/importRepository", () => ({
  saveCourseImportBatch: saveCourseImportBatchMock
}));

vi.mock("@/lib/logger", () => ({
  logBackendEvent: vi.fn(),
  logBackendError: logBackendErrorMock
}));

vi.mock("@/lib/api-mutation-guards", () => ({
  runApiMutationGuard: vi.fn(async () => ({
    response: null,
    idempotency: { key: null }
  }))
}));

vi.mock("@/lib/action-history", () => ({
  recordActionHistory: vi.fn()
}));

vi.mock("@/lib/require-staff-user", () => ({
  requireStaffUser: vi.fn(async () => ({
    response: null,
    user: {
      id: "user-1",
      email: "staff@example.edu",
      name: "Staff User",
      role: "STAFF"
    }
  }))
}));

describe("POST /api/imports/commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveCourseImportBatchMock.mockResolvedValue({
      batchId: "batch-1",
      courseCount: 1,
      outcomeCount: 1
    });
    transactionMock.mockImplementation(async (callback) => callback({ tx: true }));
    parseCourseCatalogMock.mockReturnValue(buildParsedCatalog());
  });

  it("uses an extended transaction timeout when saving import batches", async () => {
    const { POST } = await import("@/app/api/imports/commit/route");
    const response = await POST(buildCommitRequest({ mapping: JSON.stringify({ course_name: "Name" }) }));

    expect(response.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10000,
      timeout: 60000
    });
    expect(saveCourseImportBatchMock).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({ filename: "catalog.xlsx" }),
      "Curriculum Community"
    );
  });

  it("returns a 400 response for invalid mapping JSON before saving", async () => {
    const { POST } = await import("@/app/api/imports/commit/route");
    const response = await POST(buildCommitRequest({ mapping: "{" }));

    await expect(response.json()).resolves.toEqual({ error: "Column mapping is not valid JSON." });
    expect(response.status).toBe(400);
    expect(parseCourseCatalogMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("logs Prisma details and import size metadata when saving fails", async () => {
    transactionMock.mockRejectedValue(Object.assign(new Error("Transaction already closed"), { code: "P2028" }));

    const { POST } = await import("@/app/api/imports/commit/route");
    const response = await POST(buildCommitRequest({ mapping: JSON.stringify({ course_name: "Name" }) }));

    expect(response.status).toBe(500);
    expect(logBackendErrorMock).toHaveBeenCalledWith(
      "import_confirmed",
      expect.objectContaining({ code: "P2028" }),
      expect.objectContaining({
        filename: "catalog.xlsx",
        courseCount: 1,
        outcomeCount: 1,
        warningCount: 0,
        prismaCode: "P2028",
        prismaMessage: "Transaction already closed"
      })
    );
  });
});

function buildCommitRequest({ mapping }: { mapping?: string }) {
  const formData = new FormData();
  formData.append("file", new File(["course data"], "catalog.xlsx"));
  if (mapping !== undefined) formData.append("mapping", mapping);

  return new Request("http://localhost/api/imports/commit", {
    method: "POST",
    body: formData
  });
}

function buildParsedCatalog() {
  return {
    filename: "catalog.xlsx",
    sheetName: "courses & outcomes",
    headerRowIndex: 0,
    columns: ["Name"],
    suggestedMapping: { course_name: "Name" },
    previewRows: [],
    courses: [
      {
        courseName: "Safety Basics",
        outcomes: [{ description: "Follow shop safety procedures." }]
      }
    ],
    warnings: [],
    rowClassificationCounts: {
      blank: 0,
      repeated_header: 0,
      subitems_marker: 0,
      program_category: 0,
      course: 1,
      outcome: 1,
      ignored: 0
    },
    sourceRowCount: 1
  };
}
