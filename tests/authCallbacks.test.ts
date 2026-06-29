import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaAdapter: vi.fn(() => ({})),
  userFindUnique: vi.fn()
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: mocks.prismaAdapter
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique
    }
  }
}));

import { authOptions } from "@/auth";

describe("NextAuth callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds an admin session from the current database role", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "admin@example.edu",
      name: "Admin User",
      role: Role.ADMIN
    });

    const token = await authOptions.callbacks?.jwt?.({
      token: { sub: "admin-1", role: Role.STAFF },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      isNewUser: false,
      session: undefined
    });
    const session = await authOptions.callbacks?.session?.({
      session: { user: { email: "", name: "", image: null }, expires: "2099-01-01T00:00:00.000Z" },
      token: token ?? {},
      user: undefined
    });

    expect(token?.role).toBe(Role.ADMIN);
    expect(token?.email).toBe("admin@example.edu");
    expect(session?.user.id).toBe("admin-1");
    expect(session?.user.role).toBe(Role.ADMIN);
  });

  it("builds a staff session from the current database role", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "staff@example.edu",
      name: "Staff User",
      role: Role.STAFF
    });

    const token = await authOptions.callbacks?.jwt?.({
      token: { sub: "staff-1" },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      isNewUser: false,
      session: undefined
    });
    const session = await authOptions.callbacks?.session?.({
      session: { user: { email: "", name: "", image: null }, expires: "2099-01-01T00:00:00.000Z" },
      token: token ?? {},
      user: undefined
    });

    expect(session?.user.id).toBe("staff-1");
    expect(session?.user.role).toBe(Role.STAFF);
  });

  it("refreshes a stale token role from the database", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "admin@example.edu",
      name: "Admin User",
      role: Role.ADMIN
    });

    const token = await authOptions.callbacks?.jwt?.({
      token: { sub: "admin-1", role: Role.STAFF },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      isNewUser: false,
      session: undefined
    });

    expect(token?.role).toBe(Role.ADMIN);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      select: {
        email: true,
        name: true,
        role: true
      }
    });
  });
});
