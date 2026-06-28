import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

export const DEFAULT_WORKSHOP_INPUT: WorkshopInput = {
  title: "Workshop 1",
  courseLabel: "",
  termCode: "",
  overview: "",
  objectives: [],
  studentTask: "",
  materials: [],
  equipment: [],
  safetyNotes: "",
  estimatedDuration: "",
  instructorPrepNotes: "",
  workshopFlow: [],
  learningAssets: [],
  submissionRequirements: [],
  assessmentCriteria: "",
  cleanupResetInstructions: "",
  tags: []
};
