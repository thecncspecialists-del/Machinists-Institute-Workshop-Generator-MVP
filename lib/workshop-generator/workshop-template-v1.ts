import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

const assetBaseUrl =
  process.env.NEXT_PUBLIC_WORKSHOP_ASSET_BASE_URL?.trim().replace(/\/+$/, "") || "https://workshops.thecnc.network";

const BRAND_ASSETS = {
  headerBanner: `${assetBaseUrl}/branding/mi-page-header.jpg`,
  logo: `${assetBaseUrl}/branding/mi-logo-short.png`,
  detailsIcon: `${assetBaseUrl}/Details.png`,
  objectivesIcon: `${assetBaseUrl}/Objectives.png`,
  resourcesIcon: `${assetBaseUrl}/Learning%20Resources.png`,
  whatToDoIcon: `${assetBaseUrl}/What%20to%20Do.png`,
  submissionIcon: `${assetBaseUrl}/Details.png`,
  centerImage: "https://placehold.co/400x221/png?text=Workshop+Image",
  footerBanner: `${assetBaseUrl}/branding/mi-page-footer.jpg`
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textOr(value: string, fallback: string) {
  const normalized = value.trim();
  return normalized ? escapeHtml(normalized).replace(/\n/g, "<br />") : fallback;
}

function listItemsOr(items: string[], fallbackCount = 3) {
  if (items.length === 0) {
    return Array.from({ length: fallbackCount })
      .map(() => "<li>&nbsp;</li>")
      .join("");
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export function renderWorkshopTemplateV1(input: WorkshopInput) {
  const duration = textOr(input.estimatedDuration, "#hrs (Days)");
  const titleLine =
    input.courseLabel.trim() || input.title.trim()
      ? `${escapeHtml(input.courseLabel || "Course Name")} | ${escapeHtml(input.title || "Activity Name")} (${escapeHtml(
          input.estimatedDuration || "Hr"
        )})`
      : "Course Name | Activity Name (Hr)";
  const overview = textOr(input.overview, "This module is...");
  const format = textOr(input.safetyNotes, "&nbsp;");
  const scope = textOr(input.studentTask, "&nbsp;");
  const flowText =
    input.workshopFlow.length > 0 ? escapeHtml(input.workshopFlow.join(" > ")) : "<strong>Day 1:</strong> &nbsp;<br /><strong>Day 2:</strong> &nbsp;";
  const submissionPrimary = input.submissionRequirements[0]
    ? escapeHtml(input.submissionRequirements[0])
    : "[Details]";
  const whatToDoItems = input.instructorPrepNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return `
<div style="max-width: 900px; margin: auto; font-family: 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #222;">
  <p style="text-align: center; margin: 0 0 14px;"><img style="max-width: 100%; height: auto; border-radius: 6px;" src="${BRAND_ASSETS.headerBanner}" alt="Machinists Institute Header Banner" /></p>
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap;"><img style="height: 48px; width: auto;" src="${BRAND_ASSETS.logo}" alt="Machinists Institute Logo" />
    <div style="color: #0e5a72; font-size: 1.2em;">${titleLine}</div>
  </div>
  <div style="background: #F5F6F7; border: 1px solid #DADDE1; border-radius: 6px; padding: 16px 16px;">
    <h3 style="color: #0e5a72; margin: 0px 0px 8px; text-align: center;">Overview</h3>
    <p style="margin: 0 0 10px 0;">${overview}</p>
  </div>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0 0 8px 0;"><img src="${BRAND_ASSETS.detailsIcon}" alt="Details icon" /> Details</h3>
  <p><strong>Duration:</strong> ${duration}</p>
  <p><strong>Format:</strong> ${format}</p>
  <p><strong>Materials:</strong></p>
  <ul>
    ${listItemsOr([...input.materials, ...input.equipment], 3)}
  </ul>
  <p><strong>Scope:</strong> ${scope}<br /><br /><br /><img style="display: block; margin-left: auto; margin-right: auto;" src="${BRAND_ASSETS.centerImage}" alt="Workshop image placeholder" width="400" height="221" /></p>
  <p>&nbsp;</p>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0 0 8px 0;"><img src="${BRAND_ASSETS.objectivesIcon}" alt="Objectives icon" /> Objectives</h3>
  <ol style="list-style-type: decimal;">
    ${listItemsOr(input.objectives, 3)}
  </ol>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0 0 10px 0;"><img src="${BRAND_ASSETS.resourcesIcon}" alt="Learning Resources icon" /> Learning Resources</h3>
  <ul style="padding-left: 22px; font-size: 1.05em; line-height: 1.8; margin: 0;">
    ${listItemsOr(input.learningAssets, 3)}
  </ul>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0 0 10px 0;">Workshop Flow</h3>
  <p style="margin: 0 0 10px 0;">${flowText}</p>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0 0 8px 0;"><img src="${BRAND_ASSETS.whatToDoIcon}" alt="What To Do icon" /> What To Do</h3>
  <p><strong>Step 1:</strong> ${whatToDoItems[0] ? escapeHtml(whatToDoItems[0]) : "&nbsp;"}</p>
  <p><strong>Step 2:</strong> ${whatToDoItems[1] ? escapeHtml(whatToDoItems[1]) : "&nbsp;"}</p>
  <p><strong>Step 3:</strong> ${whatToDoItems[2] ? escapeHtml(whatToDoItems[2]) : "&nbsp;"}</p>
  <hr style="margin: 22px 0; border: none; border-top: 2px solid #0E5A72;" />
  <h3 style="color: #0e5a72; margin: 0px 0px 8px; text-align: right;"><img src="${BRAND_ASSETS.submissionIcon}" alt="Submission Details icon" /> Submission Details</h3>
  <p style="font-size: 1.05em; margin: 0px; text-align: right;">${submissionPrimary}</p>
  <p style="text-align: center; margin-top: 20px;"><img style="max-width: 100%; height: auto; border-radius: 6px;" src="${BRAND_ASSETS.footerBanner}" alt="Machinists Institute Footer Banner" /></p>
</div>`.trim();
}
