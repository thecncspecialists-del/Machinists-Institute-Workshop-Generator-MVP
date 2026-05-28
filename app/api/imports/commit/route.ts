import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ColumnMapping, parseCourseCatalog } from "@/lib/importParser";
import { saveCourseImportBatch } from "@/lib/importRepository";
import { logBackendError, logBackendEvent } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Import confirmation API.
 *
 * Expects multipart form data with the original file, optional column mapping,
 * and importedBy label. It writes one import batch, immutable normalized course
 * rows, immutable raw row JSON, and linked imported outcomes. It does not update
 * existing imported course records or any external system.
 */
export async function POST(request: Request) {
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

    const mapping = mappingValue ? (JSON.parse(String(mappingValue)) as ColumnMapping) : undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseCourseCatalog(buffer, file.name, mapping);

    const result = await prisma.$transaction((tx) => saveCourseImportBatch(tx, parsed, importedBy));

    return NextResponse.json(result);
  } catch (error) {
    logBackendError("import_confirmed", error);
    return NextResponse.json(
      { error: "The import batch could not be saved. Confirm the database is reachable and the mapping is valid." },
      { status: 500 }
    );
  }
}
