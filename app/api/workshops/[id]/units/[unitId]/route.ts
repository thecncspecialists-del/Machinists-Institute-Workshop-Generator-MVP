import { ActionHistoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { unitActivityInputSchema } from "@/lib/workshop-generator/unit-activity-schema";
import { ensureWorkshopUnitsTable, prepareUnitForSave, serializeWorkshopUnit } from "@/lib/workshop-generator/workshop-units";

const paramsSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid()
});

const updateUnitRequestSchema = z.object({
  unit: unitActivityInputSchema
});

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "workshop_generator",
    guardActionType: "workshop_unit_update_guard",
    idempotencyActionType: "workshop_unit_update",
    rateLimit: {
      actionTypes: ["workshop_unit_update", "workshop_unit_update_guard"],
      max: 120,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) {
    return guard.response;
  }

  try {
    const { id, unitId } = paramsSchema.parse(await params);
    await ensureWorkshopUnitsTable(prisma);
    const payload = updateUnitRequestSchema.parse(await request.json());
    const workshop = await prisma.workshop.findFirst({
      where: {
        id,
        archivedAt: null
      }
    });
    if (!workshop) {
      return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
    }
    if (!workshop.courseWorkspaceId) {
      return NextResponse.json({ error: "Open this workshop from a class before saving units." }, { status: 400 });
    }

    const existing = await prisma.workshopUnit.findFirst({
      where: {
        id: unitId,
        workshopId: workshop.id
      }
    });
    if (!existing) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }

    const prepared = prepareUnitForSave(payload.unit, workshop);
    const unit = await prisma.workshopUnit.update({
      where: { id: existing.id },
      data: {
        unitNumber: Number.parseInt(prepared.inputJson.unitNumber, 10) || existing.unitNumber,
        title: prepared.title,
        inputJson: prepared.inputJson,
        htmlOutput: prepared.htmlOutput
      }
    });

    await recordActionHistory({
      actor,
      actionType: "workshop_unit_update",
      description: "Updated workshop unit.",
      area: "workshop_generator",
      affectedType: "workshop_unit",
      affectedId: unit.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: {
        workshopId: workshop.id,
        unitNumber: unit.unitNumber
      }
    });

    const responsePayload = { unit: serializeWorkshopUnit(unit) };
    await recordIdempotentMutationResult({
      actor,
      actionType: "workshop_unit_update",
      area: "workshop_generator",
      idempotencyKey: guard.idempotency.key,
      statusCode: 200,
      payload: responsePayload,
      description: "Recorded workshop unit update response for idempotency replay."
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid request." : "Failed to save unit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "workshop_generator",
    guardActionType: "workshop_unit_delete_guard",
    idempotencyActionType: "workshop_unit_delete",
    rateLimit: {
      actionTypes: ["workshop_unit_delete", "workshop_unit_delete_guard"],
      max: 120,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) return guard.response;

  const { id, unitId } = paramsSchema.parse(await params);
  await ensureWorkshopUnitsTable(prisma);
  const existing = await prisma.workshopUnit.findFirst({
    where: {
      id: unitId,
      workshopId: id
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Unit not found." }, { status: 404 });
  }

  await prisma.workshopUnit.delete({
    where: { id: existing.id }
  });

  await recordActionHistory({
    actor,
    actionType: "workshop_unit_delete",
    description: "Deleted workshop unit.",
    area: "workshop_generator",
    affectedType: "workshop_unit",
    affectedId: existing.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: {
      workshopId: id,
      unitNumber: existing.unitNumber,
      title: existing.title
    }
  });

  return NextResponse.json({ deleted: true });
}
