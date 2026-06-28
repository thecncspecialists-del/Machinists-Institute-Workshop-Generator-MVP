import { z } from "zod";

export const externalLmsAssetSchema = z.object({
  id: z.string().trim().min(1, "External LMS asset id is required."),
  provider: z.enum(["electude", "amatrol", "tooling-u"]),
  providerLabel: z.string().trim().min(1, "External LMS provider is required."),
  title: z.string().trim().min(1, "External LMS title is required."),
  catalogId: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  url: z.string().trim().optional().default(""),
  duration: z.string().trim().optional().default(""),
  path: z.string().trim().optional().default(""),
  section: z.string().trim().optional().default(""),
  module: z.string().trim().optional().default(""),
  functionalArea: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  classId: z.string().trim().optional().default(""),
  language: z.string().trim().optional().default(""),
  level: z.string().trim().optional().default(""),
  lastUpdated: z.string().trim().optional().default(""),
  physicalToolkitId: z.string().trim().optional().default("")
});

export const unitActivityInputSchema = z.object({
  deliveryType: z.enum(["canvas-html", "external-lms"]).optional().default("canvas-html"),
  externalLmsAsset: externalLmsAssetSchema.optional(),
  unitNumber: z.string().trim().min(1, "Unit number is required."),
  title: z.string().trim().min(1, "Unit title is required."),
  sourceWorkshopId: z.string().trim().optional().default(""),
  workshopTitle: z.string().trim().optional().default(""),
  courseLabel: z.string().trim().optional().default(""),
  termLabel: z.string().trim().optional().default(""),
  purpose: z.string().trim().min(1, "Purpose is required."),
  estimatedTime: z.string().trim().min(1, "Estimated time is required."),
  prerequisiteText: z.string().trim().optional().default(""),
  prerequisiteUrl: z.string().trim().optional().default(""),
  learningObjectives: z.array(z.string().trim()).default([]),
  learningResources: z.array(z.string().trim()).default([]),
  materials: z.array(z.string().trim()).default([]),
  safetyReminder: z.string().trim().optional().default(""),
  technicianTip: z.string().trim().optional().default(""),
  instructorDemonstration: z.array(z.string().trim()).default([]),
  activitySectionTitle: z.string().trim().optional().default("User Manual Activity"),
  activitySteps: z.array(z.string().trim()).default([]),
  whatToDoItems: z.array(z.string().trim()).default([]),
  studentCheckQuestions: z.array(z.string().trim()).default([]),
  checkoffItems: z.array(z.string().trim()).default([]),
  beforeMovingOnItems: z.array(z.string().trim()).default([]),
  nextUnitLabel: z.string().trim().optional().default(""),
  heroImageUrl: z.string().trim().optional().default("")
});

export type UnitActivityInput = z.infer<typeof unitActivityInputSchema>;
export type ExternalLmsAssetInput = z.infer<typeof externalLmsAssetSchema>;
