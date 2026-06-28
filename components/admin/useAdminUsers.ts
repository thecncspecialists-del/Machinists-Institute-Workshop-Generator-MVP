"use client";

import { useCallback, useEffect, useState } from "react";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
};

type TemporaryCredential = {
  email?: string;
  temporaryPassword: string;
};

function jsonMutationHeaders() {
  return {
    "Content-Type": "application/json",
    "x-idempotency-key": crypto.randomUUID()
  };
}

export function useAdminUsers() {
  const [canAdmin, setCanAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<TemporaryCredential[]>([]);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (response.status === 403 || response.status === 401) {
      setCanAdmin(false);
      return;
    }
    if (!response.ok) return;
    const payload = (await response.json()) as { users: AdminUser[] };
    setUsers(payload.users);
    setCanAdmin(true);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function addUser(formData: FormData) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: jsonMutationHeaders(),
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          name: String(formData.get("name") ?? ""),
          role: String(formData.get("role") ?? "STAFF")
        })
      });
      const payload = (await response.json()) as { credentials?: TemporaryCredential[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save user.");
      setCredentials(payload.credentials ?? []);
      setNotice("User saved. Temporary password generated.");
      await loadUsers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setBusy(false);
    }
  }

  async function seedInstructors() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: jsonMutationHeaders(),
        body: JSON.stringify({ mode: "seed-instructors" })
      });
      const payload = (await response.json()) as { count?: number; credentials?: TemporaryCredential[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to provision instructors.");
      setCredentials(payload.credentials ?? []);
      setNotice(`Provisioned ${payload.count ?? 0} users.`);
      await loadUsers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to provision instructors.");
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(id: string, action: "reset-password" | "update-role", role?: "ADMIN" | "STAFF") {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: jsonMutationHeaders(),
        body: JSON.stringify({ id, action, role })
      });
      const payload = (await response.json()) as { credentials?: TemporaryCredential[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to update user.");
      setCredentials(action === "reset-password" ? payload.credentials ?? [] : []);
      setNotice(action === "reset-password" ? "Temporary password generated." : "Role updated.");
      await loadUsers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setBusy(false);
    }
  }

  return {
    addUser,
    busy,
    canAdmin,
    credentials,
    loadUsers,
    notice,
    seedInstructors,
    updateUser,
    users
  };
}
