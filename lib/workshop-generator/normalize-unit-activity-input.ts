import { normalizeList } from "@/lib/workshop-generator/html-utils";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

export function normalizeUnitActivityInput(input: UnitActivityInput): UnitActivityInput {
  return {
    ...input,
    unitNumber: input.unitNumber.trim(),
    title: input.title.trim(),
    sourceWorkshopId: input.sourceWorkshopId.trim(),
    workshopTitle: input.workshopTitle.trim(),
    courseLabel: input.courseLabel.trim(),
    termLabel: input.termLabel.trim(),
    purpose: input.purpose.trim(),
    estimatedTime: input.estimatedTime.trim(),
    prerequisiteText: input.prerequisiteText.trim(),
    prerequisiteUrl: input.prerequisiteUrl.trim(),
    safetyReminder: input.safetyReminder.trim(),
    technicianTip: input.technicianTip.trim(),
    activitySectionTitle: input.activitySectionTitle.trim() || "User Manual Activity",
    nextUnitLabel: input.nextUnitLabel.trim(),
    heroImageUrl: input.heroImageUrl.trim(),
    learningObjectives: normalizeList(input.learningObjectives),
    learningResources: normalizeList(input.learningResources),
    materials: normalizeList(input.materials),
    instructorDemonstration: normalizeList(input.instructorDemonstration),
    activitySteps: normalizeList(input.activitySteps),
    whatToDoItems: normalizeList(input.whatToDoItems),
    studentCheckQuestions: normalizeList(input.studentCheckQuestions),
    checkoffItems: normalizeList(input.checkoffItems),
    beforeMovingOnItems: normalizeList(input.beforeMovingOnItems)
  };
}
