import * as XLSX from "xlsx";
import {
  CourseFieldKey,
  courseFieldDefinitions,
  sourceFieldAliases
} from "@/lib/constants";
import { logBackendEvent } from "@/lib/logger";

type CellValue = string | number | boolean | Date | null;

export type ColumnMapping = Partial<Record<CourseFieldKey, string>>;

export type ImportWarning = {
  severity: "info" | "warning";
  code: string;
  message: string;
  examples?: string[];
};

export type ImportedOutcome = {
  outcomeCode: string | null;
  description: string;
  rowIndex: number;
  rawImportJson: Record<string, unknown>;
};

export type ImportedCourse = {
  rowIndex: number;
  sourceSheet: string;
  externalSource: string;
  externalId: string | null;
  courseCode: string | null;
  courseName: string;
  description: string | null;
  hours: number | null;
  year: number | null;
  quarter: number | null;
  syllabusUrl: string | null;
  canvasShellUrl: string | null;
  physicalInventoryUrl: string | null;
  curriculumUrl: string | null;
  certsUrl: string | null;
  amatrolUrl: string | null;
  toolingUUrl: string | null;
  electudeUrl: string | null;
  developmentStatus: string | null;
  timelineStart: Date | null;
  timelineEnd: Date | null;
  enrollmentTrackerUrl: string | null;
  rawImportJson: Record<string, unknown>;
  outcomes: ImportedOutcome[];
};

export type ParsedCatalog = {
  filename: string;
  sheetName: string;
  headerRowIndex: number;
  columns: string[];
  suggestedMapping: ColumnMapping;
  previewRows: Record<string, unknown>[];
  courses: ImportedCourse[];
  warnings: ImportWarning[];
  rowClassificationCounts: Record<SpreadsheetRowKind, number>;
  sourceRowCount: number;
};

export type SpreadsheetRowKind =
  | "blank"
  | "repeated_header"
  | "subitems_marker"
  | "program_category"
  | "course"
  | "outcome"
  | "ignored";

type NormalizeResult = {
  courses: ImportedCourse[];
  rowClassificationCounts: Record<SpreadsheetRowKind, number>;
};

/**
 * Parse an uploaded Monday spreadsheet export into immutable course reference rows.
 *
 * Handles the irregularities found in the first sample export: title rows before
 * the table, repeated header rows after program breaks, program/category rows,
 * Subitems markers, and CLO rows that need to link to the nearest preceding
 * course. It throws only for file-level problems, and returns warnings for data
 * quality concerns that should not block an import.
 */
export function parseCourseCatalog(
  buffer: Buffer,
  filename: string,
  mappingOverride?: ColumnMapping
): ParsedCatalog {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === "courses outcomes") ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("The workbook does not contain any sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = readSheetRows(sheet);

  if (rows.length === 0) {
    throw new Error("The selected sheet is empty.");
  }

  const headerRowIndex = detectHeaderRow(rows);
  const columns = rows[headerRowIndex].map((value, index) => {
    const header = toText(value);
    return header || `Column ${index + 1}`;
  });
  const suggestedMapping = mappingOverride ?? suggestMapping(columns);
  const { courses, rowClassificationCounts } = normalizeCourses(rows, columns, headerRowIndex, suggestedMapping, sheetName);
  const warnings = buildWarnings(rows, columns, headerRowIndex, courses);
  const previewRows = rows
    .slice(headerRowIndex + 1, headerRowIndex + 11)
    .map((row, offset) => rowToObject(columns, row, headerRowIndex + 2 + offset));

  logBackendEvent("rows_classified", {
    filename,
    sheetName,
    ...rowClassificationCounts
  });
  logBackendEvent("warnings_generated", {
    filename,
    warningCodes: warnings.map((warning) => warning.code)
  });

  return {
    filename,
    sheetName,
    headerRowIndex,
    columns,
    suggestedMapping,
    previewRows,
    courses,
    warnings,
    rowClassificationCounts,
    sourceRowCount: Math.max(rows.length - headerRowIndex - 1, 0)
  };
}

/**
 * Read rows while preserving Excel row positions.
 *
 * Blank rows are intentionally kept because importer warnings and raw row JSON
 * should point to the row numbers a developer or curriculum user sees in Excel.
 */
