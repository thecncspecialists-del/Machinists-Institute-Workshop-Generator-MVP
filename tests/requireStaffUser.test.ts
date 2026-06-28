import { Role } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn()
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth
}));

import { requireAdminUser, requireStaffUser } from "@/lib/require-staff-user";

describe("staff and admin route auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 401 response when no user session exists", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await requireStaffUser();

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it("returns a 403 response for non-admin admin routes", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "staff-1",
        email: "staff@example.edu",
        name: "Staff User",
        role: Role.STAFF
      }
    });

    const result = await requireAdminUser();

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it("allows admin users through admin route checks", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@example.edu",
        name: "Admin User",
        role: Role.ADMIN
      }
    });

    const result = await requireAdminUser();

    expect(result.response).toBeNull();
    expect(result.user?.role).toBe(Role.ADMIN);
  });
});
