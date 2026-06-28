import type { WorkshopUnit } from "@prisma/client";

import { DEFAULT_UNIT_ACTIVITY_INPUT } from "@/lib/workshop-generator/default-unit-activity-input";
import { generateUnitActivityHtml } from "@/lib/workshop-generator/generate-workshop-html";
import { normalizeUnitActivityInput } from "@/lib/workshop-generator/normalize-unit-activity-input";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

type UnitTableBootstrapDb = {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
};

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

export async function ensureWorkshopUnitsTable(db: UnitTableBootstrapDb) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "workshop_units" (
      "id" UUID PRIMARY KEY,
      "workshop_id" UUID NOT NULL,
      "unit_number" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "input_json" JSONB NOT NULL,
      "html_output" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "workshop_units_workshop_id_unit_number_key"
    ON "workshop_units"("workshop_id", "unit_number")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "workshop_units_workshop_id_idx"
    ON "workshop_units"("workshop_id")
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "workshop_units_updated_at_idx"
    ON "workshop_units"("updated_at")
  `);
}

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
