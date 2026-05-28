import { NextResponse } from "next/server";
import { parseCourseCatalog } from "@/lib/importParser";
import { logBackendError, logBackendEvent } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Import preview API.
 *
 * Expects multipart form data with one XLSX/CSV file. It parses and classifies
 * rows, returns detected columns, sample normalized courses, and warnings, but
 * does not write to the database. This protects imported reference data until
 * a user explicitly confirms the batch.
 */
export async function POST(request: Request) {
  try {
    logBackendEvent("import_started", { mode: "preview" });
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload an XLSX or CSV file." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseCourseCatalog(buffer, file.name);

    logBackendEvent("import_preview_generated", {
      filename: parsed.filename,
      courseCount: parsed.courses.length,
      outcomeCount: parsed.courses.reduce((sum, course) => sum + course.outcomes.length, 0),
      warningCount: parsed.warnings.length
    });

    return NextResponse.json({
      filename: parsed.filename,
      sheetName: parsed.sheetName,
      headerRowIndex: parsed.headerRowIndex,
      columns: parsed.columns,
      suggestedMapping: parsed.suggestedMapping,
      previewRows: parsed.previewRows,
      courseCount: parsed.courses.length,
      outcomeCount: parsed.courses.reduce((sum, course) => sum + course.outcomes.length, 0),
      warnings: parsed.warnings,
      sampleCourses: parsed.courses.slice(0, 8).map((course) => ({
        rowIndex: course.rowIndex,
        courseCode: course.courseCode,
        courseName: course.courseName,
        description: course.description,
        hours: course.hours,
        year: course.year,
        quarter: course.quarter,
        developmentStatus: course.developmentStatus,
        outcomeCount: course.outcomes.length
      }))
    });
  } catch (error) {
    logBackendError("import_preview_generated", error);
    return NextResponse.json(
      { error: "The spreadsheet preview could not be generated. Check that the file is a valid XLSX or CSV export." },
      { status: 400 }
    );
  }
}
