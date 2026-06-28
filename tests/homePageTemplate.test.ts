import { describe, expect, it } from "vitest";

import { generateHomePageHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";

const minimalHomePage: HomePageInput = {
  logoImageUrl: "",
  heroImageUrl: "",
  logoFileName: "mi-logo-full.png",
  heroFileName: "mi-page-header.jpg",
  courseTitle: "BERT 105 - Basic Robotics",
  duration: "2 weeks",
  totalHours: "16",
  courseStatus: "Ready",
  courseShellUrl: "https://example.com/canvas",
  overviewParagraphs: ["Program overview first.", "Program overview second."],
  skills: [{ title: "Robot Awareness", description: "Identify robot components." }]
};

describe("home page template", () => {
  it("renders core sections in order", () => {
    const html = generateHomePageHtml(minimalHomePage);

    expect(html.indexOf("BERT 105 - Basic Robotics")).toBeLessThan(html.indexOf("Duration:"));
    expect(html.indexOf("Duration:")).toBeLessThan(html.indexOf("Program Overview"));
    expect(html.indexOf("Program Overview")).toBeLessThan(html.indexOf("Skills You Will Build"));
    expect(html).toContain("2 weeks");
    expect(html).toContain("16");
    expect(html).toContain("Robot Awareness");
  });

  it("escapes user-entered HTML", () => {
    const html = generateHomePageHtml({
      ...minimalHomePage,
      courseTitle: "<script>alert(1)</script>",
      overviewParagraphs: ["Use <strong>safe</strong> setup."]
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<strong>safe</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Use &lt;strong&gt;safe&lt;/strong&gt; setup.");
  });

  it("renders safe placeholders for empty optional fields", () => {
    const html = generateHomePageHtml({
      logoImageUrl: "",
      heroImageUrl: "",
      logoFileName: "mi-logo-full.png",
      heroFileName: "mi-page-header.jpg",
      courseTitle: "",
      duration: "",
      totalHours: "",
      courseStatus: "",
      courseShellUrl: "",
      overviewParagraphs: [],
      skills: []
    });

    expect(html).toContain("Course Code - Course Name");
    expect(html).toContain("Duration");
    expect(html).toContain("Total Hours");
    expect(html).toContain("<p>&nbsp;</p>");
    expect(html).toContain("Skill Title");
  });

  it("reflects added and removed skills", () => {
    const html = generateHomePageHtml({
      ...minimalHomePage,
      skills: [
        { title: "Kept Skill", description: "This one remains." },
        { title: "", description: "" }
      ]
    });

    expect(html).toContain("Kept Skill");
    expect(html).not.toContain("Robot Awareness");
  });

  it("uses predictable filename image references instead of Canvas file API endpoints", () => {
    const html = generateHomePageHtml(minimalHomePage);

    expect(html).toContain('src="mi-logo-full.png"');
    expect(html).toContain('src="mi-page-header.jpg"');
    expect(html).not.toContain("data-api-endpoint");
  });
});
