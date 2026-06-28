import { normalizeList } from "@/lib/workshop-generator/html-utils";
import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";

export function normalizeHomePageInput(input: HomePageInput): HomePageInput {
  return {
    logoImageUrl: input.logoImageUrl.trim(),
    heroImageUrl: input.heroImageUrl.trim(),
    logoFileName: input.logoFileName.trim() || "mi-logo-full.png",
    heroFileName: input.heroFileName.trim() || "mi-page-header.jpg",
    courseTitle: input.courseTitle.trim(),
    duration: input.duration.trim(),
    totalHours: input.totalHours.trim(),
    courseStatus: input.courseStatus.trim(),
    courseShellUrl: input.courseShellUrl.trim(),
    overviewParagraphs: normalizeList(input.overviewParagraphs),
    skills: input.skills
      .map((skill) => ({
        title: skill.title.trim(),
        description: skill.description.trim()
      }))
      .filter((skill) => skill.title || skill.description)
  };
}
