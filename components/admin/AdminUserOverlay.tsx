"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserCog, X } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
};

export function AdminUserOverlay() {
  const [canAdmin, setCanAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Array<{ email?: string; temporaryPassword: string }>>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadUsers() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (response.status === 403 || response.status === 401) {
      setCanAdmin(false);
      return;
    }
    if (!response.ok) return;
    const payload = (await response.json()) as { users: AdminUser[] };
    setUsers(payload.users);
    setCanAdmin(true);
  }

  useEffect(() => {
    setPortalRoot(document.body);
    void loadUsers();
  }, []);

  async function addUser(formData: FormData) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          name: String(formData.get("name") ?? ""),
          role: String(formData.get("role") ?? "STAFF")
        })
      });
      const payload = (await response.json()) as { credentials?: Array<{ email?: string; temporaryPassword: string }>; error?: string };
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "seed-instructors" })
      });
      const payload = (await response.json()) as { count?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to provision instructors.");
      const seededPayload = payload as { count?: number; credentials?: Array<{ email?: string; temporaryPassword: string }> };
      setCredentials(seededPayload.credentials ?? []);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, role })
      });
      const payload = (await response.json()) as { credentials?: Array<{ email?: string; temporaryPassword: string }>; error?: string };
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

  if (!canAdmin) return null;

  const dialog =
    open && portalRoot
      ? createPortal(
        <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="User management">
          <div className="admin-dialog">
            <div className="admin-dialog-header">
              <div>
                <h2>Users</h2>
                <p>Add users, reset passwords, and manage roles.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close user settings" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form
              className="admin-user-form"
              action={(formData) => {
                void addUser(formData);
              }}
            >
              <input name="name" placeholder="Name" />
              <input name="email" placeholder="Email" type="email" required />
              <select name="role" defaultValue="STAFF">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="btn primary" type="submit" disabled={busy}>
                Add
              </button>
            </form>

            <div className="admin-toolbar">
              <button className="btn ghost" type="button" disabled={busy} onClick={() => void seedInstructors()}>
                Provision instructors
              </button>
              {notice ? <span role="status">{notice}</span> : null}
            </div>

            {credentials.length > 0 ? (
              <textarea
                className="admin-credentials-output"
                readOnly
                aria-label="Temporary credentials"
                value={credentials.map((item) => `${item.email ? `${item.email}: ` : ""}${item.temporaryPassword}`).join("\n")}
              />
            ) : null}

            <div className="admin-user-list">
              {users.map((user) => (
                <div className="admin-user-row" key={user.id}>
                  <div>
                    <strong>{user.name || user.email}</strong>
                    <span>{user.email}</span>
                  </div>
                  <select
                    aria-label={`Role for ${user.email}`}
                    value={user.role}
                    disabled={busy}
                    onChange={(event) => void updateUser(user.id, "update-role", event.target.value as "ADMIN" | "STAFF")}
                  >
                    <option value="STAFF">Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => void updateUser(user.id, "reset-password")}>
                    Reset
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        portalRoot
      )
      : null;

  return (
    <>
      <button className="admin-gear-button" type="button" title="User settings" aria-label="User settings" onClick={() => setOpen(true)}>
        <UserCog size={16} />
      </button>
      {dialog}
    </>
  );
}