function readSheetRows(sheet: XLSX.WorkSheet) {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: CellValue[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: CellValue[] = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address] as XLSX.CellObject | undefined;
      const value = readCellValue(cell);
      row.push(value);
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Preserve spreadsheet hyperlinks when SheetJS exposes them.
 *
 * Monday exports often place useful Canvas, syllabus, or tracker links behind
 * display text. The parser stores the target URL when present and otherwise
 * falls back to the visible cell value.
 */
function readCellValue(cell: XLSX.CellObject | undefined): CellValue {
  if (!cell) return null;
  const linkTarget = (cell as XLSX.CellObject & { l?: { Target?: string } }).l?.Target;
  if (linkTarget) return linkTarget;
  if (cell.t === "d" && cell.v instanceof Date) return cell.v;
  if (cell.v === undefined || cell.v === null) return null;
  return cell.v as CellValue;
}

/**
 * Detect the canonical table header row.
 *
 * The Monday export can start with title and program rows before the real
 * table. We scan the first 25 physical rows and choose the row with the most
 * known course-field aliases. If no row is good, row 1 wins and downstream
 * validation will surface the problem through missing fields/warnings.
 */
export function detectHeaderRow(rows: CellValue[][]) {
  let bestIndex = 0;
  let bestScore = -1;

  rows.slice(0, 25).forEach((row, index) => {
    const normalized = row.map((value) => normalizeHeader(toText(value)));
    const score = normalized.reduce((count, header) => {
      return count + (fieldForHeader(header) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

/**
 * Suggest column mapping from recognizable Monday export headers.
 *
 * Assumes the selected header row is already known. Unknown columns are kept in
 * raw_import_json but not mapped to normalized course fields.
 */
function suggestMapping(columns: string[]): ColumnMapping {
  return courseFieldDefinitions.reduce<ColumnMapping>((mapping, field) => {
    const match = columns.find((column) => fieldForHeader(normalizeHeader(column)) === field.key);
    if (match) mapping[field.key] = match;
    return mapping;
  }, {});
}

function normalizeCourses(
  rows: CellValue[][],
  columns: string[],
  headerRowIndex: number,
  mapping: ColumnMapping,
  sheetName: string
): NormalizeResult {
  const indexByField = Object.fromEntries(
    Object.entries(mapping)
      .map(([field, sourceColumn]) => [field, columns.findIndex((column) => column === sourceColumn)])
      .filter(([, index]) => Number(index) >= 0)
  ) as Partial<Record<CourseFieldKey, number>>;

  const courses: ImportedCourse[] = [];
  let currentCourse: ImportedCourse | null = null;
  const rowClassificationCounts = createEmptyClassificationCounts();

  rows.slice(headerRowIndex + 1).forEach((row, rowOffset) => {
    const rowIndex = headerRowIndex + rowOffset + 2;
    const rawImportJson = rowToObject(columns, row, rowIndex);
    const rowKind = classifySpreadsheetRow(row, columns, indexByField);
    rowClassificationCounts[rowKind] += 1;

    if (rowKind === "course") {
      currentCourse = parseCourseRow(row, indexByField, rowIndex, sheetName, rawImportJson);
      courses.push(currentCourse);
      return;
    }

    if (rowKind === "outcome") {
      linkOutcomeToNearestCourse(currentCourse, parseOutcomeRow(row, columns, rowIndex, rawImportJson));
    }
  });

  return { courses, rowClassificationCounts };
}

/**
 * Classify one physical spreadsheet row before deciding what to import.
 *
 * Monday exports mix real course rows with category labels, repeated headers,
 * and Subitems/CLO rows. This explicit classification keeps those business
 * rules in one readable place and prevents accidental imports of UI structure
 * as official course data.
 */
export function classifySpreadsheetRow(
  row: CellValue[],
  columns: string[],
  indexByField: Partial<Record<CourseFieldKey, number>>
): SpreadsheetRowKind {
  if (row.every((value) => !cleanText(value))) return "blank";
  if (isRepeatedHeader(row, columns)) return "repeated_header";
  if (isSubitemsMarker(row)) return "subitems_marker";
  if (isProgramRow(row, indexByField)) return "program_category";
  if (isCourseRow(row, indexByField)) return "course";
  if (isOutcomeRow(row)) return "outcome";
  return "ignored";
}

/**
 * Parse one normalized course row.
 *
 * Assumes classifySpreadsheetRow already identified the row as a course. The
 * returned object is treated as immutable imported reference data after it is
 * saved, and the untouched raw row travels with it for later audit/debugging.
 */
function parseCourseRow(
  row: CellValue[],
  indexByField: Partial<Record<CourseFieldKey, number>>,
  rowIndex: number,
  sheetName: string,
  rawImportJson: Record<string, unknown>
): ImportedCourse {
  return {
    rowIndex,
    sourceSheet: sheetName,
    externalSource: "monday_export",
    externalId: cleanText(readMapped(row, indexByField, "external_id")) ?? `${sheetName}:${rowIndex}`,
    courseCode: cleanText(readMapped(row, indexByField, "course_code")),
    courseName: cleanText(readMapped(row, indexByField, "course_name")) ?? `Untitled course row ${rowIndex}`,
    description: cleanText(readMapped(row, indexByField, "description")),
    hours: parseNumber(readMapped(row, indexByField, "hours")),
    year: parseInteger(readMapped(row, indexByField, "year")),
    quarter: parseInteger(readMapped(row, indexByField, "quarter")),
    syllabusUrl: cleanUrl(readMapped(row, indexByField, "syllabus_url")),
    canvasShellUrl: cleanUrl(readMapped(row, indexByField, "canvas_shell_url")),
    physicalInventoryUrl: cleanUrl(readMapped(row, indexByField, "physical_inventory_url")),
    curriculumUrl: cleanUrl(readMapped(row, indexByField, "curriculum_url")),
    certsUrl: cleanUrl(readMapped(row, indexByField, "certs_url")),
    amatrolUrl: cleanUrl(readMapped(row, indexByField, "amatrol_url")),
    toolingUUrl: cleanUrl(readMapped(row, indexByField, "tooling_u_url")),
    electudeUrl: cleanUrl(readMapped(row, indexByField, "electude_url")),
    developmentStatus: cleanText(readMapped(row, indexByField, "development_status")),
    timelineStart: parseDate(readMapped(row, indexByField, "timeline_start")),
    timelineEnd: parseDate(readMapped(row, indexByField, "timeline_end")),
    enrollmentTrackerUrl: cleanUrl(readMapped(row, indexByField, "enrollment_tracker_url")),
    rawImportJson,
    outcomes: []
  };
}

/**
 * Parse a CLO/subitem row.
 *
 * Assumes the row follows Monday's Subitems layout where CLO code and outcome
 * text are usually in the second and third columns. Rows without both pieces
 * are ignored rather than guessed.
 */
export function parseOutcomeRow(
  row: CellValue[],
  columns: string[],
  rowIndex: number,
  rawImportJson: Record<string, unknown>
): ImportedOutcome | null {
  const firstCell = cleanText(row[0]);
  const secondCell = cleanText(row[1]);
  const thirdCell = cleanText(row[2]);
  const outcomeCode = firstCell?.match(/^CLO\d+/i) ? firstCell : secondCell?.match(/^CLO\d+/i) ? secondCell : null;
  const description = thirdCell ?? (outcomeCode === firstCell ? cleanText(row[1]) : null);

  if (!outcomeCode || !description) return null;

  return {
    outcomeCode,
    description,
    rowIndex,
    rawImportJson: {
      ...rawImportJson,
      sourceColumns: columns
    }
  };
}

/**
 * Link a CLO row to the nearest preceding course row.
 *
 * The spreadsheet represents outcomes as visual subitems below a course, not as
 * a separate relational table. We preserve that hierarchy by attaching each
 * parsed outcome to the most recent course; orphaned CLO rows are left out
 * because guessing would corrupt reference data.
 */
export function linkOutcomeToNearestCourse(course: ImportedCourse | null, outcome: ImportedOutcome | null) {
  if (course && outcome) course.outcomes.push(outcome);
}

/**
 * Build non-blocking import warnings.
 *
 * Warnings document suspicious source data (for example embedded headers or
 * hour outliers) without preventing a batch save. This keeps the import useful
 * for reference while giving developers traceability for cleanup.
 */
function buildWarnings(
  rows: CellValue[][],
  columns: string[],
  headerRowIndex: number,
  courses: ImportedCourse[]
): ImportWarning[] {
  const repeatedHeaderRows = rows
    .map((row, index) => (index > headerRowIndex && isRepeatedHeader(row, columns) ? index + 1 : null))
    .filter(Boolean) as number[];
  const subitemRows = rows
    .map((row, index) => (index > headerRowIndex && isSubitemsMarker(row) ? index + 1 : null))
    .filter(Boolean) as number[];

  const warnings: ImportWarning[] = [];

  if (repeatedHeaderRows.length > 0) {
    warnings.push({
      severity: "warning",
      code: "embedded_headers",
      message: `Detected ${repeatedHeaderRows.length} repeated header rows inside the sheet body.`,
      examples: repeatedHeaderRows.slice(0, 8).map(String)
    });
  }

  if (subitemRows.length > 0) {
    warnings.push({
      severity: "info",
      code: "subitems",
      message: `Detected ${subitemRows.length} Subitems marker rows. CLO rows will be preserved as course outcomes where possible.`,
      examples: subitemRows.slice(0, 8).map(String)
    });
  }

  const invalidYears = courses.filter((course) => course.year !== null && (course.year < 1990 || course.year > 2100));
  const invalidQuarters = courses.filter(
    (course) => course.quarter !== null && ![1, 2, 3, 4].includes(course.quarter)
  );

  if (invalidYears.length > 0) {
    warnings.push({
      severity: "warning",
      code: "invalid_year",
      message: `${invalidYears.length} normalized course rows contain a year outside the expected range.`,
      examples: invalidYears.slice(0, 5).map((course) => `${course.courseName}: ${course.year}`)
    });
  }

  if (invalidQuarters.length > 0) {
    warnings.push({
      severity: "warning",
      code: "invalid_quarter",
      message: `${invalidQuarters.length} normalized course rows contain a quarter outside 1-4.`,
      examples: invalidQuarters.slice(0, 5).map((course) => `${course.courseName}: ${course.quarter}`)
    });
  }

  const hourValues = courses.map((course) => course.hours).filter((value): value is number => value !== null);
  const average = hourValues.reduce((sum, value) => sum + value, 0) / Math.max(hourValues.length, 1);
  const variance =
    hourValues.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / Math.max(hourValues.length, 1);
  const standardDeviation = Math.sqrt(variance);
  const outliers = courses.filter(
    (course) => course.hours !== null && standardDeviation > 0 && Math.abs(course.hours - average) / standardDeviation >= 4
  );

  if (outliers.length > 0) {
    warnings.push({
      severity: "warning",
      code: "hours_outlier",
      message: `${outliers.length} course rows contain unusually large or small hours values.`,
      examples: outliers.slice(0, 5).map((course) => `${course.courseName}: ${course.hours}`)
    });
  }

  const missingnessFields: CourseFieldKey[] = ["hours", "year", "quarter", "syllabus_url", "canvas_shell_url"];
  missingnessFields.forEach((field) => {
    const missingCount = courses.filter((course) => course[camelCourseKey(field)] === null).length;
    if (courses.length > 0 && missingCount / courses.length >= 0.5) {
      warnings.push({
        severity: "info",
        code: `missing_${field}`,
        message: `${missingCount} of ${courses.length} normalized courses are missing ${field.replaceAll("_", " ")}.`
      });
    }
  });

  return warnings;
}

function camelCourseKey(field: CourseFieldKey) {
  const map = {
    course_name: "courseName",
    external_id: "externalId",
    course_code: "courseCode",
    syllabus_url: "syllabusUrl",
    canvas_shell_url: "canvasShellUrl",
    physical_inventory_url: "physicalInventoryUrl",
    curriculum_url: "curriculumUrl",
    certs_url: "certsUrl",
    amatrol_url: "amatrolUrl",
    tooling_u_url: "toolingUUrl",
    electude_url: "electudeUrl",
    development_status: "developmentStatus",
    timeline_start: "timelineStart",
    timeline_end: "timelineEnd",
    enrollment_tracker_url: "enrollmentTrackerUrl",
    description: "description",
    hours: "hours",
    year: "year",
    quarter: "quarter"
  } satisfies Record<CourseFieldKey, keyof ImportedCourse>;

  return map[field];
}

function fieldForHeader(normalizedHeader: string): CourseFieldKey | null {
  for (const [field, aliases] of Object.entries(sourceFieldAliases) as [CourseFieldKey, string[]][]) {
    if (aliases.map(normalizeHeader).includes(normalizedHeader)) return field;
  }
  return null;
}

/**
 * Repeated Monday export header rows can appear inside the sheet after program
 * breaks. These rows should be skipped so they are not imported as courses.
 */
function isRepeatedHeader(row: CellValue[], columns: string[]) {
  const matches = row.reduce<number>((count, value, index) => {
    return count + (normalizeHeader(toText(value)) === normalizeHeader(columns[index] ?? "") ? 1 : 0);
  }, 0);

  return matches >= 5;
}

function isSubitemsMarker(row: CellValue[]) {
  return normalizeHeader(toText(row[0])) === "subitems";
}

/**
 * Program/category rows are section labels like "BASC - Basic Academic Skills".
 * They contain a name but no real course detail, so importing them as courses
 * would pollute the catalog and confuse AI context.
 */
function isProgramRow(row: CellValue[], indexByField: Partial<Record<CourseFieldKey, number>>) {
  const courseNameIndex = indexByField.course_name ?? 0;
  const courseName = cleanText(row[courseNameIndex]);
  const nonEmptyCount = row.filter((value) => cleanText(value)).length;
  return Boolean(courseName && nonEmptyCount <= 2 && !cleanText(row[indexByField.description ?? -1]));
}

function isCourseRow(row: CellValue[], indexByField: Partial<Record<CourseFieldKey, number>>) {
  const courseName = cleanText(readMapped(row, indexByField, "course_name"));
  const description = cleanText(readMapped(row, indexByField, "description"));
  const courseCode = cleanText(readMapped(row, indexByField, "course_code"));
  const developmentStatus = cleanText(readMapped(row, indexByField, "development_status"));
  return Boolean(courseName && (description || courseCode || developmentStatus));
}

function isOutcomeRow(row: CellValue[]) {
  const firstCell = cleanText(row[0]);
  const secondCell = cleanText(row[1]);
  return Boolean(firstCell?.match(/^CLO\d+/i) || secondCell?.match(/^CLO\d+/i));
}

function createEmptyClassificationCounts(): Record<SpreadsheetRowKind, number> {
  return {
    blank: 0,
    repeated_header: 0,
    subitems_marker: 0,
    program_category: 0,
    course: 0,
    outcome: 0,
    ignored: 0
  };
}

function readMapped(row: CellValue[], indexByField: Partial<Record<CourseFieldKey, number>>, field: CourseFieldKey) {
  const index = indexByField[field];
  if (index === undefined || index < 0) return null;
  return row[index] ?? null;
}

function rowToObject(columns: string[], row: CellValue[], rowIndex: number) {
  const usedHeaders = new Map<string, number>();
  const object: Record<string, unknown> = { rowIndex };

  columns.forEach((column, index) => {
    const baseKey = column || `Column ${index + 1}`;
    const seen = usedHeaders.get(baseKey) ?? 0;
    usedHeaders.set(baseKey, seen + 1);
    const key = seen === 0 ? baseKey : `${baseKey}_${seen + 1}`;
    object[key] = serializeCell(row[index] ?? null);
  });

  return object;
}

function serializeCell(value: CellValue) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function cleanText(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function cleanUrl(value: CellValue | undefined): string | null {
  const text = cleanText(value);
  if (!text || /^n\/a$/i.test(text)) return null;
  const normalized = text.replace(/[\u0000-\u001F\u007F]/g, "").trim();

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseNumber(value: CellValue | undefined) {
  const text = cleanText(value);
  if (!text) return null;
  const number = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseInteger(value: CellValue | undefined) {
  const number = parseNumber(value);
  return number === null ? null : Math.trunc(number);
}

function parseDate(value: CellValue | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toText(value: CellValue | undefined) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[*()]/g, "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
