import { normalizeList } from "@/lib/workshop-generator/html-utils";
import type { ExternalLmsAssetInput, UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

function normalizeExternalLmsAsset(asset: UnitActivityInput["externalLmsAsset"]): ExternalLmsAssetInput | undefined {
  if (!asset) return undefined;

  return {
    id: asset.id.trim(),
    provider: asset.provider,
    providerLabel: asset.providerLabel.trim(),
    title: asset.title.trim(),
    catalogId: asset.catalogId?.trim() ?? "",
    description: asset.description?.trim() ?? "",
    url: asset.url?.trim() ?? "",
    duration: asset.duration?.trim() ?? "",
    path: asset.path?.trim() ?? "",
    section: asset.section?.trim() ?? "",
    module: asset.module?.trim() ?? "",
    functionalArea: asset.functionalArea?.trim() ?? "",
    department: asset.department?.trim() ?? "",
    classId: asset.classId?.trim() ?? "",
    language: asset.language?.trim() ?? "",
    level: asset.level?.trim() ?? "",
    lastUpdated: asset.lastUpdated?.trim() ?? "",
    physicalToolkitId: asset.physicalToolkitId?.trim() ?? ""
  };
}

export function normalizeUnitActivityInput(input: UnitActivityInput): UnitActivityInput {
  const deliveryType = input.deliveryType === "external-lms" ? "external-lms" : "canvas-html";
  const externalLmsAsset = deliveryType === "external-lms" ? normalizeExternalLmsAsset(input.externalLmsAsset) : undefined;
  const fallbackPurpose = externalLmsAsset
    ? `Complete this ${externalLmsAsset.providerLabel} external LMS activity in Canvas.`
    : input.purpose;
  const fallbackEstimatedTime = externalLmsAsset?.duration || input.estimatedTime;

  return {
    ...input,
    deliveryType,
    externalLmsAsset,
    unitNumber: input.unitNumber.trim(),
    title: input.title.trim() || externalLmsAsset?.title || "",
    sourceWorkshopId: input.sourceWorkshopId.trim(),
    workshopTitle: input.workshopTitle.trim(),
    courseLabel: input.courseLabel.trim(),
    termLabel: input.termLabel.trim(),
    purpose: input.purpose.trim() || fallbackPurpose.trim(),
    estimatedTime: input.estimatedTime.trim() || fallbackEstimatedTime.trim(),
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
