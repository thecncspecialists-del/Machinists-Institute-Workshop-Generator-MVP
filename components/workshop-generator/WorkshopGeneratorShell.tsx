"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { CopyHtmlButton } from "@/components/workshop-generator/CopyHtmlButton";
import { buildCourseBreadcrumbs, CanvasReadinessPanel, EditorBreadcrumbs, SaveStateBadge } from "@/components/workshop-generator/EditorStatus";
import { SaveWorkshopDialog } from "@/components/workshop-generator/SaveWorkshopDialog";
import { UnitActivityForm } from "@/components/workshop-generator/UnitActivityForm";
import { WorkshopForm } from "@/components/workshop-generator/WorkshopForm";
import { WorkshopPreview } from "@/components/workshop-generator/WorkshopPreview";
import { useWorkflowContext } from "@/components/workflow-context";
import type { CourseWorkspaceSummary } from "@/lib/workshop-generator/course-workspaces";
import { DEFAULT_UNIT_ACTIVITY_INPUT } from "@/lib/workshop-generator/default-unit-activity-input";
import { DEFAULT_WORKSHOP_INPUT } from "@/lib/workshop-generator/default-workshop-input";
import { createSaveState, getCanvasReadiness, hasPassedCanvasReadiness, isEditorDirty, type SaveState } from "@/lib/workshop-generator/editor-state";
import { generateUnitActivityHtml, generateWorkshopHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { UnitActivityInput } from "@/lib/workshop-generator/unit-activity-schema";
import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";
import { getUnitModeButtonState } from "@/lib/workshop-generator/workshop-workflow";
import type { WorkshopUnitSummary } from "@/lib/workshop-generator/workshop-units";

type LoadResponse = {
  workshop: {
    id: string;
    courseWorkspaceId?: string | null;
    inputJson: WorkshopInput;
    units?: WorkshopUnitSummary[];
  };
};

type SaveWorkshopResponse = {
  workshop: { id: string };
  error?: string;
  saveMode?: string;
};

const DEFAULT_WORKSHOP_TITLE = DEFAULT_WORKSHOP_INPUT.title;

export function WorkshopGeneratorShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: workflowContext, updateWorkflowContext } = useWorkflowContext();
  const [assetType, setAssetType] = useState<"workshop" | "unit-activity">("workshop");
  const [workshop, setWorkshop] = useState<WorkshopInput>(DEFAULT_WORKSHOP_INPUT);
  const [unitActivity, setUnitActivity] = useState<UnitActivityInput>(DEFAULT_UNIT_ACTIVITY_INPUT);
  const [units, setUnits] = useState<WorkshopUnitSummary[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitSelectionSignal, setUnitSelectionSignal] = useState(0);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [selectedCourseWorkspace, setSelectedCourseWorkspace] = useState<CourseWorkspaceSummary | null>(null);
  const [lastSavedWorkshop, setLastSavedWorkshop] = useState<WorkshopInput>(DEFAULT_WORKSHOP_INPUT);
  const [lastSavedUnitActivity, setLastSavedUnitActivity] = useState<UnitActivityInput>(DEFAULT_UNIT_ACTIVITY_INPUT);
  const [activePreviewSection, setActivePreviewSection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; success: boolean } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(() => createSaveState("idle"));

  const activeWorkshopContext = useMemo(
    () => ({
      id: selectedWorkshopId ?? "",
      title: workshop.title,
      courseLabel: workshop.courseLabel,
      termLabel: ""
    }),
    [selectedWorkshopId, workshop.courseLabel, workshop.title]
  );

  const contextualUnitActivity = useMemo(
    () => ({
      ...unitActivity,
      sourceWorkshopId: activeWorkshopContext.id,
      workshopTitle: activeWorkshopContext.title,
      courseLabel: activeWorkshopContext.courseLabel,
      termLabel: activeWorkshopContext.termLabel
    }),
    [activeWorkshopContext, unitActivity]
  );

  const html = useMemo(
    () => (assetType === "workshop" ? generateWorkshopHtml(workshop) : generateUnitActivityHtml(contextualUnitActivity)),
    [assetType, contextualUnitActivity, workshop]
  );
  const hasSelectedUnit = assetType === "unit-activity" && Boolean(selectedUnitId);
  const hasSavedWorkshop = Boolean(selectedWorkshopId);
  const hasCourseWorkspace = Boolean(selectedCourseWorkspace?.id);
  const unitModeButton = getUnitModeButtonState({ hasSavedWorkshop, unitCount: units.length });
  const previewHtml = assetType === "unit-activity" && !hasSelectedUnit ? "" : html;
  const sourceHtml = previewHtml;
  const isWorkshopDirty = assetType === "workshop" && isEditorDirty(workshop, lastSavedWorkshop);
  const isUnitDirty = assetType === "unit-activity" && hasSelectedUnit && isEditorDirty(unitActivity, lastSavedUnitActivity);
  const isDirty = isWorkshopDirty || isUnitDirty;
  const editorTitle =
    assetType === "unit-activity"
      ? `Edit: ${hasSelectedUnit ? unitActivity.title || `Unit ${unitActivity.unitNumber}` : "Select a unit"}`
      : `Edit: ${workshop.title || "Untitled workshop"}`;
  const canvasReadiness = getCanvasReadiness({
    hasCopyTarget: Boolean(sourceHtml),
    requiredContextPresent: assetType === "unit-activity" ? Boolean(selectedWorkshopId && selectedUnitId && unitActivity.title) : Boolean(workshop.title && workshop.courseLabel),
    sourceHtml
  });
  const canCopyHtml = Boolean(sourceHtml) && hasPassedCanvasReadiness(canvasReadiness);
  const builderBaseHref = selectedCourseWorkspace?.id
    ? `/workshop-generator?workspace=${selectedCourseWorkspace.id}${selectedWorkshopId ? `&open=${selectedWorkshopId}` : ""}`
    : "/workshop-generator";

  useEffect(() => {
    setSaveState((previous) => {
      if (busy) return previous;
      if (previous.status === "error" && !isDirty) return previous;
      return isDirty ? createSaveState("dirty") : previous.status === "dirty" ? createSaveState("idle") : previous;
    });
  }, [busy, isDirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const openWorkshopId = searchParams.get("open");
    if (!openWorkshopId || openWorkshopId === selectedWorkshopId) {
      return;
    }
    void loadWorkshop(openWorkshopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const workspaceId = searchParams.get("workspace") || workflowContext.workspace?.id;
    if (!workspaceId || workspaceId === selectedCourseWorkspace?.id) {
      return;
    }
    void loadCourseWorkspace(workspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, workflowContext.workspace?.id]);

  useEffect(() => {
    const unitId = searchParams.get("unit");
    if (!unitId) {
      if (selectedUnitId) {
        setSelectedUnitId(null);
        setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
        setAssetType("workshop");
      }
      return;
    }
    if (selectedUnitId === unitId) return;
    const unit = units.find((candidate) => candidate.id === unitId);
    if (unit) {
      setSelectedUnitId(unit.id);
      setUnitActivity(unit.inputJson);
      setLastSavedUnitActivity(unit.inputJson);
      setAssetType("unit-activity");
      setUnitSelectionSignal((previous) => previous + 1);
      setNotice(null);
    }
  }, [searchParams, selectedUnitId, units]);

  useEffect(() => {
    const courseTitle = selectedCourseWorkspace
      ? [selectedCourseWorkspace.course.courseCode, selectedCourseWorkspace.course.courseName].filter(Boolean).join(" - ")
      : null;
    const workshopTitle = workshop.title.trim() || "Untitled workshop draft";

    const workspaceWorkshops =
      selectedCourseWorkspace?.workshops.map((workspaceWorkshop) => ({
        id: workspaceWorkshop.id,
        title: workspaceWorkshop.title,
        href: `/workshop-generator?workspace=${selectedCourseWorkspace.id}&open=${workspaceWorkshop.id}`,
        active: workspaceWorkshop.id === selectedWorkshopId,
        units: (workspaceWorkshop.id === selectedWorkshopId && units.length > 0
          ? units.map((unit) => ({
              id: unit.id,
              unitNumber: unit.unitNumber,
              title: unit.title
            }))
          : workspaceWorkshop.units
        ).map((unit) => ({
          id: unit.id,
          title: unit.title,
          label: `Unit ${unit.unitNumber}`,
          href: `/workshop-generator?workspace=${selectedCourseWorkspace.id}&open=${workspaceWorkshop.id}&unit=${unit.id}`,
          active: workspaceWorkshop.id === selectedWorkshopId && unit.id === selectedUnitId
        }))
      })) ?? [];
    const currentWorkshop =
      selectedWorkshopId && !workspaceWorkshops.some((workspaceWorkshop) => workspaceWorkshop.id === selectedWorkshopId)
        ? [
            {
              id: selectedWorkshopId,
              title: workshopTitle,
              href: builderBaseHref,
              active: true,
              units: units.map((unit) => ({
                id: unit.id,
                title: unit.title,
                label: `Unit ${unit.unitNumber}`,
                href: `${builderBaseHref}&unit=${unit.id}`,
                active: unit.id === selectedUnitId
              }))
            }
          ]
        : [];

    updateWorkflowContext({
      ...(selectedCourseWorkspace && courseTitle
        ? {
            course: { id: selectedCourseWorkspace.course.id, title: courseTitle, href: `/courses/${selectedCourseWorkspace.course.id}` },
            workspace: {
              id: selectedCourseWorkspace.id,
              title: selectedCourseWorkspace.title,
              href: `/workshop-generator/course-workspace?open=${selectedCourseWorkspace.id}`
            }
          }
        : {}),
      workshop: {
        id: selectedWorkshopId ?? "draft-workshop",
        title: workshopTitle,
        href: builderBaseHref
      },
      workshops: [...workspaceWorkshops, ...currentWorkshop],
      units: units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        label: `Unit ${unit.unitNumber}`,
        href: `${builderBaseHref}&unit=${unit.id}`,
        active: unit.id === selectedUnitId
      }))
    });
  }, [builderBaseHref, selectedCourseWorkspace, selectedUnitId, selectedWorkshopId, units, updateWorkflowContext, workshop.title]);

  function clearWorkshop() {
    if (assetType === "workshop") {
      setWorkshop(createWorkshopDraft(selectedCourseWorkspace));
      setSelectedWorkshopId(null);
      setUnits([]);
      setSelectedUnitId(null);
      setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
      setNotice({ message: "Started a new workshop draft.", success: true });
      return;
    }
    setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
    setSelectedUnitId(null);
    setNotice({ message: "Unit editor cleared. Create or select a workshop unit.", success: true });
  }

  async function loadCourseWorkspace(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/course-workspaces/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as { workspace?: CourseWorkspaceSummary; error?: string };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || "Failed to load class.");
      }
      setSelectedCourseWorkspace(payload.workspace);
      const courseLabel = [payload.workspace?.course.courseCode, payload.workspace?.course.courseName].filter(Boolean).join(" - ");
      setWorkshop((previous) => ({
        ...previous,
        courseLabel,
        title:
          previous.title.trim().length === 0 || previous.title === DEFAULT_WORKSHOP_TITLE
            ? DEFAULT_WORKSHOP_TITLE
            : previous.title
      }));
      setNotice({ message: "Loaded class.", success: true });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to load class.", success: false });
    } finally {
      setBusy(false);
    }
  }

  async function loadWorkshop(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as LoadResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load workshop.");
      }
      setWorkshop(payload.workshop.inputJson);
      setLastSavedWorkshop(payload.workshop.inputJson);
      setAssetType("workshop");
      setSelectedWorkshopId(payload.workshop.id);
      setUnits(payload.workshop.units ?? []);
      setSelectedUnitId(null);
      setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
      setLastSavedUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
      if (payload.workshop.courseWorkspaceId) {
        void loadCourseWorkspace(payload.workshop.courseWorkspaceId);
      }
      setNotice({ message: "Loaded workshop.", success: true });
      setSaveState(createSaveState("idle"));
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to load workshop.", success: false });
    } finally {
      setBusy(false);
    }
  }

  async function persistWorkshop(workshopOverride?: WorkshopInput) {
    const workshopToSave = workshopOverride ?? workshop;
    const response = await fetch("/api/workshops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          workshop: workshopToSave,
          courseWorkspaceId: selectedCourseWorkspace?.id ?? null,
          sourceWorkshopId: selectedWorkshopId,
          saveAsCopy: false
        })
      });

    const payload = (await response.json()) as Partial<SaveWorkshopResponse>;
    if (!response.ok || !payload.workshop?.id) {
      throw new Error(payload.error || "Failed to save workshop.");
    }

    setSelectedWorkshopId(payload.workshop.id);
    return payload as SaveWorkshopResponse;
  }

  async function saveWorkshop() {
    if (!selectedCourseWorkspace) {
      setNotice({ message: "Save or open a class before saving workshops.", success: false });
      return;
    }

    setBusy(true);
    setSaveState(createSaveState("saving"));
    setNotice(null);
    try {
      const payload = await persistWorkshop();
      setLastSavedWorkshop(workshop);
      setNotice({
        message: payload.saveMode === "updated" ? "Workshop updated in class." : "Workshop saved to class.",
        success: true
      });
      setSaveState(createSaveState("saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save workshop.";
      setNotice({ message, success: false });
      setSaveState(createSaveState("error", message));
    } finally {
      setBusy(false);
    }
  }

  async function createUnitFromWorkshop() {
    if (!selectedCourseWorkspace) {
      setNotice({ message: "Save or open a class before creating workshops and units.", success: false });
      return;
    }

    if (!selectedWorkshopId) {
      setNotice({ message: "Save or open a workshop before creating units.", success: false });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${selectedWorkshopId}/units`, {
        method: "POST",
        headers: {
          "x-idempotency-key": crypto.randomUUID()
        }
      });
      const payload = (await response.json()) as { unit?: WorkshopUnitSummary; error?: string };
      if (!response.ok || !payload.unit) {
        throw new Error(payload.error || "Failed to create unit.");
      }
      setUnits((previous) => [...previous, payload.unit as WorkshopUnitSummary].sort((a, b) => a.unitNumber - b.unitNumber));
      setSelectedUnitId(payload.unit.id);
      setUnitActivity(payload.unit.inputJson);
      setLastSavedUnitActivity(payload.unit.inputJson);
      setAssetType("unit-activity");
      setUnitSelectionSignal((previous) => previous + 1);
      router.replace(`${builderBaseHref}&unit=${payload.unit.id}`, { scroll: false });
      setNotice({ message: `Created Unit ${payload.unit.unitNumber}.`, success: true });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to create unit.", success: false });
    } finally {
      setBusy(false);
    }
  }

  function handleUnitModeClick() {
    if (unitModeButton.action === "create-unit") {
      void createUnitFromWorkshop();
      return;
    }

    setAssetType("unit-activity");
  }

  function showWorkshopEditor() {
    setSelectedUnitId(null);
    setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
    setAssetType("workshop");
    router.replace(builderBaseHref, { scroll: false });
  }

  function selectUnit(unit: WorkshopUnitSummary) {
    setSelectedUnitId(unit.id);
    setUnitActivity(unit.inputJson);
    setLastSavedUnitActivity(unit.inputJson);
    setAssetType("unit-activity");
    setUnitSelectionSignal((previous) => previous + 1);
    router.replace(`${builderBaseHref}&unit=${unit.id}`, { scroll: false });
    setNotice(null);
  }

  async function deleteUnit(unit: WorkshopUnitSummary) {
    if (!selectedWorkshopId) return;
    const confirmed = window.confirm(`Delete Unit ${unit.unitNumber}: "${unit.title}"?`);
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${selectedWorkshopId}/units/${unit.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete unit.");
      }
      setUnits((previous) => previous.filter((candidate) => candidate.id !== unit.id));
      if (selectedUnitId === unit.id) {
        setSelectedUnitId(null);
        setUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
        setLastSavedUnitActivity(DEFAULT_UNIT_ACTIVITY_INPUT);
        router.replace(builderBaseHref, { scroll: false });
      }
      setNotice({ message: `Unit ${unit.unitNumber} deleted.`, success: true });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to delete unit.", success: false });
    } finally {
      setBusy(false);
    }
  }

  function renderUnitNavigation() {
    return (
      <div className="unit-nav-panel">
        <div className="unit-nav-header">
          <div>
            <div className="eyebrow">Workshop Units</div>
            <p>{units.length === 0 ? "Create Unit 1 to begin." : `${units.length} saved unit${units.length === 1 ? "" : "s"}`}</p>
          </div>
          <button className="btn unit-create-button" type="button" onClick={createUnitFromWorkshop} disabled={busy || !selectedWorkshopId}>
            {busy ? "Working..." : "Create Unit"}
          </button>
        </div>
        <div className="unit-nav-list" aria-label="Saved workshop units">
          {units.length === 0 ? (
            <div className="unit-empty-state">Units created here attach automatically to this workshop.</div>
          ) : (
            units.map((unit) => (
              <div className="unit-nav-row" key={unit.id}>
                <button
                  className={`unit-nav-item ${unit.id === selectedUnitId ? "active" : ""}`}
                  type="button"
                  onClick={() => selectUnit(unit)}
                >
                  <span>Unit {unit.unitNumber}</span>
                  <strong>{unit.title}</strong>
                </button>
                <button
                  aria-label={`Delete Unit ${unit.unitNumber}: ${unit.title}`}
                  className="icon-danger-button"
                  title="Delete unit"
                  type="button"
                  onClick={() => void deleteUnit(unit)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  async function saveUnitToWorkshop() {
    if (!selectedWorkshopId || !selectedUnitId) {
      setNotice({ message: "Create or select a unit before saving.", success: false });
      return;
    }

    setBusy(true);
    setSaveState(createSaveState("saving"));
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${selectedWorkshopId}/units/${selectedUnitId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ unit: contextualUnitActivity })
      });
      const payload = (await response.json()) as { unit?: WorkshopUnitSummary; error?: string };
      if (!response.ok || !payload.unit) {
        throw new Error(payload.error || "Failed to save unit.");
      }
      setUnits((previous) =>
        previous
          .map((unit) => (unit.id === payload.unit?.id ? payload.unit : unit))
          .sort((a, b) => a.unitNumber - b.unitNumber)
      );
      setUnitActivity(payload.unit.inputJson);
      setLastSavedUnitActivity(payload.unit.inputJson);
      setNotice({ message: `Unit ${payload.unit.unitNumber} saved to ${activeWorkshopContext.title || "workshop"}.`, success: true });
      setSaveState(createSaveState("saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save unit.";
      setNotice({ message, success: false });
      setSaveState(createSaveState("error", message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`grid create-workspace workshop-workspace mode-${assetType}`}>
      {notice ? (
        <div className={`notification-strip ${notice.success ? "info" : ""}`} role="status">
          {notice.message}
        </div>
      ) : null}
      <div className="create-input-panel">
        <header className="panel builder-mode-panel">
          <EditorBreadcrumbs
            items={buildCourseBreadcrumbs({
              courseId: selectedCourseWorkspace?.course.id,
              workspaceId: selectedCourseWorkspace?.id,
              workshopHref: selectedWorkshopId ? builderBaseHref : null,
              includeCourseDetails: true,
              includeHome: true,
              includeWorkshop: true,
              includeUnit: assetType === "unit-activity"
            })}
          />
          <h1 className="builder-title">{editorTitle}</h1>
          <div className="builder-action-strip editor-primary-strip">
            <div className="tabs compact-asset-tabs" aria-label="Editor mode">
              <button
                className={`tab ${assetType === "workshop" ? "active" : ""}`}
                type="button"
                onClick={showWorkshopEditor}
              >
                Workshop
              </button>
              <button
                className={`tab ${assetType === "unit-activity" ? "active" : ""}`}
                type="button"
                onClick={handleUnitModeClick}
                disabled={busy}
              >
                {unitModeButton.action === "create-unit" ? "Create Unit" : "Units"}
              </button>
            </div>
            <div className="editor-header-actions">
              <SaveStateBadge state={saveState} />
              {assetType === "unit-activity" ? (
                <SaveWorkshopDialog busy={busy} disabled={!selectedUnitId} label="Save Unit" onSave={saveUnitToWorkshop} />
              ) : null}
              {selectedCourseWorkspace ? (
                <button className="btn ghost subtle-action" type="button" onClick={() => router.push(`/workshop-generator/course-workspace?open=${selectedCourseWorkspace.id}`)}>
                  Home
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {!hasCourseWorkspace ? (
          <section className="panel unit-editor-gate">
            <h2>Open or create a class before building workshops.</h2>
            <div className="button-row">
              <button className="btn primary workshop-return-button" type="button" onClick={() => router.push("/courses")}>
                Open Course Catalog
              </button>
            </div>
          </section>
        ) : assetType === "workshop" ? (
          <WorkshopForm
            value={workshop}
            onChange={setWorkshop}
            onActivePreviewSection={setActivePreviewSection}
            busy={busy}
            saveDisabled={!hasCourseWorkspace}
            onSave={saveWorkshop}
          />
        ) : !hasSavedWorkshop ? (
          <section className="panel unit-editor-gate">
            <h2>Create a workshop before adding units.</h2>
            <div className="button-row">
              <button className="btn primary workshop-return-button" type="button" onClick={showWorkshopEditor}>
                Edit Workshop
              </button>
            </div>
          </section>
        ) : (
          <UnitActivityForm
            value={unitActivity}
            onChange={setUnitActivity}
            onActivePreviewSection={setActivePreviewSection}
            hasSelectedUnit={Boolean(selectedUnitId)}
            unitSelectionSignal={unitSelectionSignal}
            unitNavigation={renderUnitNavigation()}
          />
        )}
      </div>

      <div className="preview-panel">
        <WorkshopPreview
          emptyDescription={
            hasSavedWorkshop
              ? "Create or select a unit."
              : "Choose a workshop."
          }
          emptyTitle="No unit selected"
          html={previewHtml}
          activeSection={activePreviewSection}
          title={assetType === "unit-activity" ? "Unit Preview" : "Workshop Preview"}
        />
      </div>

      <section className="panel source-panel-wide">
        <div className="source-panel-header">
          <div>
            <div className="eyebrow">Copy Source</div>
            <h3>Canvas HTML</h3>
          </div>
          <CopyHtmlButton
            disabled={!canCopyHtml}
            html={sourceHtml}
            onCopied={(message, success) => setNotice({ message, success })}
          />
        </div>
        <CanvasReadinessPanel items={canvasReadiness} />
        {sourceHtml ? (
          <pre className="html-code source-code-panel">
            {sourceHtml}
          </pre>
        ) : (
          <div className="source-empty-state">
            {hasSavedWorkshop ? "Create or select a unit." : "Choose a workshop."}
          </div>
        )}
      </section>
    </div>
  );
}

function createWorkshopDraft(workspace: CourseWorkspaceSummary | null): WorkshopInput {
  const courseLabel = workspace ? [workspace.course.courseCode, workspace.course.courseName].filter(Boolean).join(" - ") : "";
  return {
    ...DEFAULT_WORKSHOP_INPUT,
    courseLabel,
    title: DEFAULT_WORKSHOP_TITLE,
    termCode: ""
  };
}
