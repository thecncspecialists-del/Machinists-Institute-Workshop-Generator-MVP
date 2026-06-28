"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserCog, X } from "lucide-react";

import { useAdminUsers } from "@/components/admin/useAdminUsers";

export function AdminUserOverlay() {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { addUser, busy, canAdmin, credentials, notice, seedInstructors, updateUser, users } = useAdminUsers();

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

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
