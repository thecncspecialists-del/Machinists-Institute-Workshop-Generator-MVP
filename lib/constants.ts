export const assetTypes = [
  "Homepage",
  "Workshop",
  "Activity",
  "Discussion Prompt",
  "Quiz"
] as const;

export type AssetType = (typeof assetTypes)[number];

export const activeAssetTypes = ["Workshop", "Activity"] as const satisfies readonly AssetType[];

export type ActiveAssetType = (typeof activeAssetTypes)[number];

export const assetStatuses = [
  "Draft",
  "Needs Review",
  "Approved",
  "Published Manually to Canvas",
  "Archived"
] as const;

export type AssetStatus = (typeof assetStatuses)[number];

export const editableInputFields = [
  { key: "topic", label: "Topic or focus area", type: "text" },
  { key: "audience", label: "Audience or learner level", type: "text" },
  { key: "learningOutcomes", label: "Learning outcomes", type: "textarea" },
  { key: "duration", label: "Duration", type: "text" },
  { key: "materials", label: "Materials", type: "textarea" },
  { key: "equipment", label: "Equipment", type: "textarea" },
  { key: "preparationNotes", label: "Preparation notes", type: "textarea" },
  { key: "instructorNotes", label: "Instructor notes", type: "textarea" },
  { key: "studentInstructions", label: "Student instructions", type: "textarea" },
  { key: "assessment", label: "Assessment or evidence of learning", type: "textarea" },
  { key: "references", label: "References or web links", type: "textarea" },
  { key: "additionalConstraints", label: "Additional constraints", type: "textarea" }
] as const;

export type CurriculumInputKey = (typeof editableInputFields)[number]["key"];
export type CurriculumInput = Partial<Record<CurriculumInputKey, string>>;

export const courseFieldDefinitions = [
  { key: "course_name", label: "Course name", required: true },
  { key: "external_id", label: "External ID" },
  { key: "description", label: "Description" },
  { key: "hours", label: "Hours" },
  { key: "course_code", label: "Course code" },
  { key: "year", label: "Year" },
  { key: "quarter", label: "Quarter" },
  { key: "syllabus_url", label: "Syllabus link" },
  { key: "canvas_shell_url", label: "Course Shell / Canvas link" },
  { key: "physical_inventory_url", label: "Physical Inventory" },
  { key: "curriculum_url", label: "Curriculum" },
  { key: "certs_url", label: "Certs" },
  { key: "amatrol_url", label: "Amatrol" },
  { key: "tooling_u_url", label: "Tooling-U" },
  { key: "electude_url", label: "Electude" },
  { key: "development_status", label: "Development Status" },
  { key: "timeline_start", label: "Timeline Start" },
  { key: "timeline_end", label: "Timeline End" },
  { key: "enrollment_tracker_url", label: "Enrollment Tracker" }
] as const;

export type CourseFieldKey = (typeof courseFieldDefinitions)[number]["key"];

export const sourceFieldAliases: Record<CourseFieldKey, string[]> = {
  course_name: ["name", "course name", "course"],
  external_id: ["courses", "external id", "monday id"],
  description: ["(*ai) description", "ai description", "description", "course description"],
  hours: ["hrs", "hours"],
  course_code: ["code", "course code"],
  year: ["yr", "year"],
  quarter: ["qtr", "quarter"],
  syllabus_url: ["syllabus", "syllabus link", "syllabus url"],
  canvas_shell_url: ["course shell", "canvas shell", "canvas shell link", "canvas url"],
  physical_inventory_url: ["physical inventory"],
  curriculum_url: ["curriculum"],
  certs_url: ["certs", "certifications"],
  amatrol_url: ["amatrol"],
  tooling_u_url: ["tooling-u", "tooling u", "toolingu"],
  electude_url: ["electude"],
  development_status: ["development status", "status"],
  timeline_start: ["timeline - start", "timeline start", "start"],
  timeline_end: ["timeline - end", "timeline end", "end"],
  enrollment_tracker_url: ["enrollment tracker", "enrollment tracker link"]
};
