import { logBackendEvent } from "@/lib/logger";

/**
 * Workshop output validation and Canvas rendering.
 *
 * This module turns model JSON into predictable rich text and HTML. It does not
 * call the AI provider, fetch course data, or repair imported reference fields.
 * Its main guardrail is template preservation: every expected heading remains
 * present, and underspecified sections render blank instead of being invented.
 */
export type StructuredAssetSection = {
  id: string;
  heading: string;
  audience: "Instructor" | "Student" | "Both" | string;
  content: string | string[] | null;
};

export type StructuredAsset = {
  assetType: "Workshop" | string;
  draftNotice: string;
  title: string;
  sections: StructuredAssetSection[];
};

export const workshopSectionTemplate: StructuredAssetSection[] = [
  { id: "overview", heading: "Workshop Overview", audience: "Instructor", content: "" },
  { id: "course_context", heading: "Course Context", audience: "Instructor", content: "" },
  { id: "learning_outcomes", heading: "Learning Outcomes", audience: "Both", content: "" },
  { id: "duration_and_timing", heading: "Duration and Timing", audience: "Instructor", content: "" },
  { id: "materials_and_equipment", heading: "Materials and Equipment", audience: "Instructor", content: "" },
  { id: "preparation", heading: "Preparation", audience: "Instructor", content: "" },
  { id: "facilitation_plan", heading: "Facilitation Plan", audience: "Instructor", content: "" },
  { id: "student_instructions", heading: "Student Instructions", audience: "Student", content: "" },
  { id: "activity_steps", heading: "Activity Steps", audience: "Student", content: "" },
  { id: "discussion_or_reflection", heading: "Discussion or Reflection", audience: "Both", content: "" },
  { id: "assessment", heading: "Assessment or Evidence of Learning", audience: "Instructor", content: "" },
  { id: "references", heading: "References and Links", audience: "Both", content: "" },
  { id: "review_notes", heading: "Human Review Notes", audience: "Instructor", content: "" }
];

export const activitySectionTemplate: StructuredAssetSection[] = [
  { id: "overview", heading: "Activity Overview", audience: "Instructor", content: "" },
  { id: "course_context", heading: "Course Context", audience: "Instructor", content: "" },
  { id: "learning_outcomes", heading: "Learning Outcomes", audience: "Both", content: "" },
  { id: "duration_and_timing", heading: "Duration and Timing", audience: "Instructor", content: "" },
  { id: "materials_and_equipment", heading: "Materials and Equipment", audience: "Instructor", content: "" },
  { id: "preparation", heading: "Preparation", audience: "Instructor", content: "" },
  { id: "facilitation_plan", heading: "Facilitation Plan", audience: "Instructor", content: "" },
  { id: "student_instructions", heading: "Student Instructions", audience: "Student", content: "" },
  { id: "activity_steps", heading: "Activity Steps", audience: "Student", content: "" },
  { id: "practice_checks", heading: "Practice Checks", audience: "Both", content: "" },
  { id: "assessment", heading: "Assessment or Evidence of Learning", audience: "Instructor", content: "" },
  { id: "references", heading: "References and Links", audience: "Both", content: "" },
  { id: "review_notes", heading: "Human Review Notes", audience: "Instructor", content: "" }
];

/**
 * Validate and normalize Workshop JSON returned by the model.
 *
 * The model may omit sections or return extra sections. We keep only the
 * approved template headings, preserve blank sections, and ignore unexpected
 * structure so Canvas output remains auditable and predictable.
 */
export function validateWorkshopOutput(raw: unknown, fallbackTitle: string): StructuredAsset {
  return validateAssetOutput(raw, "Workshop", fallbackTitle);
}

export function validateActivityOutput(raw: unknown, fallbackTitle: string): StructuredAsset {
  return validateAssetOutput(raw, "Activity", fallbackTitle);
}

export function validateAssetOutput(raw: unknown, assetType: "Workshop" | "Activity", fallbackTitle: string): StructuredAsset {
  const candidate = raw && typeof raw === "object" ? (raw as Partial<StructuredAsset>) : {};
  const sections = Array.isArray(candidate.sections) ? candidate.sections : [];
  const template = assetType === "Activity" ? activitySectionTemplate : workshopSectionTemplate;

  return {
    assetType,
    draftNotice: "AI-generated draft. Human review required before use.",
    title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : fallbackTitle,
    sections: template.map((templateSection) => {
      const match = sections.find((section) => section?.id === templateSection.id);
      return {
        ...templateSection,
        content: normalizeContent(match?.content)
      };
    })
  };
}

export const normalizeWorkshopOutput = validateWorkshopOutput;
export const normalizeActivityOutput = validateActivityOutput;

/**
 * Render a validated Workshop into rich text and Canvas-friendly HTML.
 *
 * Blank sections intentionally stay blank below their headings. This makes
 * missing information visible to reviewers and prevents copied Canvas HTML from
 * implying that the AI had enough source context to fill every section.
 */
export function renderWorkshopHtml(asset: StructuredAsset) {
  return renderStructuredAsset(asset);
}

export function renderStructuredAsset(asset: StructuredAsset) {
  const richText = [
    asset.draftNotice,
    "",
    asset.title,
    "",
    ...asset.sections.flatMap((section) => [
      section.heading,
      `Audience: ${section.audience}`,
      plainContent(section.content),
      ""
    ])
  ].join("\n");

  const html = [
    `<aside><strong>${escapeHtml(asset.draftNotice)}</strong></aside>`,
    `<h1>${escapeHtml(asset.title)}</h1>`,
    ...asset.sections.map((section) => {
      const content = htmlContent(section.content);
      return `<section data-audience="${escapeHtml(section.audience)}"><h2>${escapeHtml(
        section.heading
      )}</h2><p><strong>Audience:</strong> ${escapeHtml(section.audience)}</p>${content}</section>`;
    })
  ].join("\n");

  logBackendEvent("html_rendered", {
    assetType: asset.assetType,
    sectionCount: asset.sections.length
  });

  return { richText, html };
}

function normalizeContent(content: unknown): string | string[] {
  if (Array.isArray(content)) {
    return content.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof content === "string") return content.trim();
  return "";
}

function plainContent(content: string | string[] | null) {
  if (Array.isArray(content)) return content.map((item) => `- ${item}`).join("\n");
  return content ?? "";
}

function htmlContent(content: string | string[] | null) {
  if (Array.isArray(content)) {
    if (content.length === 0) return "";
    return `<ul>${content.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  if (!content) return "";
  return content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
