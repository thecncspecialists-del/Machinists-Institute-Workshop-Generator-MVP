"use client";

import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";
import { isValidTermCode, termCodeHelperText } from "@/lib/workshop-generator/term-code";

type WorkshopFormProps = {
  value: WorkshopInput;
  onChange: (next: WorkshopInput) => void;
};

type FieldKey = Exclude<keyof WorkshopInput, "objectives" | "materials" | "equipment" | "workshopFlow" | "learningAssets" | "submissionRequirements" | "tags">;

const listFieldConfig: Array<{ key: keyof WorkshopInput; label: string; required?: boolean }> = [
  { key: "objectives", label: "Learning objectives" },
  { key: "materials", label: "Materials" },
  { key: "equipment", label: "Equipment" },
  { key: "workshopFlow", label: "Workshop flow / class sequence" },
  { key: "learningAssets", label: "Learning assets / links" },
  { key: "submissionRequirements", label: "Submission requirements" },
  { key: "tags", label: "Tags (one per line)" }
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
          <label htmlFor="title">Workshop title *</label>
          <input id="title" value={value.title} onChange={(event) => updateField("title", event.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="courseLabel">Course *</label>
          <input
            id="courseLabel"
            placeholder="MACH 102"
            value={value.courseLabel}
            onChange={(event) => updateField("courseLabel", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="termCode">Term *</label>
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

        <div className="field full">
          <label htmlFor="studentTask">Student task / project description *</label>
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
          <label htmlFor="safetyNotes">Safety notes</label>
          <textarea
            id="safetyNotes"
            value={value.safetyNotes}
            onChange={(event) => updateField("safetyNotes", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="estimatedDuration">Estimated duration</label>
          <input
            id="estimatedDuration"
            value={value.estimatedDuration}
            onChange={(event) => updateField("estimatedDuration", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="instructorPrepNotes">Instructor preparation notes</label>
          <textarea
            id="instructorPrepNotes"
            value={value.instructorPrepNotes}
            onChange={(event) => updateField("instructorPrepNotes", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="assessmentCriteria">Assessment or completion criteria</label>
          <textarea
            id="assessmentCriteria"
            value={value.assessmentCriteria}
            onChange={(event) => updateField("assessmentCriteria", event.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="cleanupResetInstructions">Cleanup / reset instructions</label>
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
