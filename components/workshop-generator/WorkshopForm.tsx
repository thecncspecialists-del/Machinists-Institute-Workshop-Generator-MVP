"use client";

import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";
import { isValidTermCode, termCodeHelperText } from "@/lib/workshop-generator/term-code";

type WorkshopFormProps = {
  value: WorkshopInput;
  onChange: (next: WorkshopInput) => void;
};

type FieldKey = Exclude<keyof WorkshopInput, "objectives" | "materials" | "equipment" | "workshopFlow" | "learningAssets" | "submissionRequirements" | "tags">;

const listFieldConfig: Array<{ key: keyof WorkshopInput; label: string }> = [
  { key: "materials", label: "Details: Materials (one per line)" },
  { key: "equipment", label: "Details: Additional Materials / Equipment (one per line)" },
  { key: "objectives", label: "Objectives (one per line)" },
  { key: "learningAssets", label: "Learning Resources (one per line)" },
  { key: "workshopFlow", label: "Workshop Flow (type sequence or day-by-day notes)" },
  { key: "submissionRequirements", label: "Submission Details (one per line)" },
  { key: "tags", label: "Tags (metadata, one per line)" }
];

export function WorkshopForm({ value, onChange }: WorkshopFormProps) {
  function updateField(key: FieldKey, nextValue: string) {
    onChange({ ...value, [key]: nextValue });
  }

  function updateList(key: keyof WorkshopInput, raw: string) {
    const listValue = raw
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    onChange({ ...value, [key]: listValue });
  }

  const hasTermCode = value.termCode.trim().length > 0;
  const isTermValid = isValidTermCode(value.termCode);

  return (
    <section className="panel">
      <div className="eyebrow">Generator Input</div>
      <h2>Workshop Information</h2>
      <p className="lede">Fill the form, preview updates live, then copy HTML into Canvas.</p>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field full">
          <label htmlFor="title">Activity Name *</label>
          <input id="title" value={value.title} onChange={(event) => updateField("title", event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="courseLabel">Course Name *</label>
          <input
            id="courseLabel"
            placeholder="MACH 102"
            value={value.courseLabel}
            onChange={(event) => updateField("courseLabel", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="termCode">Term Code (metadata) *</label>
          <input
            id="termCode"
            placeholder="SP2026"
            value={value.termCode}
            onChange={(event) => updateField("termCode", event.target.value.toUpperCase())}
          />
          <small className="inline-notice">{termCodeHelperText()}</small>
          {hasTermCode && !isTermValid ? <small style={{ color: "#a64f48" }}>Term format is invalid.</small> : null}
        </div>

        <div className="field full">
          <label htmlFor="overview">Overview *</label>
          <textarea id="overview" value={value.overview} onChange={(event) => updateField("overview", event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="estimatedDuration">Details: Duration</label>
          <input
            id="estimatedDuration"
            placeholder="#hrs (Days)"
            value={value.estimatedDuration}
            onChange={(event) => updateField("estimatedDuration", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="safetyNotes">Details: Format</label>
          <input
            id="safetyNotes"
            placeholder="Hands-on workshop"
            value={value.safetyNotes}
            onChange={(event) => updateField("safetyNotes", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="studentTask">Details: Scope *</label>
          <textarea
            id="studentTask"
            value={value.studentTask}
            onChange={(event) => updateField("studentTask", event.target.value)}
          />
        </div>

        {listFieldConfig.map((field) => (
          <div className="field full" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            <textarea
              id={field.key}
              value={(value[field.key] as string[]).join("\n")}
              onChange={(event) => updateList(field.key, event.target.value)}
            />
          </div>
        ))}

        <div className="field full">
          <label htmlFor="instructorPrepNotes">What To Do Steps (one per line for Step 1-3)</label>
          <textarea
            id="instructorPrepNotes"
            value={value.instructorPrepNotes}
            onChange={(event) => updateField("instructorPrepNotes", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="assessmentCriteria">Internal Notes (optional)</label>
          <textarea
            id="assessmentCriteria"
            value={value.assessmentCriteria}
            onChange={(event) => updateField("assessmentCriteria", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="cleanupResetInstructions">Additional Internal Notes (optional)</label>
          <textarea
            id="cleanupResetInstructions"
            value={value.cleanupResetInstructions}
            onChange={(event) => updateField("cleanupResetInstructions", event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
