"use client";

import { useEffect, useState } from "react";

import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";
import { isValidTermCode, termCodeHelperText } from "@/lib/workshop-generator/term-code";

type WorkshopFormProps = {
  value: WorkshopInput;
  onChange: (next: WorkshopInput) => void;
};

type FieldKey = Exclude<keyof WorkshopInput, "objectives" | "materials" | "equipment" | "workshopFlow" | "learningAssets" | "submissionRequirements" | "tags">;
type ListFieldKey = "materials" | "equipment" | "objectives" | "learningAssets" | "workshopFlow" | "submissionRequirements" | "tags";

const listFieldConfig: Array<{ key: ListFieldKey; label: string }> = [
  { key: "materials", label: "Details: Materials (one per line)" },
  { key: "equipment", label: "Details: Additional Materials / Equipment (one per line)" },
  { key: "objectives", label: "Objectives (one per line)" },
  { key: "learningAssets", label: "Learning Resources (one per line)" },
  { key: "workshopFlow", label: "Workshop Flow (type sequence or day-by-day notes)" },
  { key: "submissionRequirements", label: "Submission Details (one per line)" },
  { key: "tags", label: "Tags (metadata, one per line)" }
];

const listFieldKeys: ListFieldKey[] = listFieldConfig.map((field) => field.key);

function toListDrafts(input: WorkshopInput): Record<ListFieldKey, string> {
  return {
    materials: input.materials.join("\n"),
    equipment: input.equipment.join("\n"),
    objectives: input.objectives.join("\n"),
    learningAssets: input.learningAssets.join("\n"),
    workshopFlow: input.workshopFlow.join("\n"),
    submissionRequirements: input.submissionRequirements.join("\n"),
    tags: input.tags.join("\n")
  };
}

export function WorkshopForm({ value, onChange }: WorkshopFormProps) {
  const [listDrafts, setListDrafts] = useState<Record<ListFieldKey, string>>(() => toListDrafts(value));
  const [activeListField, setActiveListField] = useState<ListFieldKey | null>(null);

  useEffect(() => {
    const nextDrafts = toListDrafts(value);
    setListDrafts((previous) => {
      const merged = { ...previous };
      let changed = false;

      for (const key of listFieldKeys) {
        if (key === activeListField) {
          continue;
        }
        if (previous[key] !== nextDrafts[key]) {
          merged[key] = nextDrafts[key];
          changed = true;
        }
      }

      return changed ? merged : previous;
    });
  }, [activeListField, value]);

  function updateField(key: FieldKey, nextValue: string) {
    onChange({ ...value, [key]: nextValue });
  }

  function updateList(key: ListFieldKey, raw: string) {
    setListDrafts((previous) => ({ ...previous, [key]: raw }));
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
              value={listDrafts[field.key]}
              onFocus={() => setActiveListField(field.key)}
              onBlur={() => setActiveListField(null)}
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
