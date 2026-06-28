import { z } from "zod";

export const unitActivityInputSchema = z.object({
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
