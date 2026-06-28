import { describe, expect, it } from "vitest";

import { generateWorkshopHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

const baseWorkshop: WorkshopInput = {
  title: "Workshop 1",
  courseLabel: "BASC 001 - Digital Literacy",
  termCode: "",
  overview: "Practice digital literacy.",
  objectives: [],
  studentTask: "Complete the workshop task.",
  materials: [],
  equipment: [],
  safetyNotes: "Hands-on workshop",
  estimatedDuration: "2 hrs",
  instructorPrepNotes: "",
  workshopFlow: [],
  learningAssets: [],
  submissionRequirements: [],
  assessmentCriteria: "",
  cleanupResetInstructions: "",
  tags: []
};

function occurrenceCount(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

describe("workshop template", () => {
  it("renders every authored line in list-driven workshop sections", () => {
    const html = generateWorkshopHtml({
      ...baseWorkshop,
      objectives: ["objective one", "objective two", "objective three", "objective four"],
      learningAssets: ["resource one", "resource two", "resource three", "resource four"],
      workshopFlow: ["flow one", "flow two", "flow three", "flow four"],
      instructorPrepNotes: "prep one\nprep two\nprep three\nprep four",
      submissionRequirements: ["submission one", "submission two", "submission three", "submission four"]
    });

    [
      "objective one",
      "objective two",
      "objective three",
      "objective four",
      "resource one",
      "resource two",
      "resource three",
      "resource four",
      "flow one &gt; flow two &gt; flow three &gt; flow four",
      "Step 1:</strong> prep one",
      "Step 2:</strong> prep two",
      "Step 3:</strong> prep three",
      "Step 4:</strong> prep four",
      "submission one",
      "submission two",
      "submission three",
      "submission four"
    ].forEach((expected) => expect(html).toContain(expected));
  });

  it("preserves repeated authored lines in the live preview html", () => {
    const html = generateWorkshopHtml({
      ...baseWorkshop,
      objectives: ["test", "test", "test"],
      learningAssets: ["test", "test", "test"],
      submissionRequirements: ["test", "test", "test"]
    });

    expect(occurrenceCount(html, "<li>test</li>")).toBeGreaterThanOrEqual(6);
    expect(occurrenceCount(html, '<p style="font-size: 1.05em; margin: 0px; text-align: right;">test</p>')).toBe(3);
  });
});
