import type { Prisma, PrismaClient } from "@prisma/client";
import type { ParsedCatalog } from "@/lib/importParser";
import { logBackendEvent } from "@/lib/logger";

type ImportWriteClient = PrismaClient | Prisma.TransactionClient;

/**
 * Import persistence for spreadsheet batches.
 *
 * All writes that create imported reference data live here. The functions are
 * deliberately explicit because imported course rows are official reference
 * data for drafting and should not be updated indirectly by AI generation,
 * asset editing, or later UI convenience helpers.
 */
export async function saveCourseImportBatch(
  db: ImportWriteClient,
  parsed: ParsedCatalog,
  importedBy: string
) {
  await db.contributor.upsert({
    where: { displayName: importedBy },
    update: {},
    create: { displayName: importedBy }
  });

  const batch = await db.courseImportBatch.create({
    data: {
      filename: parsed.filename,
      source: "spreadsheet",
      importedBy,
      rowCount: parsed.sourceRowCount,
      notes: JSON.stringify({
        sheetName: parsed.sheetName,
        warnings: parsed.warnings
      })
    }
  });

  for (const course of parsed.courses) {
    const savedCourse = await db.course.create({
      data: {
        sourceImportBatchId: batch.id,
        externalSource: course.externalSource,
        externalId: course.externalId,
        courseCode: course.courseCode,
        courseName: course.courseName,
        description: course.description,
        hours: course.hours,
        year: course.year,
        quarter: course.quarter,
        syllabusUrl: course.syllabusUrl,
        canvasShellUrl: course.canvasShellUrl,
        physicalInventoryUrl: course.physicalInventoryUrl,
        curriculumUrl: course.curriculumUrl,
        certsUrl: course.certsUrl,
        amatrolUrl: course.amatrolUrl,
        toolingUUrl: course.toolingUUrl,
        electudeUrl: course.electudeUrl,
        developmentStatus: course.developmentStatus,
        timelineStart: course.timelineStart,
        timelineEnd: course.timelineEnd,
        enrollmentTrackerUrl: course.enrollmentTrackerUrl,
        rawImportJson: course.rawImportJson as Prisma.InputJsonValue
      }
    });

    if (course.outcomes.length > 0) {
      await db.courseOutcome.createMany({
        data: course.outcomes.map((outcome) => ({
          courseId: savedCourse.id,
          outcomeCode: outcome.outcomeCode,
          description: outcome.description,
          rowIndex: outcome.rowIndex,
          rawImportJson: outcome.rawImportJson as Prisma.InputJsonValue
        }))
      });
    }
  }

  logBackendEvent("import_confirmed", {
    batchId: batch.id,
    courseCount: parsed.courses.length,
    outcomeCount: parsed.courses.reduce((sum, course) => sum + course.outcomes.length, 0),
    warningCount: parsed.warnings.length
  });

  return {
    batchId: batch.id,
    courseCount: parsed.courses.length,
    outcomeCount: parsed.courses.reduce((sum, course) => sum + course.outcomes.length, 0)
  };
}
