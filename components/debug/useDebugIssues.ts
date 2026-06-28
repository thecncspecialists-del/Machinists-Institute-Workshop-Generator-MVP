"use client";

import { useCallback, useEffect, useState } from "react";

export type DebugIssueStatus = "OPEN" | "IN_PROGRESS" | "FIXED";
export type DebugIssueMessageAuthorRole = "ADMIN" | "STAFF";
export type DebugIssueView = "active" | "archived";

export type DebugIssueMessage = {
  id: string;
  issueId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorRole: DebugIssueMessageAuthorRole;
  body: string;
  createdAt: string;
};

export type DebugIssue = {
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
  archivedByName: string | null;
  archivedAt: string | null;
  lastAdminActivityAt: string | null;
  lastReporterActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unread: boolean;
  messages: DebugIssueMessage[];
};

function jsonMutationHeaders() {
  return {
    "Content-Type": "application/json",
    "x-idempotency-key": crypto.randomUUID()
  };
}

export function useDebugIssues() {
  const [role, setRole] = useState<"ADMIN" | "STAFF" | null>(null);
  const [issues, setIssues] = useState<DebugIssue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<DebugIssueView>("active");

  const loadIssues = useCallback(async (options?: { view?: DebugIssueView; focus?: string | null }) => {
    const nextView = options?.view ?? view;
    const query = new URLSearchParams({ view: nextView });
    if (options?.focus) query.set("focus", options.focus);
    const response = await fetch(`/api/debug-issues?${query.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      setNotice("Issue reporting is unavailable right now.");
      return [];
    }
    const payload = (await response.json()) as { role: "ADMIN" | "STAFF"; view: DebugIssueView; issues: DebugIssue[] };
    setRole(payload.role);
    setView(payload.view);
    setIssues(payload.issues);
    return payload.issues;
  }, [view]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  async function submitIssue(input: { title: string; description: string; pageUrl: string }) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/debug-issues", {
        method: "POST",
        headers: jsonMutationHeaders(),
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as { issue?: DebugIssue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error || "Unable to submit issue.");
      setIssues((current) => [payload.issue as DebugIssue, ...current]);
      setNotice("Issue submitted.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit issue.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function updateIssue(input: { id: string; status: DebugIssueStatus; adminResponse: string }) {
    return mutateIssue({ ...input, action: "update-status" }, "Issue updated.");
  }

  async function replyToIssue(input: { id: string; body: string }) {
    return mutateIssue({ ...input, action: "reply" }, "Reply added.");
  }

  async function archiveIssue(id: string) {
    return mutateIssue({ id, action: "archive" }, "Issue archived.");
  }

  async function unarchiveIssue(id: string) {
    return mutateIssue({ id, action: "unarchive" }, "Issue restored.");
  }

  async function markIssueRead(id: string) {
    return mutateIssue({ id, action: "mark-read" }, "Issue marked read.", { quiet: true });
  }

  async function mutateIssue(body: Record<string, unknown>, successMessage: string, options?: { quiet?: boolean }) {
    setBusy(true);
    if (!options?.quiet) setNotice(null);
    try {
      const response = await fetch("/api/debug-issues", {
        method: "PATCH",
        headers: jsonMutationHeaders(),
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => null)) as { issue?: DebugIssue; ok?: boolean; error?: string } | null;
      if (!response.ok || (!payload?.issue && !payload?.ok)) throw new Error(payload?.error || "Unable to update issue.");
      if (payload.issue) {
        setIssues((current) => {
          const shouldRemove =
            (view === "active" && payload.issue?.archivedAt) ||
            (view === "archived" && !payload.issue?.archivedAt);
          if (shouldRemove) return current.filter((issue) => issue.id !== payload.issue?.id);
          return current.map((issue) => (issue.id === payload.issue?.id ? (payload.issue as DebugIssue) : issue));
        });
      }
      if (!options?.quiet) setNotice(successMessage);
      return payload?.issue ?? true;
    } catch (error) {
      if (!options?.quiet) setNotice(error instanceof Error ? error.message : "Unable to update issue.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    archiveIssue,
    busy,
    isAdmin: role === "ADMIN",
    issues,
    loadIssues,
    markIssueRead,
    notice,
    replyToIssue,
    role,
    setView,
    submitIssue,
    unarchiveIssue,
    updateIssue,
    view
  };
}
