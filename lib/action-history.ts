import { ActionHistoryStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { logBackendError } from "@/lib/logger";

type ActionHistoryActor = {
  id?: string | null;
  email?: string | null;
};

type RecordActionHistoryInput = {
  actor?: ActionHistoryActor | null;
  actionType: string;
  description: string;
  area: string;
  affectedType?: string | null;
  affectedId?: string | null;
  status: ActionHistoryStatus;
  metadata?: Prisma.InputJsonValue;
};

export async function recordActionHistory(input: RecordActionHistoryInput) {
  try {
    await prisma.actionHistory.create({
      data: {
        actorUserId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actionType: input.actionType,
        description: input.description,
        area: input.area,
        affectedType: input.affectedType ?? null,
        affectedId: input.affectedId ?? null,
        status: input.status,
        metadata: input.metadata
      }
    });
  } catch (error) {
    logBackendError("asset_saved", error, {
      area: input.area,
      actionType: input.actionType
    });
  }
}
