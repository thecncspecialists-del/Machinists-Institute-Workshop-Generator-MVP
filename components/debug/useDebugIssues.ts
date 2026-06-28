"use client";

import { useCallback, useEffect, useState } from "react";

export type DebugIssueStatus = "OPEN" | "IN_PROGRESS" | "FIXED";

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
  createdAt: string;
  updatedAt: string;
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

  const loadIssues = useCallback(async () => {
    const response = await fetch("/api/debug-issues", { cache: "no-store" });
    if (!response.ok) {
      setNotice("Issue reporting is unavailable right now.");
      return;
    }
    const payload = (await response.json()) as { role: "ADMIN" | "STAFF"; issues: DebugIssue[] };
    setRole(payload.role);
    setIssues(payload.issues);
  }, []);

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
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/debug-issues", {
        method: "PATCH",
        headers: jsonMutationHeaders(),
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as { issue?: DebugIssue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error || "Unable to update issue.");
      setIssues((current) => current.map((issue) => (issue.id === input.id ? (payload.issue as DebugIssue) : issue)));
      setNotice("Issue updated.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update issue.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    isAdmin: role === "ADMIN",
    issues,
    loadIssues,
    notice,
    role,
    submitIssue,
    updateIssue
  };
}
