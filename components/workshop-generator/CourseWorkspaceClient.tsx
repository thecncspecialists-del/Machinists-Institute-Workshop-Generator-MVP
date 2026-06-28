"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { useWorkflowContext } from "@/components/workflow-context";
import { CopyHtmlButton } from "@/components/workshop-generator/CopyHtmlButton";
import { buildCourseBreadcrumbs, CanvasReadinessPanel, EditorBreadcrumbs, SaveStateBadge } from "@/components/workshop-generator/EditorStatus";
import { WorkshopPreview } from "@/components/workshop-generator/WorkshopPreview";
import { DEFAULT_HOME_PAGE_INPUT } from "@/lib/workshop-generator/default-home-page-input";
import { createHomePageInputFromCourse, type CourseHomePageSeed, type CourseWorkspaceSummary } from "@/lib/workshop-generator/course-workspaces";
import { createSaveState, getCanvasReadiness, hasPassedCanvasReadiness, isEditorDirty, type SaveState } from "@/lib/workshop-generator/editor-state";
import { generateHomePageHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";

type CourseReference = CourseHomePageSeed & {
  assets?: { id: string; title: string; status: string; assetType: string }[];
};

type CourseWorkspaceClientProps = {
  course: CourseReference | null;
  initialWorkspace: CourseWorkspaceSummary | null;
};

type HomePageTextField = Exclude<keyof HomePageInput, "overviewParagraphs" | "skills">;

function toParagraphDraft(input: HomePageInput) {
  return input.overviewParagraphs.join("\n\n");
}

export function CourseWorkspaceClient({ course, initialWorkspace }: CourseWorkspaceClientProps) {
  const { updateWorkflowContext } = useWorkflowContext();
  const initialInput = initialWorkspace?.homePageInputJson ?? (course ? createHomePageInputFromCourse(course) : DEFAULT_HOME_PAGE_INPUT);
  const [workspace, setWorkspace] = useState<CourseWorkspaceSummary | null>(initialWorkspace);
  const [homePage, setHomePage] = useState<HomePageInput>(initialInput);
  const [lastSavedHomePage, setLastSavedHomePage] = useState<HomePageInput>(initialInput);
  const [overviewDraft, setOverviewDraft] = useState(() => toParagraphDraft(initialInput));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; success: boolean } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(() => createSaveState("idle"));

  const html = useMemo(() => generateHomePageHtml(homePage), [homePage]);
  const courseTitle = course ? [course.courseCode, course.courseName].filter(Boolean).join(" - ") : "";
  const isDirty = isEditorDirty(homePage, lastSavedHomePage);
  const canvasReadiness = getCanvasReadiness({
    hasCopyTarget: Boolean(html),
    requiredContextPresent: Boolean(homePage.courseTitle),
    sourceHtml: html
  });
  const canCopyHtml = hasPassedCanvasReadiness(canvasReadiness);

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
    if (!course && !workspace) return;
    updateWorkflowContext({
      course: course ? { id: course.id, title: courseTitle, href: `/courses/${course.id}` } : null,
      workspace: workspace
        ? {
            id: workspace.id,
            title: workspace.title,
            href: `/workshop-generator/course-workspace?open=${workspace.id}`
          }
        : null,
      workshop: null,
      workshops:
        workspace?.workshops.map((workshop) => ({
          id: workshop.id,
          title: workshop.title,
          href: `/workshop-generator?workspace=${workspace.id}&open=${workshop.id}`,
          units: workshop.units.map((unit) => ({
            id: unit.id,
            title: unit.title,
            label: `Unit ${unit.unitNumber}`,
            href: `/workshop-generator?workspace=${workspace.id}&open=${workshop.id}&unit=${unit.id}`
          }))
        })) ?? [],
      units: []
    });
  }, [course, courseTitle, updateWorkflowContext, workspace]);

  function updateField(key: HomePageTextField, value: string) {
    setHomePage((previous) => ({ ...previous, [key]: value }));
  }

  function updateOverview(raw: string) {
    setOverviewDraft(raw);
    setHomePage((previous) => ({
      ...previous,
      overviewParagraphs: raw
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    }));
  }

  function updateSkill(index: number, key: "title" | "description", value: string) {
    setHomePage((previous) => ({
      ...previous,
      skills: previous.skills.map((skill, skillIndex) => (skillIndex === index ? { ...skill, [key]: value } : skill))
    }));
  }

  function addSkill() {
    setHomePage((previous) => ({
      ...previous,
      skills: [...previous.skills, { title: "", description: "" }]
    }));
  }

  function removeSkill(index: number) {
    setHomePage((previous) => ({
      ...previous,
      skills: previous.skills.filter((_, skillIndex) => skillIndex !== index)
    }));
  }

  async function deleteWorkshop(workshopId: string, workshopTitle: string, unitCount: number) {
    const confirmed = window.confirm(
      `Delete "${workshopTitle}"?\n\nThis will remove the workshop from this class and hide its units from the class workflow. This can be destructive.`
    );
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${workshopId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete workshop.");
      }
      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              workshops: previous.workshops.filter((workshop) => workshop.id !== workshopId),
              counts: {
                ...previous.counts,
                workshops: Math.max(0, previous.counts.workshops - 1),
                units: Math.max(0, previous.counts.units - unitCount)
              }
            }
          : previous
      );
      setNotice({ message: "Workshop deleted from class.", success: true });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to delete workshop.", success: false });
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkspace() {
    if (!course) {
      setNotice({ message: "Select a course from the catalog before saving a class.", success: false });
      return;
    }

    setBusy(true);
    setSaveState(createSaveState("saving"));
    setNotice(null);
    try {
      const response = await fetch("/api/course-workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          courseId: course.id,
          homePage,
          sourceWorkspaceId: workspace?.id ?? null
        })
      });
      const payload = (await response.json()) as { workspace?: CourseWorkspaceSummary; saveMode?: string; error?: string };
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || "Failed to save class.");
      }
      setWorkspace(payload.workspace);
      setHomePage(payload.workspace.homePageInputJson);
      setLastSavedHomePage(payload.workspace.homePageInputJson);
      setOverviewDraft(toParagraphDraft(payload.workspace.homePageInputJson));
      setNotice({
        message: payload.saveMode === "updated" ? "Class updated." : "Class created.",
        success: true
      });
      setSaveState(createSaveState("saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save class.";
      setNotice({ message, success: false });
      setSaveState(createSaveState("error", message));
    } finally {
      setBusy(false);
    }
  }

  if (!course) {
    return (
      <section className="panel">
        <div className="eyebrow">Class</div>
        <h1 className="page-title-compact">Select a catalog course first.</h1>
        <Link className="btn primary" href="/courses">
          Open Course Catalog
        </Link>
      </section>
    );
  }

  return (
    <div className="grid create-workspace workshop-workspace mode-home-page">
      {notice ? (
        <div className={`notification-strip ${notice.success ? "info" : ""}`} role="status">
          {notice.message}
        </div>
      ) : null}
      <div className="create-input-panel">
        <header className="panel builder-mode-panel">
          <EditorBreadcrumbs
            items={buildCourseBreadcrumbs({
              courseId: course.id,
              workspaceId: workspace?.id,
              includeCourseDetails: true,
              includeHome: true
            })}
          />
          <h1 className="builder-title">Edit: {workspace?.title || courseTitle || "New Class"}</h1>
          <div className="builder-action-strip editor-primary-strip">
            <button className="btn primary mode-save-button" type="button" onClick={saveWorkspace} disabled={busy}>
              {busy ? "Saving..." : "Save Class"}
            </button>
            <SaveStateBadge state={saveState} />
            {workspace ? (
              <a className="btn ghost subtle-action" href={`/api/course-workspaces/${workspace.id}/image-package`}>
                Export Images
              </a>
            ) : null}
            <Link className="btn ghost subtle-action" href={`/courses/${course.id}`}>
              Details
            </Link>
          </div>
        </header>

        <section className="panel">
          <div className="form-panel-header">
            <div>
              <h2>Workshops</h2>
            </div>
          </div>
          {!workspace ? (
            <div className="empty-state">Save the class before creating workshops.</div>
          ) : workspace.workshops.length === 0 ? (
            <div className="workspace-workshop-empty">
              <p>No workshops yet.</p>
              <Link className="btn primary" href={`/workshop-generator?workspace=${workspace.id}`}>
                Create Workshop
              </Link>
            </div>
          ) : (
            <div className="workspace-workshop-list" aria-label="Course workshops">
              {workspace.workshops.map((workshop) => (
                <div className="workspace-workshop-row" key={workshop.id}>
                  <Link className="workspace-workshop-item" href={`/workshop-generator?workspace=${workspace.id}&open=${workshop.id}`}>
                    <span>Workshop</span>
                    <strong>{workshop.title}</strong>
                    <small>{workshop.unitCount} unit{workshop.unitCount === 1 ? "" : "s"}</small>
                  </Link>
                  <button
                    aria-label={`Delete ${workshop.title}`}
                    className="icon-danger-button"
                    title="Delete workshop"
                    type="button"
                    onClick={() => void deleteWorkshop(workshop.id, workshop.title, workshop.unitCount)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="form-panel-header">
            <div>
              <h2>Course Homepage</h2>
            </div>
          </div>
          <div className="editor-form-surface">
            <div className="form-grid step-form-grid">
              <div className="field full">
                <label htmlFor="courseTitle">Course Title *</label>
                <input id="courseTitle" required value={homePage.courseTitle} onChange={(event) => updateField("courseTitle", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="duration">Duration</label>
                <input id="duration" value={homePage.duration} onChange={(event) => updateField("duration", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="totalHours">Total Hours</label>
                <input id="totalHours" value={homePage.totalHours} onChange={(event) => updateField("totalHours", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="logoFileName">Logo Filename</label>
                <input id="logoFileName" value={homePage.logoFileName} onChange={(event) => updateField("logoFileName", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="heroFileName">Header Filename</label>
                <input id="heroFileName" value={homePage.heroFileName} onChange={(event) => updateField("heroFileName", event.target.value)} />
              </div>
              <div className="field full">
                <label htmlFor="overviewParagraphs">Homepage Overview</label>
                <textarea id="overviewParagraphs" value={overviewDraft} onChange={(event) => updateOverview(event.target.value)} />
              </div>
            </div>

            <div className="source-panel-header skill-list-header">
              <div>
                <h3>Skills You Will Build</h3>
              </div>
              <button className="btn ghost subtle-action" type="button" onClick={addSkill}>
                Add Skill
              </button>
            </div>
            <div className="home-skill-list">
              <div className="home-skill-list-heading" aria-hidden="true">
                <span>Skill</span>
                <span>Description</span>
                <span></span>
              </div>
              {homePage.skills.map((skill, index) => (
                <div className="home-skill-card" key={`${index}-${skill.title}`}>
                  <div className="field">
                    <label className="sr-only" htmlFor={`skill-title-${index}`}>Skill</label>
                    <input id={`skill-title-${index}`} value={skill.title} onChange={(event) => updateSkill(index, "title", event.target.value)} />
                  </div>
                  <div className="field">
                    <label className="sr-only" htmlFor={`skill-description-${index}`}>Description</label>
                    <textarea id={`skill-description-${index}`} value={skill.description} onChange={(event) => updateSkill(index, "description", event.target.value)} />
                  </div>
                  <button
                    aria-label={`Delete skill ${index + 1}`}
                    className="icon-danger-button"
                    title="Delete skill"
                    type="button"
                    onClick={() => removeSkill(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="preview-panel">
        <WorkshopPreview html={html} title="Course Homepage" />
      </div>

      <section className="panel source-panel-wide">
        <div className="source-panel-header">
          <div>
            <div className="eyebrow">Copy Source</div>
            <h3>Canvas HTML</h3>
          </div>
          <CopyHtmlButton disabled={!canCopyHtml} html={html} onCopied={(message, success) => setNotice({ message, success })} />
        </div>
        <CanvasReadinessPanel items={canvasReadiness} />
        <pre className="html-code source-code-panel">{html}</pre>
      </section>
    </div>
  );
}
