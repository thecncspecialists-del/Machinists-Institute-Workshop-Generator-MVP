import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ColumnMapping, parseCourseCatalog } from "@/lib/importParser";
import { saveCourseImportBatch } from "@/lib/importRepository";
import { logBackendError, logBackendEvent } from "@/lib/logger";
import { requireStaffUser } from "@/lib/require-staff-user";

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
  if (authResult.response) {
    return authResult.response;
  }

  let importMetadata: Record<string, unknown> = {};

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
