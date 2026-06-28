import { describe, expect, it } from "vitest";

import { generateUnitActivityHtml } from "@/lib/workshop-generator/generate-workshop-html";
import { unitActivityInputSchema, type UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

const minimalUnitActivity: UnitActivityInput = {
  deliveryType: "canvas-html",
  externalLmsAsset: undefined,
  unitNumber: "3",
  title: "Cobot Assembly",
  sourceWorkshopId: "",
  workshopTitle: "",
  courseLabel: "Basic Robotics",
  termLabel: "SP26",
  purpose: "Assemble the cobot system safely.",
  estimatedTime: "45-60 minutes",
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

describe("unit activity template", () => {
  it("renders the core unit sections in order", () => {
    const html = generateUnitActivityHtml({
      ...minimalUnitActivity,
      learningResources: ["UR7e User Manual"],
      materials: ["Robot arm"],
      activitySteps: ["Open Section 3, Your Robot."],
      whatToDoItems: ["Robot arm identified"],
      beforeMovingOnItems: ["Instructor checkoff received"],
      nextUnitLabel: "Unit 4 | Startup and Basic Motion"
    });

    expect(html.indexOf("Purpose")).toBeLessThan(html.indexOf("Estimated Time"));
    expect(html.indexOf("Estimated Time")).toBeLessThan(html.indexOf("Learning Resources"));
    expect(html.indexOf("Learning Resources")).toBeLessThan(html.indexOf("What You&#039;ll Need"));
    expect(html.indexOf("What To Do")).toBeLessThan(html.indexOf("Before Moving On"));
    expect(html).toContain("Proceed to Unit 4 | Startup and Basic Motion");
  });

  it("escapes user-entered HTML", () => {
    const html = generateUnitActivityHtml({
      ...minimalUnitActivity,
      title: "<script>alert(1)</script>",
      purpose: "Use <strong>safe</strong> startup."
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<strong>safe</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Use &lt;strong&gt;safe&lt;/strong&gt; startup.");
  });

  it("omits optional sections when empty", () => {
    const html = generateUnitActivityHtml(minimalUnitActivity);

    expect(html).not.toContain("Learning Objectives");
    expect(html).not.toContain("Safety Reminder");
    expect(html).not.toContain("Student Check Questions");
    expect(html).not.toContain("Instructor Checkoff");
  });

  it("renders checklist items without encoding corruption", () => {
    const html = generateUnitActivityHtml({
      ...minimalUnitActivity,
      whatToDoItems: ["Confirm emergency stop is accessible"]
    });

    expect(html).toContain("&#9744; Confirm emergency stop is accessible");
    expect(html).not.toContain("â˜");
  });

  it("renders instructor checkoff as a table", () => {
    const html = generateUnitActivityHtml({
      ...minimalUnitActivity,
      checkoffItems: ["Startup sequence completed safely"]
    });

    expect(html).toContain("<table");
    expect(html).toContain("Instructor Initials");
    expect(html).toContain("Startup sequence completed safely");
  });

  it("validates required unit fields", () => {
    expect(unitActivityInputSchema.safeParse(minimalUnitActivity).success).toBe(true);
    expect(unitActivityInputSchema.safeParse({ ...minimalUnitActivity, title: "" }).success).toBe(false);
    expect(unitActivityInputSchema.safeParse({ ...minimalUnitActivity, purpose: "" }).success).toBe(false);
    expect(unitActivityInputSchema.safeParse({ ...minimalUnitActivity, estimatedTime: "" }).success).toBe(false);
  });

  it("renders an external LMS unit without standard activity sections", () => {
    const html = generateUnitActivityHtml({
      ...minimalUnitActivity,
      deliveryType: "external-lms",
      title: "Intro to Adhesive Bonding 110",
      purpose: "Complete this Tooling U lesson.",
      estimatedTime: "Varies by LMS activity",
      instructorDemonstration: ["Do not render this"],
      whatToDoItems: ["Do not render this checklist"],
      checkoffItems: ["Do not render this checkoff"],
      externalLmsAsset: {
        id: "tooling-u:670110:intro-to-adhesive-bonding-110",
        provider: "tooling-u",
        providerLabel: "Tooling U",
        title: "Intro to Adhesive Bonding 110",
        catalogId: "670110",
        description: "This class describes adhesive bonding.",
        url: "https://www.toolingu.com/class/670110",
        duration: "",
        path: "",
        section: "",
        module: "",
        functionalArea: "Assembly / Final Stage Processes",
        department: "Adhesives",
        classId: "670110",
        language: "English",
        level: "Beginner",
        lastUpdated: "2012-09-04",
        physicalToolkitId: ""
      }
    });

    expect(html).toContain("External LMS Activity");
    expect(html).toContain("Tooling U");
    expect(html).toContain("Intro to Adhesive Bonding 110");
    expect(html).toContain("670110");
    expect(html).toContain("https://www.toolingu.com/class/670110");
    expect(html).not.toContain("Instructor Demonstration");
    expect(html).not.toContain("What To Do");
    expect(html).not.toContain("Instructor Checkoff");
  });
});
