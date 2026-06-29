"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Save, X } from "lucide-react";

type CourseResourceLinksProps = {
  courseId: string;
  initialSyllabusUrl: string | null;
  initialCanvasShellUrl: string | null;
  isAdmin: boolean;
};

export function CourseResourceLinks({ courseId, initialSyllabusUrl, initialCanvasShellUrl, isAdmin }: CourseResourceLinksProps) {
  const [syllabusUrl, setSyllabusUrl] = useState(initialSyllabusUrl ?? "");
  const [canvasShellUrl, setCanvasShellUrl] = useState(initialCanvasShellUrl ?? "");
  const [draftSyllabusUrl, setDraftSyllabusUrl] = useState(syllabusUrl);
  const [draftCanvasShellUrl, setDraftCanvasShellUrl] = useState(canvasShellUrl);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  function resetDrafts() {
    setDraftSyllabusUrl(syllabusUrl);
    setDraftCanvasShellUrl(canvasShellUrl);
    setMessage("");
    setMessageKind("success");
  }

  async function saveLinks() {
    setBusy(true);
    setMessage("");
    setMessageKind("success");
    const response = await fetch(`/api/courses/${courseId}/resources`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        syllabusUrl: draftSyllabusUrl,
        canvasShellUrl: draftCanvasShellUrl
      })
    });
    const payload = (await response.json().catch(() => null)) as { course?: { syllabusUrl: string | null; canvasShellUrl: string | null }; error?: string } | null;
    setBusy(false);

    if (!response.ok || !payload?.course) {
      setMessage(payload?.error || "Could not update course resources.");
      setMessageKind("error");
      return;
    }

    setSyllabusUrl(payload.course.syllabusUrl ?? "");
    setCanvasShellUrl(payload.course.canvasShellUrl ?? "");
    setDraftSyllabusUrl(payload.course.syllabusUrl ?? "");
    setDraftCanvasShellUrl(payload.course.canvasShellUrl ?? "");
    setEditing(false);
    setMessage("Course resource links updated.");
    setMessageKind("success");
  }

  return (
    <section className="panel course-resource-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Course Resources</div>
          <h2>Syllabus & Course Template</h2>
        </div>
        {isAdmin && !editing ? (
          <button className="btn ghost subtle-action" type="button" onClick={() => setEditing(true)}>
            <Pencil size={16} />
            Edit Links
          </button>
        ) : null}
      </div>

      <div className="course-resource-grid">
        <ResourceCard label="Syllabus Document" url={syllabusUrl} />
        <ResourceCard label="Course Template" url={canvasShellUrl} />
      </div>

      {editing ? (
        <div className="course-resource-editor">
          <div className="field">
            <label htmlFor="syllabusUrl">Syllabus URL</label>
            <input id="syllabusUrl" value={draftSyllabusUrl} onChange={(event) => setDraftSyllabusUrl(event.target.value)} placeholder="https://..." />
          </div>
          <div className="field">
            <label htmlFor="canvasShellUrl">Course Template URL</label>
            <input id="canvasShellUrl" value={draftCanvasShellUrl} onChange={(event) => setDraftCanvasShellUrl(event.target.value)} placeholder="https://..." />
          </div>
          <div className="button-row full">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void saveLinks()}>
              <Save size={16} />
              Save Links
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                resetDrafts();
                setEditing(false);
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p className={messageKind === "error" ? "warning" : "inline-notice"}>{message}</p> : null}
    </section>
  );
}

function ResourceCard({ label, url }: { label: string; url: string }) {
  const hasUrl = /^https?:\/\//i.test(url);

  return (
    <div className="course-resource-card">
      <div>
        <span>{label}</span>
        <strong>{hasUrl ? "Ready" : "Not linked yet"}</strong>
      </div>
      {hasUrl ? (
        <a className="btn primary subtle-action" href={url} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          Open
        </a>
      ) : (
        <span className="course-resource-missing">Not linked yet</span>
      )}
    </div>
  );
}
