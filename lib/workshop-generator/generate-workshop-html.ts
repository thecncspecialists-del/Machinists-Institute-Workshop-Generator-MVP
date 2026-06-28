import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";
import { renderHomePageTemplateV1 } from "@/lib/workshop-generator/home-page-template-v1";
import { normalizeHomePageInput } from "@/lib/workshop-generator/normalize-home-page-input";
import { normalizeWorkshopInput } from "@/lib/workshop-generator/normalize-workshop-input";
import { normalizeUnitActivityInput } from "@/lib/workshop-generator/normalize-unit-activity-input";
import { renderUnitActivityTemplateV1 } from "@/lib/workshop-generator/unit-activity-template-v1";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";
import { renderWorkshopTemplateV1 } from "@/lib/workshop-generator/workshop-template-v1";
import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

export function generateWorkshopHtml(input: WorkshopInput) {
  const normalized = normalizeWorkshopInput(input);
  return renderWorkshopTemplateV1(normalized);
}

export function generateUnitActivityHtml(input: UnitActivityInput) {
  const normalized = normalizeUnitActivityInput(input);
  return renderUnitActivityTemplateV1(normalized);
}

export function generateHomePageHtml(input: HomePageInput) {
  const normalized = normalizeHomePageInput(input);
  return renderHomePageTemplateV1(normalized);
}
