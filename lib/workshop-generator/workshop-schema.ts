import { z } from "zod";

import { isValidTermCode } from "@/lib/workshop-generator/term-code";

export const workshopInputSchema = z.object({
  title: z.string().trim().min(1, "Workshop title is required."),
  courseLabel: z.string().trim().min(1, "Course is required."),
  termCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value.length === 0 || isValidTermCode(value), "Term must use SP/SU/FA/WI plus two-digit year, for example SP26.")
    .optional()
    .default(""),
  overview: z.string().trim().min(1, "Overview is required."),
  objectives: z.array(z.string().trim()).default([]),
  studentTask: z.string().trim().min(1, "Student task is required."),
  materials: z.array(z.string().trim()).default([]),
  equipment: z.array(z.string().trim()).default([]),
  safetyNotes: z.string().trim().optional().default(""),
  estimatedDuration: z.string().trim().optional().default(""),
  instructorPrepNotes: z.string().trim().optional().default(""),
  workshopFlow: z.array(z.string().trim()).default([]),
  learningAssets: z.array(z.string().trim()).default([]),
  submissionRequirements: z.array(z.string().trim()).default([]),
  assessmentCriteria: z.string().trim().optional().default(""),
  cleanupResetInstructions: z.string().trim().optional().default(""),
  tags: z.array(z.string().trim()).default([])
});

export const saveWorkshopSchema = workshopInputSchema.pick({
  title: true,
  courseLabel: true
});

export type WorkshopInput = z.infer<typeof workshopInputSchema>;
