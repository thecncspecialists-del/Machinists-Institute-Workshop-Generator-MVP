"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Send, Settings, X } from "lucide-react";

type DebugIssueStatus = "OPEN" | "IN_PROGRESS" | "FIXED";

type DebugIssue = {
  id: string;
  title: string;
  description: string;
  pageUrl: string | null;
  status: DebugIssueStatus;
  adminResponse: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: DebugIssueStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DebugIssueOverlay() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "STAFF" | null>(null);
  const [issues, setIssues] = useState<DebugIssue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = role === "ADMIN";

  async function loadIssues() {
    const response = await fetch("/api/debug-issues", { cache: "no-store" });
    if (!response.ok) {
      setNotice("Issue reporting is unavailable right now.");
      return;
    }
    const payload = (await response.json()) as { role: "ADMIN" | "STAFF"; issues: DebugIssue[] };
    setRole(payload.role);
    setIssues(payload.issues);
  }

  useEffect(() => {
    setPortalRoot(document.body);
    void loadIssues();
  }, []);

  useEffect(() => {
    if (open) {
      void loadIssues();
    }
  }, [open]);

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/debug-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          pageUrl: window.location.href
        })
      });
      const payload = (await response.json()) as { issue?: DebugIssue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error || "Unable to submit issue.");
      setIssues((current) => [payload.issue as DebugIssue, ...current]);
      form.reset();
      setNotice("Issue submitted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit issue.");
    } finally {
      setBusy(false);
    }
  }

  async function updateIssue(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/debug-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: String(formData.get("status") ?? "OPEN"),
          adminResponse: String(formData.get("adminResponse") ?? "")
        })
      });
      const payload = (await response.json()) as { issue?: DebugIssue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error || "Unable to update issue.");
      setIssues((current) => current.map((issue) => (issue.id === id ? (payload.issue as DebugIssue) : issue)));
      setNotice("Issue updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update issue.");
    } finally {
      setBusy(false);
    }
  }

  const dialog =
    open && portalRoot
      ? createPortal(
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Debug issues">
          <div className="admin-dialog debug-issue-dialog">
            <div className="admin-dialog-header">
              <div>
                <h2>Debug Issues</h2>
                <p>{isAdmin ? "Review reported issues and respond with the fix." : "Submit an issue and check back for updates."}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close issue reporter" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="debug-issue-form" onSubmit={(event) => void submitIssue(event)}>
              <input name="title" placeholder="Short summary" required minLength={3} maxLength={140} disabled={busy} />
              <textarea name="description" placeholder="What happened?" required minLength={8} maxLength={4000} disabled={busy} />
              <div className="debug-issue-actions">
                <button className="btn primary" type="submit" disabled={busy}>
                  <Send size={15} />
                  Submit
                </button>
                <button className="btn ghost" type="button" disabled={busy} onClick={() => void loadIssues()}>
                  <RefreshCw size={15} />
                  Refresh
                </button>
                {notice ? <span role="status">{notice}</span> : null}
              </div>
            </form>

            <div className="debug-issue-list">
              {issues.length === 0 ? (
                <p className="debug-issue-empty">No issues submitted yet.</p>
              ) : (
                issues.map((issue) => (
                  <article className="debug-issue-card" key={issue.id}>
                    <div className="debug-issue-card-header">
                      <div>
                        <h3>{issue.title}</h3>
                        <p>
                          {isAdmin ? `${issue.reporterName || issue.reporterEmail || "Staff user"} - ` : ""}
                          {formatDate(issue.createdAt)}
                        </p>
                      </div>
                      <span className={`debug-issue-status ${issue.status.toLowerCase()}`}>{statusLabel(issue.status)}</span>
                    </div>
                    <p className="debug-issue-description">{issue.description}</p>
                    {issue.pageUrl && isAdmin ? (
                      <a className="debug-issue-page-link" href={issue.pageUrl} target="_blank" rel="noreferrer">
                        Reported page
                      </a>
                    ) : null}

                    {isAdmin ? (
                      <form className="debug-issue-admin-form" onSubmit={(event) => void updateIssue(event, issue.id)}>
                        <select name="status" defaultValue={issue.status} disabled={busy} aria-label={`Status for ${issue.title}`}>
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="FIXED">Fixed</option>
                        </select>
                        <textarea
                          name="adminResponse"
                          defaultValue={issue.adminResponse ?? ""}
                          placeholder="What was fixed or what should the reporter know?"
                          disabled={busy}
                        />
                        <button className="btn primary" type="submit" disabled={busy}>
                          Save
                        </button>
                      </form>
                    ) : issue.adminResponse ? (
                      <div className="debug-issue-response">
                        <strong>Admin response</strong>
                        <p>{issue.adminResponse}</p>
                        {issue.resolvedAt ? <span>Fixed {formatDate(issue.resolvedAt)}</span> : null}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>,
        portalRoot
      )
      : null;

  return (
    <>
      <button className="admin-gear-button" type="button" title="Report an issue" aria-label="Report an issue" onClick={() => setOpen(true)}>
        <Settings size={16} />
      </button>
      {dialog}
    </>
  );
}
