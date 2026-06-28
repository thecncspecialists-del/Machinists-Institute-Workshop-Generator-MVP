"use client";

import { useEffect, useState } from "react";
import { Bell, Check, ExternalLink, X } from "lucide-react";

type DebugIssueNotification = {
  issueId: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "FIXED";
  adminResponse: string | null;
  lastAdminActivityAt: string | null;
  updatedAt: string;
};

function jsonMutationHeaders() {
  return {
    "Content-Type": "application/json",
    "x-idempotency-key": crypto.randomUUID()
  };
}

function statusLabel(status: DebugIssueNotification["status"]) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function DebugIssueNotificationPane() {
  const [notifications, setNotifications] = useState<DebugIssueNotification[]>([]);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);

  async function loadNotifications() {
    const response = await fetch("/api/debug-issues/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { notifications: DebugIssueNotification[] };
    setNotifications(payload.notifications);
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markNotification(issueId: string, action: "dismiss" | "mark-read") {
    setBusyIssueId(issueId);
    try {
      const response = await fetch("/api/debug-issues/notifications", {
        method: "PATCH",
        headers: jsonMutationHeaders(),
        body: JSON.stringify({ issueId, action })
      });
      if (response.ok) {
        setNotifications((current) => current.filter((notification) => notification.issueId !== issueId));
      }
    } finally {
      setBusyIssueId(null);
    }
  }

  async function openIssue(issueId: string) {
    window.dispatchEvent(new CustomEvent("debug-issue:open", { detail: { issueId } }));
    setNotifications((current) => current.filter((notification) => notification.issueId !== issueId));
    await markNotification(issueId, "mark-read");
  }

  if (notifications.length === 0) return null;

  return (
    <section className="debug-notification-pane" aria-label="Debug request notifications">
      <div className="debug-notification-pane-header">
        <div>
          <Bell size={17} />
          <strong>Debug request updates</strong>
        </div>
        <button className="btn ghost subtle-action" type="button" onClick={() => void loadNotifications()}>
          Refresh
        </button>
      </div>
      <div className="debug-notification-list">
        {notifications.map((notification) => (
          <article className="debug-notification-item" key={notification.issueId}>
            <div>
              <span className={`debug-issue-status ${notification.status.toLowerCase()}`}>{statusLabel(notification.status)}</span>
              <strong>{notification.title}</strong>
              {notification.adminResponse ? <p>{notification.adminResponse}</p> : <p>An admin updated this request.</p>}
            </div>
            <div className="debug-notification-actions">
              <button className="icon-btn" type="button" title="Open request" aria-label={`Open ${notification.title}`} onClick={() => void openIssue(notification.issueId)}>
                <ExternalLink size={15} />
              </button>
              <button
                className="icon-btn"
                type="button"
                title="Mark read"
                aria-label={`Mark ${notification.title} read`}
                disabled={busyIssueId === notification.issueId}
                onClick={() => void markNotification(notification.issueId, "mark-read")}
              >
                <Check size={15} />
              </button>
              <button
                className="icon-btn"
                type="button"
                title="Dismiss"
                aria-label={`Dismiss ${notification.title}`}
                disabled={busyIssueId === notification.issueId}
                onClick={() => void markNotification(notification.issueId, "dismiss")}
              >
                <X size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
