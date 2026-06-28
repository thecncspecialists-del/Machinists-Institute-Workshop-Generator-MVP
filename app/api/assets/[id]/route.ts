import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
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
  if (authResult.response) {
    return authResult.response;
  }

  try {
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

    return NextResponse.json({ asset });
  } catch (error) {
    logBackendError("asset_saved", error);
    return NextResponse.json({ error: "The asset could not be updated." }, { status: 500 });
  }
}
