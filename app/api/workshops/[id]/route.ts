import { ActionHistoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { ensureWorkshopUnitsTable, serializeWorkshopUnit } from "@/lib/workshop-generator/workshop-units";

const paramsSchema = z.object({
  id: z.string().uuid()
});

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = paramsSchema.parse(await params);
  await ensureWorkshopUnitsTable(prisma);
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    include: {
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!workshop || workshop.archivedAt) {
    return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
  }

  return NextResponse.json({
    workshop: {
      id: workshop.id,
      courseWorkspaceId: workshop.courseWorkspaceId,
      title: workshop.title,
      courseLabel: workshop.courseLabel,
      termCode: workshop.termCode,
      summary: workshop.summary,
      tags: workshop.tags,
      inputJson: workshop.inputJson,
      templateVersion: workshop.templateVersion,
      visibility: workshop.visibility,
      createdByName: workshop.createdByName,
      createdAt: workshop.createdAt,
      updatedAt: workshop.updatedAt,
      units: workshop.units.map(serializeWorkshopUnit)
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "workshop_generator",
    guardActionType: "workshop_archive_guard",
    idempotencyActionType: "workshop_archive",
    rateLimit: {
      actionTypes: ["workshop_archive", "workshop_archive_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) return guard.response;

  const { id } = paramsSchema.parse(await params);
  const workshop = await prisma.workshop.findFirst({
    where: { id, archivedAt: null }
  });
  if (!workshop) {
    return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
  }

  const archived = await prisma.workshop.update({
    where: { id: workshop.id },
    data: { archivedAt: new Date() }
  });

  await recordActionHistory({
    actor,
    actionType: "workshop_archive",
    description: "Archived workshop from class navigation.",
    area: "workshop_generator",
    affectedType: "workshop",
    affectedId: archived.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: {
      courseWorkspaceId: archived.courseWorkspaceId,
      title: archived.title
    }
  });

  return NextResponse.json({ deleted: true });
}
