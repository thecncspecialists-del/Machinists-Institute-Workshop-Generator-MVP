import { describe, expect, it } from "vitest";

import {
  buildWorkspaceSearchWhere,
  createHomePageInputFromCourse,
  prepareCourseWorkspaceForSave,
  serializeCourseWorkspace
} from "@/lib/workshop-generator/course-workspaces";

describe("course workspaces", () => {
  it("prefills homepage input from locked catalog course fields and outcomes", () => {
    const input = createHomePageInputFromCourse({
      id: "00000000-0000-0000-0000-000000000001",
      courseCode: "BERT 105",
      courseName: "Basic Robotics",
      description: "Learn safe robot setup.",
      hours: 16,
      year: 2026,
      quarter: 2,
      canvasShellUrl: "https://example.com/canvas",
      developmentStatus: "Ready",
      outcomes: [
        { outcomeCode: "CLO 1", description: "Identify robot components." },
        { outcomeCode: "CLO 2", description: "Apply safe startup checks." }
      ]
    });

    expect(input.courseTitle).toBe("BERT 105 - Basic Robotics");
    expect(input.totalHours).toBe("16");
    expect(input.courseStatus).toBe("Ready");
    expect(input.courseShellUrl).toBe("https://example.com/canvas");
    expect(input.overviewParagraphs).toEqual(["Learn safe robot setup."]);
    expect(input.skills).toEqual([
      { title: "CLO 1", description: "Identify robot components." },
      { title: "CLO 2", description: "Apply safe startup checks." }
    ]);
  });

  it("prepares saved workspace homepage html with filename image references", () => {
    const prepared = prepareCourseWorkspaceForSave({
      logoImageUrl: "",
      heroImageUrl: "",
      logoFileName: "mi-logo-full.png",
      heroFileName: "mi-page-header.jpg",
      courseTitle: "BERT 105 - Basic Robotics",
      duration: "",
      totalHours: "16",
      courseStatus: "Ready",
      courseShellUrl: "",
      overviewParagraphs: ["Course overview."],
      skills: []
    });

    expect(prepared.summary).toBe("Course overview.");
    expect(prepared.html).toContain('src="https://workshops.thecnc.network/branding/mi-logo-full.png"');
    expect(prepared.html).toContain("Image Placeholder");
  });

  it("searches by workspace and imported course fields", () => {
    expect(buildWorkspaceSearchWhere("robot")).toEqual({
      archivedAt: null,
      OR: [
        { title: { contains: "robot", mode: "insensitive" } },
        { summary: { contains: "robot", mode: "insensitive" } },
        { course: { courseName: { contains: "robot", mode: "insensitive" } } },
        { course: { courseCode: { contains: "robot", mode: "insensitive" } } },
        { course: { developmentStatus: { contains: "robot", mode: "insensitive" } } }
      ]
    });
  });

  it("serializes nested workshop unit summaries for sidebar navigation", () => {
    const serialized = serializeCourseWorkspace({
      id: "00000000-0000-0000-0000-000000000010",
      courseId: "00000000-0000-0000-0000-000000000001",
      title: "BERT 105 - Basic Robotics",
      summary: null,
      homePageInputJson: {
        logoImageUrl: "",
        heroImageUrl: "",
        logoFileName: "mi-logo-full.png",
        heroFileName: "mi-page-header.jpg",
        courseTitle: "BERT 105 - Basic Robotics",
        duration: "",
        totalHours: "16",
        courseStatus: "Ready",
        courseShellUrl: "",
        overviewParagraphs: [],
        skills: []
      },
      homePageHtml: "<main></main>",
      imagePackageVersion: "mi-canvas-image-package-v1",
      visibility: "STAFF_COMMONS",
      createdByName: "Staff User",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      course: {
        id: "00000000-0000-0000-0000-000000000001",
        courseCode: "BERT 105",
        courseName: "Basic Robotics",
        developmentStatus: "Ready",
        hours: 16,
        canvasShellUrl: null,
        assets: [{ id: "asset-1" }]
      },
      workshops: [
        {
          id: "00000000-0000-0000-0000-000000000020",
          title: "Robot Setup",
          _count: { units: 99 },
          units: [
            { id: "00000000-0000-0000-0000-000000000030", unitNumber: 1, title: "Safety Checks" },
            { id: "00000000-0000-0000-0000-000000000031", unitNumber: 2, title: "Startup Procedure" }
          ]
        },
        {
          id: "00000000-0000-0000-0000-000000000021",
          title: "Robot Operations",
          _count: { units: 0 },
          units: []
        }
      ]
    } as any);

    expect(serialized.counts).toEqual({ assets: 1, workshops: 2, units: 2 });
    expect(serialized.workshops).toEqual([
      {
        id: "00000000-0000-0000-0000-000000000020",
        title: "Robot Setup",
        unitCount: 2,
        units: [
          { id: "00000000-0000-0000-0000-000000000030", unitNumber: 1, title: "Safety Checks" },
          { id: "00000000-0000-0000-0000-000000000031", unitNumber: 2, title: "Startup Procedure" }
        ]
      },
      {
        id: "00000000-0000-0000-0000-000000000021",
        title: "Robot Operations",
        unitCount: 0,
        units: []
      }
    ]);
  });
});
