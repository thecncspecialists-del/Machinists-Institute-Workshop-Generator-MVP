"use client";

import { useEffect, useState } from "react";

import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

type WorkshopFormProps = {
  value: WorkshopInput;
  onChange: (next: WorkshopInput) => void;
  busy?: boolean;
  onActivePreviewSection?: (section: string | null) => void;
  saveDisabled?: boolean;
  onSave?: () => void;
};

type FieldKey = Exclude<keyof WorkshopInput, "objectives" | "materials" | "equipment" | "workshopFlow" | "learningAssets" | "submissionRequirements" | "tags">;
type ListFieldKey = "materials" | "equipment" | "objectives" | "learningAssets" | "workshopFlow" | "submissionRequirements" | "tags";

const listFieldConfig: Array<{ key: ListFieldKey; label: string }> = [
  { key: "materials", label: "Materials" },
  { key: "equipment", label: "Additional Materials / Equipment" },
  { key: "objectives", label: "Objectives (one per line)" },
  { key: "learningAssets", label: "Learning Resources (one per line)" },
  { key: "workshopFlow", label: "Workshop Flow (type sequence or day-by-day notes)" },
  { key: "submissionRequirements", label: "Submission Details (one per line)" },
  { key: "tags", label: "Tags (metadata, one per line)" }
];
const formatOptions = ["Hands-on workshop", "Demonstration", "Lab", "Discussion", "Project", "Lecture", "Self-paced activity"];

const listFieldKeys: ListFieldKey[] = listFieldConfig.map((field) => field.key);
const steps = [
  { id: "basics", label: "Basics" },
  { id: "details", label: "Details" },
  { id: "objectives", label: "Objectives" },
  { id: "flow", label: "Flow" },
  { id: "finish", label: "Finish" }
] as const;

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

