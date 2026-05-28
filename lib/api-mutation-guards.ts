import { ActionHistoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordActionHistory } from "@/lib/action-history";
import { prisma } from "@/lib/db";

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

type StaffActor = {
  id: string;
  email?: string | null;
};

type GuardRateLimitConfig = {
  actionTypes: string[];
  max: number;
  windowMs: number;
};

type GuardConfig = {
  request: Request;
  actor: StaffActor;
  area: string;
  guardActionType: string;
  idempotencyActionType: string;
  idempotencyTtlMs?: number;
  rateLimit: GuardRateLimitConfig;
};

type IdempotentReplayRecord = {
  statusCode: number;
  payload: Record<string, unknown>;
};

type IdempotentGuardState = {
  key: string | null;
};

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function resolveExpectedOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = firstHeaderValue(request.headers.get("host"));
  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");
  const resolvedHost = forwardedHost ?? host ?? requestUrl.host;
  return `${protocol}://${resolvedHost}`;
}

function normalizeIdempotencyKey(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function readReplayRecord(metadata: unknown): IdempotentReplayRecord | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const idempotency = (metadata as Record<string, unknown>).idempotency;
  if (!idempotency || typeof idempotency !== "object" || Array.isArray(idempotency)) {
    return null;
  }

  const statusCode = (idempotency as Record<string, unknown>).statusCode;
  const payload = (idempotency as Record<string, unknown>).payload;
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode)) {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return {
    statusCode,
    payload: payload as Record<string, unknown>
  };
}

async function findIdempotentReplay(args: {
  actorId: string;
  actionType: string;
  key: string;
  since: Date;
}) {
  const match = await prisma.actionHistory.findFirst({
    where: {
      actorUserId: args.actorId,
      actionType: args.actionType,
      timestamp: { gte: args.since },
      metadata: {
        path: ["idempotencyKey"],
        equals: args.key
      }
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    select: {
      metadata: true
    }
  });

  if (!match) {
    return null;
  }

  return readReplayRecord(match.metadata);
}

function buildOriginMismatchResponse() {
  return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
}

function buildRateLimitResponse() {
  return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
}

function buildReplayResponse(replay: IdempotentReplayRecord) {
  return NextResponse.json(replay.payload, {
    status: replay.statusCode,
    headers: {
      "X-Idempotent-Replay": "1"
    }
  });
}

export async function runApiMutationGuard(config: GuardConfig): Promise<{
  response: NextResponse | null;
  idempotency: IdempotentGuardState;
}> {
  const expectedOrigin = resolveExpectedOrigin(config.request);
  const expectedHost = new URL(expectedOrigin).host.toLowerCase();
  const originHeader = firstHeaderValue(config.request.headers.get("origin"));
  const hostHeader = firstHeaderValue(config.request.headers.get("host"));
  const forwardedHostHeader = firstHeaderValue(config.request.headers.get("x-forwarded-host"));
  const requestHost = (forwardedHostHeader ?? hostHeader ?? "").toLowerCase();
  const normalizedOrigin = originHeader?.toLowerCase() ?? null;

  if (!normalizedOrigin || normalizedOrigin !== expectedOrigin.toLowerCase() || requestHost !== expectedHost) {
    await recordActionHistory({
      actor: config.actor,
      actionType: config.guardActionType,
      description: "Blocked API mutation because the request origin did not match the host.",
      area: config.area,
      affectedType: "api_request",
      status: ActionHistoryStatus.WARNING,
      metadata: {
        reason: "origin_mismatch",
        expectedOrigin,
        expectedHost,
        receivedOrigin: originHeader,
        receivedHost: requestHost || null
      }
    });
    return {
      response: buildOriginMismatchResponse(),
      idempotency: { key: null }
    };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.rateLimit.windowMs);
  const requestCountInWindow = await prisma.actionHistory.count({
    where: {
      actorUserId: config.actor.id,
      actionType: {
        in: config.rateLimit.actionTypes
      },
      timestamp: {
        gte: windowStart
      }
    }
  });

  if (requestCountInWindow >= config.rateLimit.max) {
    await recordActionHistory({
      actor: config.actor,
      actionType: config.guardActionType,
      description: "Blocked API mutation because the rate limit was exceeded.",
      area: config.area,
      affectedType: "api_request",
      status: ActionHistoryStatus.WARNING,
      metadata: {
        reason: "rate_limited",
        limit: config.rateLimit.max,
        windowMs: config.rateLimit.windowMs
      }
    });
    return {
      response: buildRateLimitResponse(),
      idempotency: { key: null }
    };
  }

  const idempotencyKey = normalizeIdempotencyKey(config.request.headers.get("x-idempotency-key"));
  if (idempotencyKey) {
    const replay = await findIdempotentReplay({
      actorId: config.actor.id,
      actionType: config.idempotencyActionType,
      key: idempotencyKey,
      since: new Date(now.getTime() - (config.idempotencyTtlMs ?? 10 * 60 * 1000))
    });

    if (replay) {
      await recordActionHistory({
        actor: config.actor,
        actionType: config.guardActionType,
        description: "Replayed an idempotent API mutation response.",
        area: config.area,
        affectedType: "api_request",
        status: ActionHistoryStatus.SUCCESS,
        metadata: {
          reason: "idempotent_replay",
          idempotencyKey
        }
      });
      return {
        response: buildReplayResponse(replay),
        idempotency: { key: idempotencyKey }
      };
    }
  }

  return {
    response: null,
    idempotency: { key: idempotencyKey }
  };
}

export async function recordIdempotentMutationResult(args: {
  actor: StaffActor;
  actionType: string;
  area: string;
  idempotencyKey: string | null;
  statusCode: number;
  payload: Record<string, unknown>;
  description: string;
}) {
  if (!args.idempotencyKey) {
    return;
  }

  await recordActionHistory({
    actor: args.actor,
    actionType: args.actionType,
    description: args.description,
    area: args.area,
    affectedType: "api_request",
    status: args.statusCode >= 400 ? ActionHistoryStatus.WARNING : ActionHistoryStatus.SUCCESS,
    metadata: toJsonValue({
      idempotencyKey: args.idempotencyKey,
      idempotency: {
        statusCode: args.statusCode,
        payload: args.payload
      }
    })
  });
}
