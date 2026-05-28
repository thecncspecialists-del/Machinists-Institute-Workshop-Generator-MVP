import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { classifySpreadsheetRow, parseCourseCatalog } from "@/lib/importParser";

describe("parseCourseCatalog", () => {
  const samplePath = path.join(process.cwd(), "Courses_Outcomes_1778874836.xlsx");

  it("detectsHeaderRowBeforeNormalizingCourseRows", () => {
    const parsed = parseCourseCatalog(fs.readFileSync(samplePath), "Courses_Outcomes_1778874836.xlsx");

    expect(parsed.sheetName).toBe("courses & outcomes");
    expect(parsed.headerRowIndex + 1).toBe(5);
    expect(parsed.columns).toContain("Name");
    expect(parsed.columns).toContain("Code");
    expect(parsed.courses.length).toBeGreaterThan(100);
    expect(parsed.courses.some((course) => course.courseName === "Name")).toBe(false);
    expect(parsed.courses.some((course) => course.courseName === "Subitems")).toBe(false);
  });

  it("linksCloRowsToNearestPrecedingCourse", () => {
    const parsed = parseCourseCatalog(fs.readFileSync(samplePath), "Courses_Outcomes_1778874836.xlsx");
    const digitalLiteracy = parsed.courses.find((course) => course.courseCode === "BASC 001");

    expect(digitalLiteracy?.courseName).toBe("Digital Literacy");
    expect(digitalLiteracy?.outcomes.length).toBeGreaterThanOrEqual(3);
    expect(digitalLiteracy?.outcomes[0].outcomeCode).toMatch(/^CLO/);
  });

  it("skipsRepeatedHeaderRowsInsideSpreadsheet", () => {
    const parsed = parseCourseCatalog(fs.readFileSync(samplePath), "Courses_Outcomes_1778874836.xlsx");
    const headerRow = ["Name", "Courses", "(*AI) Description", "Hrs", "Code", "Yr", "Qtr"];
    const rowKind = classifySpreadsheetRow(headerRow, headerRow, {
      course_name: 0,
      description: 2,
      hours: 3,
      course_code: 4,
      year: 5,
      quarter: 6
    });

    expect(rowKind).toBe("repeated_header");
    expect(parsed.rowClassificationCounts.repeated_header).toBeGreaterThan(0);
  });

  it("doesNotImportProgramCategoryRowsAsCourses", () => {
    const parsed = parseCourseCatalog(fs.readFileSync(samplePath), "Courses_Outcomes_1778874836.xlsx");

    expect(parsed.courses.some((course) => course.courseName === "BASC – Basic Academic Skills")).toBe(false);
    expect(parsed.rowClassificationCounts.program_category).toBeGreaterThan(0);
  });

  it("surfacesKnownStructuralWarningsWithoutBlockingImport", () => {
    const parsed = parseCourseCatalog(fs.readFileSync(samplePath), "Courses_Outcomes_1778874836.xlsx");
    const warningCodes = parsed.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain("embedded_headers");
    expect(warningCodes).toContain("subitems");
    expect(parsed.warnings.length).toBeGreaterThan(1);
  });

  it("keepsOnlyHttpLinksInNormalizedUrlFields", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Name", "(*AI) Description", "Syllabus", "Course Shell"],
      ["Safety Practice", "Practice safe startup checks.", "javascript:alert(1)", "https://example.com/canvas"]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "courses & outcomes");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const parsed = parseCourseCatalog(Buffer.from(buffer), "links.xlsx");

    expect(parsed.courses[0].syllabusUrl).toBeNull();
    expect(parsed.courses[0].canvasShellUrl).toBe("https://example.com/canvas");
  });
});
