import {
  BRAND_ASSETS,
  escapeHtml,
  listItemsOr,
  renderLink,
  sectionDivider,
  textOr
} from "@/lib/workshop-generator/html-utils";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

function optionalSection(title: string, content: string) {
  return content.trim() ? `${sectionDivider()}\n  <h3 style="color: #0e5a72;">${escapeHtml(title)}</h3>\n  ${content}` : "";
}

function optionalListSection(title: string, items: string[], options: { ordered?: boolean; checklist?: boolean } = {}) {
  if (items.length === 0) return "";
  const tag = options.ordered ? "ol" : "ul";
  const listStyle = options.checklist ? "list-style-type: none; padding-left: 0;" : "padding-left: 22px;";
  return optionalSection(
    title,
    `<${tag} style="${listStyle}">\n    ${listItemsOr(items, 0, { checklist: options.checklist })}\n  </${tag}>`
  );
}

function renderCheckoffTable(items: string[]) {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #dadde1;">${escapeHtml(item)}</td>
        <td style="padding: 8px; border: 1px solid #dadde1;">&nbsp;</td>
      </tr>`
    )
    .join("");

  return optionalSection(
    "Instructor Checkoff",
    `<table style="width: 100%; border-collapse: collapse;">
    <tbody>
      <tr>
        <th style="padding: 8px; background: #f5f6f7; text-align: left; border: 1px solid #dadde1;">Verification Item</th>
        <th style="padding: 8px; background: #f5f6f7; text-align: left; border: 1px solid #dadde1;">Instructor Initials</th>
      </tr>${rows}
    </tbody>
  </table>`
  );
}

export function renderUnitActivityTemplateV1(input: UnitActivityInput) {
  const unitLabel = `Unit ${escapeHtml(input.unitNumber)} | ${escapeHtml(input.title)}`;
  const courseMeta = [input.courseLabel, input.workshopTitle, input.termLabel].filter(Boolean).map(escapeHtml).join(" - ");
  const prerequisite = input.prerequisiteText
    ? `<p>${input.prerequisiteUrl ? renderLink(input.prerequisiteText, input.prerequisiteUrl) : escapeHtml(input.prerequisiteText)}</p>`
    : "";
  const heroImage = input.heroImageUrl
    ? `<p style="text-align: center;"><img style="max-width: 100%; height: auto;" src="${escapeHtml(input.heroImageUrl)}" alt="${unitLabel}" /></p>`
    : "";
  const beforeMovingOn = input.beforeMovingOnItems.length
    ? `${sectionDivider()}
  <div style="background: #eef6f8; padding: 16px; border-left: 6px solid #0e5a72;">
    <h3 style="color: #0e5a72; margin: 0 0 8px;">Before Moving On</h3>
    <p style="margin: 0 0 8px;"><strong>Do not continue until the following items are complete:</strong></p>
    <ul style="list-style-type: none; padding-left: 0; margin: 0;">
      ${listItemsOr(input.beforeMovingOnItems, 0, { checklist: true })}
      ${input.nextUnitLabel ? `<li style="text-align: right;"><strong>Proceed to ${escapeHtml(input.nextUnitLabel)}</strong></li>` : ""}
    </ul>
  </div>`
    : "";

  return `
<div style="max-width: 900px; margin: auto; font-family: 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #222;">
  <p style="text-align: center; margin: 0 0 14px;"><img style="max-width: 100%; height: auto; border-radius: 6px;" src="${BRAND_ASSETS.headerBanner}" alt="Machinists Institute Header Banner" /></p>
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;">
    <img style="height: 54px; width: auto;" src="${BRAND_ASSETS.logo}" alt="Machinists Institute Logo" />
    <div>
      <div style="color: #0e5a72; font-size: 1.2em;">${unitLabel}</div>
      ${courseMeta ? `<div style="color: #66736b; font-size: 0.95em;">${courseMeta}</div>` : ""}
    </div>
  </div>
  <div style="background: #f5f6f7; padding: 16px; border: 1px solid #dadde1;">
    <h3 style="color: #0e5a72; margin: 0 0 8px; text-align: center;">Purpose</h3>
    <p style="margin: 0;">${textOr(input.purpose, "&nbsp;")}</p>
  </div>
  ${sectionDivider()}
  <h3 style="color: #0e5a72;">Estimated Time</h3>
  <p><strong>Time:</strong> ${textOr(input.estimatedTime, "&nbsp;")}</p>
  ${heroImage}
  ${optionalSection("Prerequisite", prerequisite)}
  ${optionalListSection("Learning Objectives", input.learningObjectives)}
  ${optionalListSection("Learning Resources", input.learningResources)}
  ${optionalListSection("What You'll Need", input.materials)}
  ${
    input.safetyReminder
      ? `${sectionDivider()}
  <div style="background: #eef6f8; padding: 16px; border-left: 6px solid #0e5a72;">
    <h3 style="color: #0e5a72; margin: 0 0 8px;"><span style="color: #e62429;"><strong>Safety Reminder</strong></span></h3>
    <p style="margin: 0;"><span style="color: #e62429;">${textOr(input.safetyReminder, "&nbsp;")}</span></p>
  </div>`
      : ""
  }
  ${optionalListSection("Instructor Demonstration", input.instructorDemonstration)}
  ${optionalListSection(input.activitySectionTitle, input.activitySteps)}
  ${
    input.technicianTip
      ? `<div style="background: #eef6f8; padding: 12px; border-left: 6px solid #0e5a72; margin-top: 14px;"><strong>Technician Tip:</strong><br />${textOr(input.technicianTip, "&nbsp;")}</div>`
      : ""
  }
  ${optionalListSection("What To Do", input.whatToDoItems, { checklist: true })}
  ${optionalListSection("Student Check Questions", input.studentCheckQuestions, { ordered: true })}
  ${renderCheckoffTable(input.checkoffItems)}
  ${beforeMovingOn}
  <p style="text-align: center; margin-top: 20px;"><img style="max-width: 100%; height: auto; border-radius: 6px;" src="${BRAND_ASSETS.footerBanner}" alt="Machinists Institute Footer Banner" /></p>
</div>`.trim();
}
