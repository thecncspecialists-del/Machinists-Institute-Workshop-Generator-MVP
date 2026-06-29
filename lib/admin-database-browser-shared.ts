export const databaseBrowserDatasetIds = [
  "users",
  "courses",
  "course-outcomes",
  "course-links",
  "course-workspaces",
  "workshops",
  "units",
  "external-lms-catalog",
  "curriculum-assets",
  "debug-requests",
  "action-history",
  "import-batches"
] as const;

export type DatabaseBrowserDataset = (typeof databaseBrowserDatasetIds)[number];
export type SortDirection = "asc" | "desc";

export type DatabaseBrowserColumn = {
  key: string;
  label: string;
  sortable?: boolean;
};

export const courseLinkFields = [
  "syllabusUrl",
  "canvasShellUrl",
  "physicalInventoryUrl",
  "curriculumUrl",
  "certsUrl",
  "amatrolUrl",
  "toolingUUrl",
  "electudeUrl",
  "enrollmentTrackerUrl"
] as const;

export type CourseLinkField = (typeof courseLinkFields)[number];

export const courseLinkLabels: Record<CourseLinkField, string> = {
  syllabusUrl: "Syllabus",
  canvasShellUrl: "Course Template",
  physicalInventoryUrl: "Physical Inventory",
  curriculumUrl: "Curriculum",
  certsUrl: "Certifications",
  amatrolUrl: "Amatrol",
  toolingUUrl: "Tooling U",
  electudeUrl: "Electude",
  enrollmentTrackerUrl: "Enrollment Tracker"
};

export type DatabaseBrowserRow = {
  id: string;
  cells: Record<string, string>;
  details: Record<string, string>;
  courseLinks?: {
    courseId: string;
    links: Record<CourseLinkField, string>;
  };
};

export type DatabaseBrowserResult = {
  dataset: DatabaseBrowserDataset;
  datasetLabel: string;
  columns: DatabaseBrowserColumn[];
  rows: DatabaseBrowserRow[];
  page: number;
  pageSize: number;
  total: number;
  sort: string;
  direction: SortDirection;
  filters: Record<string, string>;
};

export const databaseBrowserDatasets: Array<{ id: DatabaseBrowserDataset; label: string }> = [
  { id: "users", label: "Users" },
  { id: "courses", label: "Courses" },
  { id: "course-outcomes", label: "Course Outcomes" },
  { id: "course-links", label: "Course Links" },
  { id: "course-workspaces", label: "Course Workspaces" },
  { id: "workshops", label: "Workshops" },
  { id: "units", label: "Units" },
  { id: "external-lms-catalog", label: "External LMS Catalog" },
  { id: "curriculum-assets", label: "Curriculum Assets" },
  { id: "debug-requests", label: "Debug Requests" },
  { id: "action-history", label: "Action History" },
  { id: "import-batches", label: "Import Batches" }
];

export const pageSizeOptions = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;
export const REPORT_ROW_LIMIT = 5000;
