import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffUser: vi.fn()
}));

vi.mock("@/lib/require-staff-user", () => ({
  requireStaffUser: mocks.requireStaffUser
}));

import { GET } from "@/app/api/external-lms-catalog/route";

describe("GET /api/external-lms-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires staff auth", async () => {
    mocks.requireStaffUser.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    });

    const response = await GET(new Request("https://app.example.test/api/external-lms-catalog"));

    expect(response.status).toBe(401);
  });

  it("filters by provider and query for staff users", async () => {
    mocks.requireStaffUser.mockResolvedValue({ response: null, user: { id: "staff-1" } });

    const response = await GET(new Request("https://app.example.test/api/external-lms-catalog?provider=tooling-u&q=adhesive&limit=5"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.length).toBeLessThanOrEqual(5);
    expect(payload.items.every((item: { provider: string }) => item.provider === "tooling-u")).toBe(true);
    expect(payload.items[0].title).toContain("Adhesive");
  });
});
