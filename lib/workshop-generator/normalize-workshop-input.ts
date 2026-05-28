import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeList(items: string[]) {
  return items
    .flatMap((item) => item.split(/\r?\n/))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

export function normalizeWorkshopInput(input: WorkshopInput): WorkshopInput {
  return {
    ...input,
    title: input.title.trim(),
    courseLabel: input.courseLabel.trim(),
    termCode: input.termCode.trim().toUpperCase(),
    overview: input.overview.trim(),
    studentTask: input.studentTask.trim(),
    safetyNotes: input.safetyNotes.trim(),
    estimatedDuration: input.estimatedDuration.trim(),
    instructorPrepNotes: input.instructorPrepNotes.trim(),
    assessmentCriteria: input.assessmentCriteria.trim(),
    cleanupResetInstructions: input.cleanupResetInstructions.trim(),
    objectives: normalizeList(input.objectives),
    materials: normalizeList(input.materials),
    equipment: normalizeList(input.equipment),
    workshopFlow: normalizeList(input.workshopFlow),
    learningAssets: normalizeList(input.learningAssets),
    submissionRequirements: normalizeList(input.submissionRequirements),
    tags: normalizeList(input.tags)
  };
}

export function parseListTextarea(value: string) {
  return splitLines(value);
}

export function listToTextarea(value: string[]) {
  return value.join("\n");
}
