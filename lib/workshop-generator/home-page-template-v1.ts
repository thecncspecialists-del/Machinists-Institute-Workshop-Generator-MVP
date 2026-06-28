import { assetBaseUrl, escapeHtml, textOr } from "@/lib/workshop-generator/html-utils";
import type { HomePageInput, HomePageSkill } from "@/lib/workshop-generator/home-page-schema";

function imageAttributes(src: string, fileName: string, alt: string) {
  const trimmedSrc = src.trim();
  const trimmedFileName = fileName.trim();
  const preferredSrc =
    trimmedSrc ||
    (trimmedFileName.startsWith("http") || trimmedFileName.startsWith("/")
      ? trimmedFileName
      : `${assetBaseUrl}/branding/${trimmedFileName}`);
  const safeSrc = preferredSrc ? escapeHtml(preferredSrc) : "#";
  return `src="${safeSrc}" alt="${escapeHtml(alt)}"`;
}

function renderOverviewParagraphs(paragraphs: string[]) {
  if (paragraphs.length === 0) {
    return "<p><strong>Description</strong></p>";
  }

  return paragraphs.map((paragraph) => `<p>${textOr(paragraph, "&nbsp;")}</p>`).join("\n        ");
}

function defaultSkills() {
  return [1, 2, 3, 4].map((skillNumber) => ({
    title: `Skill ${skillNumber}`,
    description: "Description"
  }));
}

function renderSkill(skill: HomePageSkill, index: number) {
  return `<div style="background: #ffffff; border-radius: 14px; padding: 14px 16px; border: 1px solid #dddddd;">
                <h3 style="margin: 0 0 6px; font-size: 16px;"><strong>${textOr(skill.title, `Skill ${index + 1}`)}</strong></h3>
                <p style="margin: 0;">${textOr(skill.description, "Description")}</p>
            </div>`;
}

function renderSkills(skills: HomePageSkill[]) {
  const hasSkillContent = skills.some((skill) => skill.title.trim() || skill.description.trim());
  const visibleSkills = hasSkillContent ? skills : defaultSkills();
  return visibleSkills.map(renderSkill).join("\n            ");
}

export function renderHomePageTemplateV1(input: HomePageInput) {
  return `
<div style="max-width: 900px; margin: 0 auto; font-family: 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #222;">
    <div style="border-radius: 14px; padding: 20px 22px; background: #ffffff; border: 2px solid #0e5a72;">
        <h1 style="margin: 0; font-size: 28px; line-height: 1.25; color: #0e5a72;"><img style="display: block; margin-left: auto; margin-right: auto; max-width: 360px; width: 100%; height: auto;" ${imageAttributes(input.logoImageUrl, input.logoFileName, "Machinists Institute Logo")} /></h1>
        <p style="margin: 10px 0 0; font-size: 16px;"><span style="font-size: 14pt;"><strong>${textOr(input.courseTitle, "Course Code - Course Name")}</strong></span></p>
        <p style="margin: 10px 0 0; font-size: 16px;"><strong>Duration: </strong>${textOr(input.duration, "Duration")} &nbsp;|&nbsp; <strong>Total Hours:</strong> ${textOr(input.totalHours, "Total Hours")}</p>
    </div>
    <p>&nbsp;</p>
    <div style="width: 400px; max-width: 100%; height: 221px; margin-left: auto; margin-right: auto; background: #f2f2f2; border: 1px solid #dddddd; display: flex; align-items: center; justify-content: center; color: #888888; font-size: 20px; font-weight: 600;">Image Placeholder</div>
    <p>&nbsp;</p>
    <div style="border-radius: 14px; padding: 18px 20px; background: #f2f2f2; border: 1px solid #dddddd;">
        <h2 style="margin: 0 0 10px; font-size: 20px; color: #0e5a72;"><strong>Program Overview</strong></h2>
        ${renderOverviewParagraphs(input.overviewParagraphs)}
        <h2 style="margin: 18px 0px 10px; font-size: 20px; color: #0e5a72; text-align: left;"><strong><br />Skills You Will Build</strong></h2>
        <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
            ${renderSkills(input.skills)}
        </div>
    </div>
</div>`.trim();
}
