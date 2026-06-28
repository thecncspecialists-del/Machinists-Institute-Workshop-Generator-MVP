"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, RefreshCw, Send, Settings, X } from "lucide-react";

import { useDebugIssues, type DebugIssue, type DebugIssueStatus, type DebugIssueView } from "@/components/debug/useDebugIssues";

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

function reporterLabel(issue: DebugIssue) {
  return issue.reporterName || issue.reporterEmail || "Staff user";
}

export function DebugIssueOverlay() {
  const [open, setOpen] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const {
    archiveIssue,
    busy,
    isAdmin,
    issues,
    loadIssues,
    markIssueRead,
    notice,
    replyToIssue,
    setView,
    submitIssue: submitIssueMutation,
    unarchiveIssue,
    updateIssue: updateIssueMutation,
    view
  } = useDebugIssues();

  const expandedIssue = useMemo(
    () => issues.find((issue) => issue.id === expandedIssueId) ?? null,
    [expandedIssueId, issues]
  );

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (open) {
      void loadIssues({ view });
    }
  }, [open]);

  useEffect(() => {
    function handleOpenIssue(event: Event) {
      const issueId = (event as CustomEvent<{ issueId?: string }>).detail?.issueId;
      if (!issueId) return;
      setOpen(true);
      setExpandedIssueId(issueId);
      void loadIssues({ view: "active", focus: issueId }).then((loaded) => {
        if (loaded.length > 0) {
          setExpandedIssueId(issueId);
          void markIssueRead(issueId);
        }
      });
    }

    window.addEventListener("debug-issue:open", handleOpenIssue);
    return () => window.removeEventListener("debug-issue:open", handleOpenIssue);
  }, [loadIssues, markIssueRead]);

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const submitted = await submitIssueMutation({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      pageUrl: window.location.href
    });
    if (submitted) {
      form.reset();
    }
  }

  async function updateIssue(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await updateIssueMutation({
      id,
      status: String(formData.get("status") ?? "OPEN") as DebugIssueStatus,
      adminResponse: String(formData.get("adminResponse") ?? "")
    });
  }

  async function submitReply(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "");
    const replied = await replyToIssue({ id, body });
    if (replied) {
      form.reset();
    }
  }

  async function switchView(nextView: DebugIssueView) {
    setView(nextView);
    setExpandedIssueId(null);
    await loadIssues({ view: nextView });
  }

  function toggleExpanded(issue: DebugIssue) {
    const nextExpanded = expandedIssueId === issue.id ? null : issue.id;
    setExpandedIssueId(nextExpanded);
    if (nextExpanded) {
      void markIssueRead(issue.id);
    }
  }

  const dialog =
    open && portalRoot
      ? createPortal(
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Debug issues">
          <div className="admin-dialog debug-issue-dialog">
            <div className="admin-dialog-header">
              <div>
                <h2>Debug Requests</h2>
                <p>{isAdmin ? "Scan requests, expand details, reply, resolve, and archive." : "Submit a request and follow admin replies."}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close issue reporter" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="debug-issue-form compact" onSubmit={(event) => void submitIssue(event)}>
              <input name="title" placeholder="Short summary" required minLength={3} maxLength={140} disabled={busy} />
              <textarea name="description" placeholder="What happened?" required minLength={8} maxLength={4000} disabled={busy} />
              <div className="debug-issue-actions">
                <button className="btn primary" type="submit" disabled={busy}>
                  <Send size={15} />
                  Submit
                </button>
                <button className="btn ghost" type="button" disabled={busy} onClick={() => void loadIssues({ view })}>
                  <RefreshCw size={15} />
                  Refresh
                </button>
                {notice ? <span role="status">{notice}</span> : null}
              </div>
            </form>

            {isAdmin ? (
              <div className="debug-request-tabs" role="tablist" aria-label="Debug request view">
                <button className={view === "active" ? "active" : ""} type="button" onClick={() => void switchView("active")}>
                  Active
                </button>
                <button className={view === "archived" ? "active" : ""} type="button" onClick={() => void switchView("archived")}>
                  Archived
                </button>
              </div>
            ) : null}

            <div className="debug-request-list" aria-label="Debug requests">
              <div className="debug-request-heading" aria-hidden="true">
                <span>Request</span>
                <span>Status</span>
                <span>Reporter</span>
                <span>Updated</span>
                <span>Messages</span>
              </div>
              {issues.length === 0 ? (
                <p className="debug-issue-empty">No {view === "archived" ? "archived" : "active"} requests.</p>
              ) : (
                issues.map((issue) => {
                  const expanded = expandedIssueId === issue.id;
                  return (
                    <article className={`debug-request-item ${expanded ? "expanded" : ""} ${issue.unread ? "unread" : ""}`} key={issue.id}>
                      <button className="debug-request-row" type="button" onClick={() => toggleExpanded(issue)} aria-expanded={expanded}>
                        <span className="debug-request-title">
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          <strong>{issue.title}</strong>
                          {issue.unread ? <em>New update</em> : null}
                        </span>
                        <span className={`debug-issue-status ${issue.status.toLowerCase()}`}>{statusLabel(issue.status)}</span>
                        <span>{reporterLabel(issue)}</span>
                        <span>{formatDate(issue.updatedAt)}</span>
                        <span>{issue.messageCount}</span>
                      </button>
                      {expanded && expandedIssue?.id === issue.id ? (
                        <div className="debug-request-detail">
                          <div className="debug-request-detail-grid">
                            <section>
                              <div className="eyebrow">Original request</div>
                              <p className="debug-issue-description">{issue.description}</p>
                              {issue.pageUrl && isAdmin ? (
                                <a className="debug-issue-page-link" href={issue.pageUrl} target="_blank" rel="noreferrer">
                                  Reported page
                                </a>
                              ) : null}
                            </section>
                            <section>
                              <div className="eyebrow">Request activity</div>
                              <div className="debug-message-thread">
                                {issue.messages.map((message) => (
                                  <div className={`debug-message ${message.authorRole.toLowerCase()}`} key={message.id}>
                                    <div>
                                      <strong>{message.authorName || message.authorEmail || (message.authorRole === "ADMIN" ? "Admin" : "Staff")}</strong>
                                      <span>{message.authorRole === "ADMIN" ? "Admin" : "Reporter"} · {formatDate(message.createdAt)}</span>
                                    </div>
                                    <p>{message.body}</p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>

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
                                placeholder="Optional status note for the reporter"
                                disabled={busy}
                              />
                              <button className="btn primary" type="submit" disabled={busy}>
                                Save Status
                              </button>
                            </form>
                          ) : null}

                          <form className="debug-reply-form" onSubmit={(event) => void submitReply(event, issue.id)}>
                            <textarea name="body" placeholder="Add a reply" required minLength={1} maxLength={4000} disabled={busy || Boolean(issue.archivedAt)} />
                            <button className="btn primary" type="submit" disabled={busy || Boolean(issue.archivedAt)}>
                              Reply
                            </button>
                          </form>

                          {isAdmin ? (
                            <div className="debug-archive-actions">
                              {issue.archivedAt ? (
                                <button className="btn ghost" type="button" disabled={busy} onClick={() => void unarchiveIssue(issue.id)}>
                                  <ArchiveRestore size={15} />
                                  Unarchive
                                </button>
                              ) : (
                                <button className="btn ghost" type="button" disabled={busy || issue.status !== "FIXED"} onClick={() => void archiveIssue(issue.id)}>
                                  <Archive size={15} />
                                  Archive
                                </button>
                              )}
                              {issue.archivedAt ? <span>Archived {formatDate(issue.archivedAt)} by {issue.archivedByName || "Admin"}</span> : null}
                              {!issue.archivedAt && issue.status !== "FIXED" ? <span>Resolve the request before archiving.</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
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
