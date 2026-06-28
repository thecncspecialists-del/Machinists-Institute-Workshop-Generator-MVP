import { ActionHistoryStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { ColumnMapping, parseCourseCatalog } from "@/lib/importParser";
import { saveCourseImportBatch } from "@/lib/importRepository";
import { logBackendError, logBackendEvent } from "@/lib/logger";
import { requireStaffUser } from "@/lib/require-staff-user";
import { isFileWithinLimit, VALIDATION_LIMITS } from "@/lib/validation-limits";

export const runtime = "nodejs";

const IMPORT_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 60000
};

/**
 * Import confirmation API.
 *
 * Expects multipart form data with the original file, optional column mapping,
 * and importedBy label. It writes one import batch, immutable normalized course
 * rows, immutable raw row JSON, and linked imported outcomes. It does not update
 * existing imported course records or any external system.
 */
export async function POST(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let importMetadata: Record<string, unknown> = {};
  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "course_import",
    guardActionType: "import_commit_guard",
    idempotencyActionType: "import_commit",
    rateLimit: {
      actionTypes: ["import_commit", "import_commit_guard"],
      max: 12,
      windowMs: 15 * 60 * 1000
    }
  });
  if (guard.response) {
    return guard.response;
  }

  try {
    logBackendEvent("import_started", { mode: "commit" });
    const formData = await request.formData();
    const file = formData.get("file");
    const mappingValue = formData.get("mapping");
    const importedBy = String(
      formData.get("importedBy") || process.env.APP_DEFAULT_CONTRIBUTOR || "Curriculum Community"
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an XLSX or CSV file." }, { status: 400 });
    }
    if (!isFileWithinLimit(file)) {
      return NextResponse.json({ error: `Import files must be ${VALIDATION_LIMITS.importFileMaxBytes} bytes or smaller.` }, { status: 413 });
    }

    const mapping = parseColumnMapping(mappingValue);
    if (mapping instanceof Response) {
      return mapping;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseCourseCatalog(buffer, file.name, mapping);
    importMetadata = {
      filename: parsed.filename,
      courseCount: parsed.courses.length,
      outcomeCount: parsed.courses.reduce((sum, course) => sum + course.outcomes.length, 0),
      warningCount: parsed.warnings.length
    };

    const result = await prisma.$transaction(
      (tx) => saveCourseImportBatch(tx, parsed, importedBy),
      IMPORT_TRANSACTION_OPTIONS
    );

    await recordActionHistory({
      actor,
      actionType: "import_commit",
      description: "Committed course catalog import batch.",
      area: "course_import",
      affectedType: "course_import_batch",
      affectedId: typeof result.batchId === "string" ? result.batchId : null,
      status: ActionHistoryStatus.SUCCESS,
      metadata: importMetadata as Prisma.InputJsonObject
    });

    return NextResponse.json(result);
  } catch (error) {
    logBackendError("import_confirmed", error, {
      ...importMetadata,
      ...getPrismaErrorDetails(error)
    });
    return NextResponse.json(
      { error: "The import batch could not be saved. Confirm the database is reachable and the mapping is valid." },
      { status: 500 }
    );
  }
}

function parseColumnMapping(mappingValue: FormDataEntryValue | null): ColumnMapping | undefined | Response {
  if (!mappingValue) return undefined;

  try {
    return JSON.parse(String(mappingValue)) as ColumnMapping;
  } catch {
    return NextResponse.json({ error: "Column mapping is not valid JSON." }, { status: 400 });
  }
}

function getPrismaErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const errorRecord = error as { code?: unknown; message?: unknown };

  return {
    prismaCode: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
    prismaMessage: typeof errorRecord.message === "string" ? errorRecord.message : undefined
  };
}
