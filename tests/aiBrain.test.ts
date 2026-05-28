import { describe, expect, it } from "vitest";
import { buildAssetPrompt, buildWorkshopMessages } from "@/lib/aiBrain";
import {
  activitySectionTemplate,
  normalizeActivityOutput,
  normalizeWorkshopOutput,
  renderStructuredAsset,
  workshopSectionTemplate
} from "@/lib/renderAsset";

describe("AI brain and rendering guardrails", () => {
  it("doesNotAllowAiOutputToReplaceImportedCourseCode", () => {
    const messages = buildWorkshopMessages({
      context: {
        course: {
          id: "00000000-0000-0000-0000-000000000000",
          courseCode: "BASC 001",
          courseName: "Digital Literacy",
          description: null,
          hours: null,
          year: null,
          quarter: null,
          syllabusUrl: null,
          canvasShellUrl: null,
          developmentStatus: "Ready",
          enrollmentTrackerUrl: null
        },
        outcomes: [{ outcomeCode: "CLO1", description: "Use video conferencing tools." }]
      },
      input: { topic: "Online collaboration" }
    });

    expect(messages.system).toContain("Do not invent links");
    expect(messages.system).toContain("Do not change official course information");
    expect(messages.system).toContain("Imported course data is reference-only");
    expect(messages.user).toContain("Imported Reference Data is locked");
    expect(messages.user).toContain('"courseCode": "BASC 001"');
    expect(messages.user).toContain("Online collaboration");
  });

  it("supportsPromptingWithoutAttachedCourseContext", () => {
    const messages = buildWorkshopMessages({
      context: null,
      input: { topic: "Safety habits" }
    });

    expect(messages.user).toContain("No imported course context is attached");
    expect(messages.user).toContain("Safety habits");
  });

  it("keepsEveryWorkshopHeadingWhenTheModelOmitsSections", () => {
    const output = normalizeWorkshopOutput(
      {
        title: "Digital Literacy Workshop",
        sections: [{ id: "overview", content: "Practice using online tools." }]
      },
      "Fallback"
    );

    expect(output.sections).toHaveLength(workshopSectionTemplate.length);
    expect(output.sections.map((section) => section.heading)).toEqual(
      workshopSectionTemplate.map((section) => section.heading)
    );
    expect(output.sections.find((section) => section.id === "assessment")?.content).toBe("");
  });

  it("preservesBlankWorkshopSectionsInCanvasHtml", () => {
    const output = normalizeWorkshopOutput(
      {
        title: "Digital Literacy Workshop",
        sections: [{ id: "overview", content: "Practice using online tools." }]
      },
      "Fallback"
    );
    const rendered = renderStructuredAsset(output);

    expect(rendered.richText).toContain("AI-generated draft");
    expect(rendered.html).toContain("<h2>Workshop Overview</h2>");
    expect(rendered.html).toContain("<h2>Assessment or Evidence of Learning</h2>");
    expect(rendered.html).not.toContain("<script");
  });

  it("buildsAndRendersActivityDraftsWithTheActivityTemplate", () => {
    const messages = buildAssetPrompt({
      assetType: "Activity",
      context: null,
      input: { topic: "Torque tool practice" }
    });
    const output = normalizeActivityOutput(
      {
        title: "Torque Tool Practice",
        sections: [{ id: "activity_steps", content: ["Set up the station.", "Complete the practice check."] }]
      },
      "Fallback"
    );
    const rendered = renderStructuredAsset(output);

    expect(messages.system).toContain("Activity Template");
    expect(messages.user).toContain("Create an Activity draft");
    expect(output.assetType).toBe("Activity");
    expect(output.sections.map((section) => section.heading)).toEqual(
      activitySectionTemplate.map((section) => section.heading)
    );
    expect(rendered.html).toContain("<h2>Activity Steps</h2>");
  });
});
