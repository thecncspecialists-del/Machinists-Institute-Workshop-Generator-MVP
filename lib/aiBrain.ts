import fs from "node:fs";
import path from "node:path";
import { ActiveAssetType, CurriculumInput } from "@/lib/constants";

export type BrainCourseContext = {
  id: string;
  courseCode: string | null;
  courseName: string;
  description: string | null;
  hours: number | null;
  year: number | null;
  quarter: number | null;
  syllabusUrl: string | null;
  canvasShellUrl: string | null;
  developmentStatus: string | null;
  enrollmentTrackerUrl: string | null;
};

export type BrainOutcome = {
  outcomeCode: string | null;
  description: string;
};

export type BrainContext = {
  course: BrainCourseContext;
  outcomes: BrainOutcome[];
};

const commonBrainFiles = [
  "identity.md",
  "guardrails.md",
  "source-boundaries.md",
  "canvas-html.md"
];

/**
 * Load versioned AI brain documents from disk.
 *
 * The brain files define the assistant identity, source boundaries, Canvas HTML
 * rules, and the workshop template. This function does not include database
 * records, user secrets, or previous AI output; routes attach only the selected
 * course context and current user inputs for each generation request.
 */
export function loadAiBrain(assetType: ActiveAssetType = "Workshop") {
  const brainDirectory = path.join(process.cwd(), "lib", "ai-brain");
  const templateFile = assetType === "Activity" ? "activity-template.md" : "workshop-template.md";
  return [...commonBrainFiles, templateFile]
    .map((file) => fs.readFileSync(path.join(brainDirectory, file), "utf8").trim())
    .join("\n\n");
}

/**
 * Assemble the constrained Workshop prompt.
 *
 * Sent to the model: locked selected course fields, imported outcomes, and
 * user-provided curriculum inputs. Intentionally excluded: raw import rows not
 * needed for drafting, other courses, saved asset history, database credentials,
 * and any authority to edit imported reference data. Pre-generation guardrails
 * live in the system brain; post-generation validation happens in
 * validateWorkshopOutput/normalizeWorkshopOutput before rendering.
 */
export function buildAssetPrompt(params: {
  assetType: ActiveAssetType;
  context?: BrainContext | null;
  input: CurriculumInput;
}) {
  const system = loadAiBrain(params.assetType);
  const article = params.assetType === "Activity" ? "an" : "a";
  const contextBlock = params.context
    ? [
        "Imported Reference Data is locked and must not be changed:",
        JSON.stringify(params.context.course, null, 2),
        "Imported Course Outcomes:",
        JSON.stringify(params.context.outcomes, null, 2)
      ].join("\n\n")
    : [
        "No imported course context is attached for this draft.",
        "Use only the user input below and keep unknown official details blank."
      ].join("\n\n");
  const user = [
    `Create ${article} ${params.assetType} draft using the exact ${params.assetType} Template JSON shape.`,
    contextBlock,
    "User Inputs:",
    JSON.stringify(params.input, null, 2),
    "Return only valid JSON. Do not include Markdown fences or commentary."
  ].join("\n\n");

  return { system, user };
}

export function buildWorkshopPrompt(params: {
  context?: BrainContext | null;
  input: CurriculumInput;
}) {
  return buildAssetPrompt({ assetType: "Workshop", ...params });
}

export const buildWorkshopMessages = buildWorkshopPrompt;
