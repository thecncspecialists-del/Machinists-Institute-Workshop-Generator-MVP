import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

export const DEFAULT_UNIT_ACTIVITY_INPUT: UnitActivityInput = {
  unitNumber: "",
  title: "",
  sourceWorkshopId: "",
  workshopTitle: "",
  courseLabel: "",
  termLabel: "",
  purpose: "",
  estimatedTime: "",
  prerequisiteText: "",
  prerequisiteUrl: "",
  learningObjectives: [],
  learningResources: [],
  materials: [],
  safetyReminder: "",
  technicianTip: "",
  instructorDemonstration: [],
  activitySectionTitle: "User Manual Activity",
  activitySteps: [],
  whatToDoItems: [],
  studentCheckQuestions: [],
  checkoffItems: [],
  beforeMovingOnItems: [],
  nextUnitLabel: "",
  heroImageUrl: ""
};
