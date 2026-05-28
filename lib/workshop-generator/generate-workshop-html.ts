import { normalizeWorkshopInput } from "@/lib/workshop-generator/normalize-workshop-input";
import { renderWorkshopTemplateV1 } from "@/lib/workshop-generator/workshop-template-v1";
import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

export function generateWorkshopHtml(input: WorkshopInput) {
  const normalized = normalizeWorkshopInput(input);
  return renderWorkshopTemplateV1(normalized);
}
