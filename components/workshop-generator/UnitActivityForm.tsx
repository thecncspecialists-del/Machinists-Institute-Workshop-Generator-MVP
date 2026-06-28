"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";

type UnitActivityFormProps = {
  value: UnitActivityInput;
  onChange: (next: UnitActivityInput) => void;
  hasSelectedUnit: boolean;
  unitSelectionSignal?: number;
  onActivePreviewSection?: (section: string | null) => void;
  unitNavigation?: ReactNode;
};

type TextFieldKey = Exclude<
  keyof UnitActivityInput,
  | "learningObjectives"
  | "learningResources"
  | "materials"
  | "instructorDemonstration"
  | "activitySteps"
  | "whatToDoItems"
  | "studentCheckQuestions"
  | "checkoffItems"
  | "beforeMovingOnItems"
>;

type ListFieldKey =
  | "learningObjectives"
  | "learningResources"
  | "materials"
  | "instructorDemonstration"
  | "activitySteps"
  | "whatToDoItems"
  | "studentCheckQuestions"
  | "checkoffItems"
  | "beforeMovingOnItems";

const listFieldConfig: Array<{ key: ListFieldKey; label: string }> = [
  { key: "learningObjectives", label: "Learning Objectives (one per line)" },
  { key: "learningResources", label: "Learning Resources (one per line)" },
  { key: "materials", label: "What You'll Need (one per line)" },
  { key: "instructorDemonstration", label: "Instructor Demonstration (one per line)" },
  { key: "activitySteps", label: "User Manual / Activity Steps (one per line)" },
  { key: "whatToDoItems", label: "What To Do Checklist (one per line)" },
  { key: "studentCheckQuestions", label: "Student Check Questions (one per line)" },
  { key: "checkoffItems", label: "Instructor Checkoff Items (one per line)" },
  { key: "beforeMovingOnItems", label: "Before Moving On Checklist (one per line)" }
];

const listFieldKeys = listFieldConfig.map((field) => field.key);
const steps = [
  { id: "outline", label: "Outline" },
  { id: "basics", label: "Basics" },
  { id: "resources", label: "Resources" },
  { id: "activity", label: "Activity" },
  { id: "checkoff", label: "Checkoff" }
] as const;

function toListDrafts(input: UnitActivityInput): Record<ListFieldKey, string> {
  return {
    learningObjectives: input.learningObjectives.join("\n"),
    learningResources: input.learningResources.join("\n"),
    materials: input.materials.join("\n"),
    instructorDemonstration: input.instructorDemonstration.join("\n"),
    activitySteps: input.activitySteps.join("\n"),
    whatToDoItems: input.whatToDoItems.join("\n"),
    studentCheckQuestions: input.studentCheckQuestions.join("\n"),
    checkoffItems: input.checkoffItems.join("\n"),
    beforeMovingOnItems: input.beforeMovingOnItems.join("\n")
  };
}

