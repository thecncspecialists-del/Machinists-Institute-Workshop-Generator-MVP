import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findFirst: vi.fn(),
  recordActionHistory: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    actionHistory: {
      count: mocks.count,
      findFirst: mocks.findFirst
    }
  }
}));

vi.mock("@/lib/action-history", () => ({
  recordActionHistory: mocks.recordActionHistory
}));

import { runApiMutationGuard } from "@/lib/api-mutation-guards";

const guardConfig = {
  actor: { id: "user-1", email: "staff@example.edu" },
  area: "tests",
  guardActionType: "test_guard",
  idempotencyActionType: "test_mutation",
  rateLimit: {
    actionTypes: ["test_mutation", "test_guard"],
    max: 2,
    windowMs: 60_000
  }
};

describe("runApiMutationGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.findFirst.mockResolvedValue(null);
  });

  it("blocks mutation requests with a mismatched origin", async () => {
    const result = await runApiMutationGuard({
      ...guardConfig,
      request: new Request("https://app.example.test/api/save", {
        method: "POST",
        headers: { origin: "https://evil.example.test" }
      })
    });

    expect(result.response?.status).toBe(403);
    await expect(result.response?.json()).resolves.toEqual({ error: "Invalid request origin." });
    expect(mocks.recordActionHistory).toHaveBeenCalledWith(expect.objectContaining({
      actionType: "test_guard",
      metadata: expect.objectContaining({ reason: "origin_mismatch" })
    }));
  });

  it("blocks requests over the configured rate limit", async () => {
    mocks.count.mockResolvedValue(2);

    const result = await runApiMutationGuard({
      ...guardConfig,
      request: new Request("https://app.example.test/api/save", {
        method: "POST",
        headers: {
          host: "app.example.test",
          origin: "https://app.example.test"
        }
      })
    });

    expect(result.response?.status).toBe(429);
    await expect(result.response?.json()).resolves.toEqual({ error: "Too many requests. Try again shortly." });
  });

  it("replays recent idempotent mutation responses", async () => {
    mocks.findFirst.mockResolvedValue({
      metadata: {
        idempotency: {
          statusCode: 200,
          payload: { ok: true }
        }
      }
    });

    const result = await runApiMutationGuard({
      ...guardConfig,
      request: new Request("https://app.example.test/api/save", {
        method: "POST",
        headers: {
          host: "app.example.test",
          origin: "https://app.example.test",
          "x-idempotency-key": "same-key"
        }
      })
    });

    expect(result.response?.status).toBe(200);
    expect(result.response?.headers.get("X-Idempotent-Replay")).toBe("1");
    await expect(result.response?.json()).resolves.toEqual({ ok: true });
  });
});
