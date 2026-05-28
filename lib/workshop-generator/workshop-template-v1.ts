import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderText(value: string) {
  if (!value.trim()) {
    return '<p style="margin:0;color:#6c757d;">Pending instructor input.</p>';
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 0.75rem 0;line-height:1.5;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return '<p style="margin:0;color:#6c757d;">Pending instructor input.</p>';
  }

  return `<ul style="margin:0;padding-left:1.2rem;line-height:1.5;">${items
    .map((item) => `<li style="margin-bottom:0.35rem;">${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

type SectionConfig = {
  heading: string;
  content: string;
};

function renderSection(section: SectionConfig) {
  return `
  <section style="margin:0 0 1.1rem 0;padding:0.9rem;border:1px solid #d9dde2;border-radius:8px;background:#fff;">
    <h2 style="margin:0 0 0.65rem 0;font-size:1.15rem;color:#0e4d70;">${escapeHtml(section.heading)}</h2>
    ${section.content}
  </section>`;
}

export function renderWorkshopTemplateV1(input: WorkshopInput) {
  const sections = [
    renderSection({ heading: "Workshop Overview", content: renderText(input.overview) }),
    renderSection({ heading: "Learning Objectives", content: renderList(input.objectives) }),
    renderSection({ heading: "Student Task / Project Description", content: renderText(input.studentTask) }),
    renderSection({ heading: "Materials", content: renderList(input.materials) }),
    renderSection({ heading: "Equipment", content: renderList(input.equipment) }),
    renderSection({ heading: "Workshop Flow / Class Sequence", content: renderList(input.workshopFlow) }),
    renderSection({ heading: "Submission Requirements", content: renderList(input.submissionRequirements) }),
    renderSection({ heading: "Learning Assets / Links", content: renderList(input.learningAssets) }),
    renderSection({ heading: "Safety Notes", content: renderText(input.safetyNotes) }),
    renderSection({ heading: "Estimated Duration", content: renderText(input.estimatedDuration) }),
    renderSection({ heading: "Instructor Preparation Notes", content: renderText(input.instructorPrepNotes) }),
    renderSection({ heading: "Assessment or Completion Criteria", content: renderText(input.assessmentCriteria) }),
    renderSection({ heading: "Cleanup / Reset Instructions", content: renderText(input.cleanupResetInstructions) })
  ];

  return `
<!-- ASSUMPTION: Starter Canvas workshop template pending replacement with official Machinists Institute HTML format. -->
<article style="font-family:Arial,sans-serif;color:#12212b;max-width:920px;">
  <header style="margin-bottom:1rem;padding:1rem;background:#f0f5f8;border:1px solid #c8d7e2;border-radius:8px;">
    <h1 style="margin:0 0 0.35rem 0;font-size:1.6rem;color:#0e4d70;">${escapeHtml(input.title || "Untitled Workshop")}</h1>
    <p style="margin:0;font-size:0.95rem;">
      <strong>Course:</strong> ${escapeHtml(input.courseLabel || "Not set")}
      &nbsp;|&nbsp;
      <strong>Term:</strong> ${escapeHtml(input.termCode || "Not set")}
    </p>
  </header>
  ${sections.join("\n")}
</article>`.trim();
}