export function WorkshopForm({ value, onActivePreviewSection, onChange, busy = false, saveDisabled = false, onSave }: WorkshopFormProps) {
  const [listDrafts, setListDrafts] = useState<Record<ListFieldKey, string>>(() => toListDrafts(value));
  const [activeListField, setActiveListField] = useState<ListFieldKey | null>(null);
  const [activeStep, setActiveStep] = useState<(typeof steps)[number]["id"]>("basics");

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

  const activeStepIndex = steps.findIndex((step) => step.id === activeStep);
  const isFinalStep = activeStepIndex === steps.length - 1;

  function stepFields() {
    if (activeStep === "basics") {
      return (
        <>
          <div className="field full">
            <label htmlFor="title">Workshop Name *</label>
            <input id="title" value={value.title} onChange={(event) => updateField("title", event.target.value)} />
            <small className="inline-notice">Example: Workshop 1</small>
          </div>
          <div className="field full">
            <label htmlFor="courseLabel">Course Name *</label>
            <input
              id="courseLabel"
              placeholder="MACH 102"
              value={value.courseLabel}
              onChange={(event) => updateField("courseLabel", event.target.value)}
            />
            <small className="inline-notice">Example: BERT 105 - Basic Robotics</small>
          </div>
          <div className="field full">
            <label htmlFor="overview">Overview *</label>
            <textarea
              id="overview"
              value={value.overview}
              onBlur={() => onActivePreviewSection?.(null)}
              onChange={(event) => updateField("overview", event.target.value)}
              onFocus={() => onActivePreviewSection?.("Overview")}
            />
            <small className="inline-notice">Example: Learners practice setup, operation, and troubleshooting for a common shop task.</small>
          </div>
        </>
      );
    }

    if (activeStep === "details") {
      return (
        <>
          <div className="field">
            <label htmlFor="estimatedDuration">Duration</label>
            <input
              id="estimatedDuration"
              placeholder="#hrs (Days)"
              value={value.estimatedDuration}
              onChange={(event) => updateField("estimatedDuration", event.target.value)}
            />
            <small className="inline-notice">Example: 2 hrs or 1 day</small>
          </div>
          <div className="field">
            <label htmlFor="safetyNotes">Format</label>
            <select
              id="safetyNotes"
              value={value.safetyNotes}
              onChange={(event) => updateField("safetyNotes", event.target.value)}
            >
              <option value="">Select format</option>
              {formatOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <small className="inline-notice">Choose the closest instructional format.</small>
          </div>
          <div className="field full">
            <label htmlFor="materials">{listFieldConfig.find((field) => field.key === "materials")?.label}</label>
            <textarea
              id="materials"
              value={listDrafts.materials}
              onFocus={() => {
                setActiveListField("materials");
                onActivePreviewSection?.("Details");
              }}
              onBlur={() => {
                setActiveListField(null);
                onActivePreviewSection?.(null);
              }}
              onChange={(event) => updateList("materials", event.target.value)}
            />
            <small className="inline-notice">Example: Safety glasses, workbook, sample part</small>
          </div>
          <div className="field full">
            <label htmlFor="studentTask">Scope *</label>
            <textarea
              id="studentTask"
              value={value.studentTask}
              onBlur={() => onActivePreviewSection?.(null)}
              onChange={(event) => updateField("studentTask", event.target.value)}
              onFocus={() => onActivePreviewSection?.("Details")}
            />
            <small className="inline-notice">Example: Complete a guided setup, run the process, and document results.</small>
          </div>
        </>
      );
    }

    if (activeStep === "objectives") {
      return (
        <>
          <div className="field full">
            <label htmlFor="objectives">{listFieldConfig.find((field) => field.key === "objectives")?.label}</label>
            <textarea
              id="objectives"
              value={listDrafts.objectives}
              onFocus={() => {
                setActiveListField("objectives");
                onActivePreviewSection?.("Objectives");
              }}
              onBlur={() => {
                setActiveListField(null);
                onActivePreviewSection?.(null);
              }}
              onChange={(event) => updateList("objectives", event.target.value)}
            />
            <small className="inline-notice">Example: Identify key components; perform startup; verify safe operation</small>
          </div>
          <div className="field full">
            <label htmlFor="learningAssets">{listFieldConfig.find((field) => field.key === "learningAssets")?.label}</label>
            <textarea
              id="learningAssets"
              value={listDrafts.learningAssets}
              onFocus={() => {
                setActiveListField("learningAssets");
                onActivePreviewSection?.("Learning Resources");
              }}
              onBlur={() => {
                setActiveListField(null);
                onActivePreviewSection?.(null);
              }}
              onChange={(event) => updateList("learningAssets", event.target.value)}
            />
            <small className="inline-notice">Example: Reference guide, checklist, short demo video</small>
          </div>
        </>
      );
    }

    if (activeStep === "flow") {
      return (
        <>
          <div className="field full">
            <label htmlFor="workshopFlow">{listFieldConfig.find((field) => field.key === "workshopFlow")?.label}</label>
            <textarea
              id="workshopFlow"
              value={listDrafts.workshopFlow}
              onFocus={() => {
                setActiveListField("workshopFlow");
                onActivePreviewSection?.("Workshop Flow");
              }}
              onBlur={() => {
                setActiveListField(null);
                onActivePreviewSection?.(null);
              }}
              onChange={(event) => updateList("workshopFlow", event.target.value)}
            />
            <small className="inline-notice">Example: Demo, guided practice, independent task, group review</small>
          </div>
          <div className="field full">
            <label htmlFor="instructorPrepNotes">What To Do</label>
            <textarea
              id="instructorPrepNotes"
              value={value.instructorPrepNotes}
              onBlur={() => onActivePreviewSection?.(null)}
              onChange={(event) => updateField("instructorPrepNotes", event.target.value)}
              onFocus={() => onActivePreviewSection?.("What To Do")}
            />
            <small className="inline-notice">Add up to three short action lines, one per line.</small>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="field full">
          <label htmlFor="submissionRequirements">{listFieldConfig.find((field) => field.key === "submissionRequirements")?.label}</label>
          <textarea
            className="submission-details-input"
            id="submissionRequirements"
            value={listDrafts.submissionRequirements}
            onFocus={() => {
              setActiveListField("submissionRequirements");
              onActivePreviewSection?.("Submission Details");
            }}
            onBlur={() => {
              setActiveListField(null);
              onActivePreviewSection?.(null);
            }}
            onChange={(event) => updateList("submissionRequirements", event.target.value)}
          />
          <small className="inline-notice">Example: Submit a completed worksheet and photo of finished setup.</small>
        </div>
      </>
    );
  }

  return (
    <section className="panel">
      <div className="form-panel-header">
        <div>
          <h2>Workshop</h2>
        </div>
        <div className="header-stepper" aria-label="Workshop step navigation">
          <button
            className="icon-btn"
            type="button"
            aria-label="Previous workshop step"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStep(steps[Math.max(activeStepIndex - 1, 0)].id)}
          >
            ←
          </button>
          <div>
            <h3>{steps[activeStepIndex]?.label}</h3>
          </div>
          <button
            className="icon-btn"
            type="button"
            aria-label="Next workshop step"
            disabled={isFinalStep}
            onClick={() => setActiveStep(steps[Math.min(activeStepIndex + 1, steps.length - 1)].id)}
          >
            →
          </button>
        </div>
      </div>

      <div className="step-workspace compact">
        <div className="step-content">
          <div className="form-grid step-form-grid">
            {stepFields()}
          </div>
          <div className="step-actions">
            <button
              className="btn primary"
              type="button"
              disabled={isFinalStep ? busy || saveDisabled || !onSave : false}
              onClick={() => {
                if (isFinalStep) {
                  onSave?.();
                  return;
                }
                setActiveStep(steps[Math.min(activeStepIndex + 1, steps.length - 1)].id);
              }}
            >
              {isFinalStep ? (busy ? "Saving..." : "Save to Class") : "Next"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
