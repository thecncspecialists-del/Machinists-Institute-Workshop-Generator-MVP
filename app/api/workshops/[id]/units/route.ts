import { ActionHistoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { createDefaultUnitInput, ensureWorkshopUnitsTable, prepareUnitForSave, serializeWorkshopUnit } from "@/lib/workshop-generator/workshop-units";

const paramsSchema = z.object({
  id: z.string().uuid()
});

export const runtime = "nodejs";

async function findWorkshop(id: string) {
  return prisma.workshop.findFirst({
    where: {
      id,
      archivedAt: null
    }
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = paramsSchema.parse(await params);
  await ensureWorkshopUnitsTable(prisma);
  const workshop = await findWorkshop(id);
  if (!workshop) {
    return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
  }

  const units = await prisma.workshopUnit.findMany({
    where: { workshopId: workshop.id },
    orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ units: units.map(serializeWorkshopUnit) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "workshop_generator",
    guardActionType: "workshop_unit_create_guard",
    idempotencyActionType: "workshop_unit_create",
    rateLimit: {
      actionTypes: ["workshop_unit_create", "workshop_unit_create_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) {
    return guard.response;
  }

  try {
    const { id } = paramsSchema.parse(await params);
    await ensureWorkshopUnitsTable(prisma);
    const workshop = await findWorkshop(id);
    if (!workshop) {
      return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
    }
    if (!workshop.courseWorkspaceId) {
      return NextResponse.json({ error: "Open this workshop from a class before creating units." }, { status: 400 });
    }

    const lastUnit = await prisma.workshopUnit.findFirst({
      where: { workshopId: workshop.id },
      orderBy: { unitNumber: "desc" }
    });
    const unitNumber = (lastUnit?.unitNumber ?? 0) + 1;
    const defaultInput = createDefaultUnitInput(workshop, unitNumber);
    const prepared = prepareUnitForSave(defaultInput, workshop);

    const unit = await prisma.workshopUnit.create({
      data: {
        workshopId: workshop.id,
        unitNumber,
        title: prepared.title,
        inputJson: prepared.inputJson,
        htmlOutput: prepared.htmlOutput
      }
    });

    await recordActionHistory({
      actor,
      actionType: "workshop_unit_create",
      description: "Created unit from workshop.",
      area: "workshop_generator",
      affectedType: "workshop_unit",
      affectedId: unit.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: {
        workshopId: workshop.id,
        unitNumber
      }
    });

    const responsePayload = { unit: serializeWorkshopUnit(unit) };
    await recordIdempotentMutationResult({
      actor,
      actionType: "workshop_unit_create",
      area: "workshop_generator",
      idempotencyKey: guard.idempotency.key,
      statusCode: 200,
      payload: responsePayload,
      description: "Recorded workshop unit create response for idempotency replay."
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("workshop_unit_create_failed", error);
    return NextResponse.json({ error: "Failed to create unit." }, { status: 400 });
  }
}
