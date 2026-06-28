import type { WorkshopUnit } from "@prisma/client";

import { DEFAULT_UNIT_ACTIVITY_INPUT } from "@/lib/workshop-generator/default-unit-activity-input";
import { generateUnitActivityHtml } from "@/lib/workshop-generator/generate-workshop-html";
import { normalizeUnitActivityInput } from "@/lib/workshop-generator/normalize-unit-activity-input";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

type WorkshopContext = {
  id: string;
  title: string;
  courseLabel: string;
  termCode: string;
};

export type WorkshopUnitSummary = {
  id: string;
  workshopId: string;
  unitNumber: number;
  title: string;
  inputJson: UnitActivityInput;
  htmlOutput: string;
  createdAt: string;
  updatedAt: string;
};

export function createDefaultUnitInput(workshop: WorkshopContext, unitNumber: number): UnitActivityInput {
  return {
    ...DEFAULT_UNIT_ACTIVITY_INPUT,
    unitNumber: String(unitNumber),
    sourceWorkshopId: workshop.id,
    workshopTitle: workshop.title,
    courseLabel: workshop.courseLabel,
    termLabel: workshop.termCode
  };
}

export function prepareUnitForSave(input: UnitActivityInput, workshop: WorkshopContext) {
  const normalized = normalizeUnitActivityInput({
    ...input,
    sourceWorkshopId: workshop.id,
    workshopTitle: workshop.title,
    courseLabel: workshop.courseLabel,
    termLabel: workshop.termCode
  });

  return {
    inputJson: normalized,
    htmlOutput: generateUnitActivityHtml(normalized),
    title: normalized.title.trim() || `Unit ${normalized.unitNumber}`
  };
}

export function serializeWorkshopUnit(unit: WorkshopUnit): WorkshopUnitSummary {
  return {
    id: unit.id,
    workshopId: unit.workshopId,
    unitNumber: unit.unitNumber,
    title: unit.title,
    inputJson: unit.inputJson as UnitActivityInput,
    htmlOutput: unit.htmlOutput,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString()
  };
}