export function UnitActivityForm({ value, onActivePreviewSection, onChange, hasSelectedUnit, unitNavigation, unitSelectionSignal = 0 }: UnitActivityFormProps) {
  const [listDrafts, setListDrafts] = useState<Record<ListFieldKey, string>>(() => toListDrafts(value));
  const [activeListField, setActiveListField] = useState<ListFieldKey | null>(null);
  const [activeStep, setActiveStep] = useState<(typeof steps)[number]["id"]>("outline");

  useEffect(() => {
    const nextDrafts = toListDrafts(value);
    setListDrafts((previous) => {
      const merged = { ...previous };
      let changed = false;

      for (const key of listFieldKeys) {
        if (key === activeListField) continue;
        if (previous[key] !== nextDrafts[key]) {
          merged[key] = nextDrafts[key];
          changed = true;
        }
      }

      return changed ? merged : previous;
    });
  }, [activeListField, value]);

  useEffect(() => {
    if (!hasSelectedUnit) {
      setActiveStep("outline");
    }
  }, [hasSelectedUnit]);

  useEffect(() => {
    if (hasSelectedUnit) {
      setActiveStep("basics");
    }
  }, [hasSelectedUnit, unitSelectionSignal]);

  function updateField(key: TextFieldKey, nextValue: string) {
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
  const isOutlineStep = activeStep === "outline";

  function stepFields() {
    if (activeStep === "outline") {
      return null;
    }

    if (activeStep === "basics") {
      return (
        <>
          <div className="field">
            <label htmlFor="unitNumber">Unit Number *</label>
            <input id="unitNumber" placeholder="3" value={value.unitNumber} readOnly />
          </div>
          <div className="field">
            <label htmlFor="unitTitle">Unit Title *</label>
            <input id="unitTitle" placeholder="Cobot Assembly" value={value.title} onChange={(event) => updateField("title", event.target.value)} />
          </div>
          <div className="field full">
            <label htmlFor="purpose">Purpose *</label>
            <textarea
              id="purpose"
              value={value.purpose}
              onBlur={() => onActivePreviewSection?.(null)}
              onChange={(event) => updateField("purpose", event.target.value)}
              onFocus={() => onActivePreviewSection?.("Purpose")}
            />
          </div>
          <div className="field">
            <label htmlFor="estimatedTime">Estimated Time *</label>
            <input id="estimatedTime" placeholder="45-60 minutes" value={value.estimatedTime} onChange={(event) => updateField("estimatedTime", event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="heroImageUrl">Optional Image URL</label>
            <input id="heroImageUrl" placeholder="Canvas image preview URL" value={value.heroImageUrl} onChange={(event) => updateField("heroImageUrl", event.target.value)} />
          </div>
        </>
      );
    }

    if (activeStep === "resources") {
      return (
        <>
          <div className="field">
            <label htmlFor="prerequisiteText">Prerequisite Text</label>
            <input id="prerequisiteText" placeholder="Complete Unit 2 | Robot Safety" value={value.prerequisiteText} onChange={(event) => updateField("prerequisiteText", event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="prerequisiteUrl">Prerequisite URL</label>
            <input id="prerequisiteUrl" placeholder="Canvas assignment or page URL" value={value.prerequisiteUrl} onChange={(event) => updateField("prerequisiteUrl", event.target.value)} />
          </div>
          {(["learningObjectives", "learningResources", "materials"] as ListFieldKey[]).map((key) => (
            <div className="field full" key={key}>
              <label htmlFor={key}>{listFieldConfig.find((field) => field.key === key)?.label}</label>
              <textarea
                id={key}
                value={listDrafts[key]}
                onFocus={() => {
                  setActiveListField(key);
                  onActivePreviewSection?.(
                    key === "learningObjectives" ? "Learning Objectives" : key === "learningResources" ? "Learning Resources" : "What You'll Need"
                  );
                }}
                onBlur={() => {
                  setActiveListField(null);
                  onActivePreviewSection?.(null);
                }}
                onChange={(event) => updateList(key, event.target.value)}
              />
            </div>
          ))}
        </>
      );
    }

    if (activeStep === "activity") {
      return (
        <>
          <div className="field full">
            <label htmlFor="safetyReminder">Safety Reminder</label>
            <textarea
              id="safetyReminder"
              value={value.safetyReminder}
              onBlur={() => onActivePreviewSection?.(null)}
              onChange={(event) => updateField("safetyReminder", event.target.value)}
              onFocus={() => onActivePreviewSection?.("Safety Reminder")}
            />
          </div>
          <div className="field full">
            <label htmlFor="technicianTip">Technician Tip</label>
            <textarea id="technicianTip" value={value.technicianTip} onChange={(event) => updateField("technicianTip", event.target.value)} />
          </div>
          <div className="field full">
            <label htmlFor="activitySectionTitle">Activity Section Title</label>
            <input id="activitySectionTitle" value={value.activitySectionTitle} onChange={(event) => updateField("activitySectionTitle", event.target.value)} />
          </div>
          {(["instructorDemonstration", "activitySteps", "whatToDoItems"] as ListFieldKey[]).map((key) => (
            <div className="field full" key={key}>
              <label htmlFor={key}>{listFieldConfig.find((field) => field.key === key)?.label}</label>
              <textarea
                id={key}
                value={listDrafts[key]}
                onFocus={() => {
                  setActiveListField(key);
                  onActivePreviewSection?.(
                    key === "instructorDemonstration" ? "Instructor Demonstration" : key === "activitySteps" ? value.activitySectionTitle || "Activity" : "What To Do"
                  );
                }}
                onBlur={() => {
                  setActiveListField(null);
                  onActivePreviewSection?.(null);
                }}
                onChange={(event) => updateList(key, event.target.value)}
              />
            </div>
          ))}
        </>
      );
    }

    return (
      <>
        {(["studentCheckQuestions", "checkoffItems", "beforeMovingOnItems"] as ListFieldKey[]).map((key) => (
          <div className="field full" key={key}>
            <label htmlFor={key}>{listFieldConfig.find((field) => field.key === key)?.label}</label>
            <textarea
              id={key}
              value={listDrafts[key]}
              onFocus={() => {
                setActiveListField(key);
                onActivePreviewSection?.(
                  key === "studentCheckQuestions" ? "Student Check Questions" : key === "checkoffItems" ? "Instructor Checkoff" : "Before Moving On"
                );
              }}
              onBlur={() => {
                setActiveListField(null);
                onActivePreviewSection?.(null);
              }}
              onChange={(event) => updateList(key, event.target.value)}
            />
          </div>
        ))}
        <div className="field full">
          <label htmlFor="nextUnitLabel">Next Unit Label</label>
          <input id="nextUnitLabel" placeholder="Unit 4 | Startup and Basic Motion" value={value.nextUnitLabel} onChange={(event) => updateField("nextUnitLabel", event.target.value)} />
        </div>
      </>
    );
  }

  return (
    <section className="panel">
      <div className="form-panel-header">
        <div>
          <h2>{isOutlineStep ? "Units" : "Unit"}</h2>
        </div>
        <div className="header-stepper" aria-label="Unit step navigation">
          <button
            className="icon-btn"
            type="button"
            aria-label="Previous unit step"
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
            aria-label="Next unit step"
            disabled={activeStepIndex === steps.length - 1 || (isOutlineStep && !hasSelectedUnit)}
            onClick={() => setActiveStep(steps[Math.min(activeStepIndex + 1, steps.length - 1)].id)}
          >
            →
          </button>
        </div>
      </div>

      {isOutlineStep ? (
        <div className="unit-outline-page">
          {unitNavigation}
        </div>
      ) : (
        <div className="step-workspace compact">
          <div className="step-content">
            <div className="form-grid step-form-grid">
              {stepFields()}
            </div>
            <div className="step-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setActiveStep("outline")}
              >
                Unit Outline
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={activeStepIndex === steps.length - 1}
                onClick={() => setActiveStep(steps[Math.min(activeStepIndex + 1, steps.length - 1)].id)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
