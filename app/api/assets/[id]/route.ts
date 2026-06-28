import { ActionHistoryStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { assetStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { logBackendError, logBackendEvent } from "@/lib/logger";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid()
});

const updateAssetSchema = z.object({
  title: z.string().trim().min(1).optional(),
  status: z.enum(assetStatuses).optional(),
  createdBy: z.string().trim().min(1).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const actor = { id: authResult.user.id, email: authResult.user.email };
    const guard = await runApiMutationGuard({
      request,
      actor,
      area: "asset_repository",
      guardActionType: "asset_review_guard",
      idempotencyActionType: "asset_review_update",
      rateLimit: {
        actionTypes: ["asset_review_update", "asset_review_guard"],
        max: 120,
        windowMs: 5 * 60 * 1000
      }
    });
    if (guard.response) return guard.response;

    const { id } = paramsSchema.parse(await params);
    const payload = updateAssetSchema.parse(await request.json());
    const data: Prisma.CurriculumAssetUpdateInput = {};

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.createdBy !== undefined) {
      await prisma.contributor.upsert({
        where: { displayName: payload.createdBy },
        update: {},
        create: { displayName: payload.createdBy }
      });
      data.createdBy = payload.createdBy;
    }

    const asset = await prisma.curriculumAsset.update({
      where: { id },
      data
    });

    logBackendEvent("asset_saved", {
      assetId: asset.id,
      assetType: asset.assetType,
      status: asset.status,
      updateMode: "review_details"
    });

    await recordActionHistory({
      actor,
      actionType: "asset_review_update",
      description: "Updated curriculum asset review details.",
      area: "asset_repository",
      affectedType: "curriculum_asset",
      affectedId: asset.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { assetType: asset.assetType, status: asset.status }
    });

    return NextResponse.json({ asset });
  } catch (error) {
    logBackendError("asset_saved", error);
    return NextResponse.json({ error: "The asset could not be updated." }, { status: 500 });
  }
}
