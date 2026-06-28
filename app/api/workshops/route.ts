import { ActionHistoryStatus, Role, WorkshopVisibility, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { normalizeWorkshopInput } from "@/lib/workshop-generator/normalize-workshop-input";
import { buildVisibleWorkshopWhere, buildWorkshopSearchWhere } from "@/lib/workshop-generator/search-workshops";
import { workshopInputSchema } from "@/lib/workshop-generator/workshop-schema";

export const runtime = "nodejs";

const saveWorkshopRequestSchema = z.object({
  workshop: workshopInputSchema,
  courseWorkspaceId: z.string().uuid().optional().nullable(),
  sourceWorkshopId: z.string().uuid().optional().nullable(),
  saveAsCopy: z.boolean().default(true),
  visibility: z.nativeEnum(WorkshopVisibility).optional().default(WorkshopVisibility.STAFF_COMMONS)
});

function parseStringParam(url: URL, key: string) {
  return (url.searchParams.get(key) ?? "").trim();
}

export async function GET(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const query = parseStringParam(url, "q");
  const course = parseStringParam(url, "course");
  const courseWorkspaceId = parseStringParam(url, "courseWorkspaceId");
  const term = parseStringParam(url, "term");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 50;

  const where: Prisma.WorkshopWhereInput = {
    ...buildVisibleWorkshopWhere(),
    ...(courseWorkspaceId ? { courseWorkspaceId } : {}),
    ...(course ? { courseLabel: { contains: course, mode: "insensitive" } } : {}),
    ...(term ? { termCode: { contains: term.toUpperCase(), mode: "insensitive" } } : {}),
    ...buildWorkshopSearchWhere(query)
  };

  const workshops = await prisma.workshop.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take
  });

  return NextResponse.json({
    workshops: workshops.map((workshop) => ({
      id: workshop.id,
      courseWorkspaceId: workshop.courseWorkspaceId,
      title: workshop.title,
      courseLabel: workshop.courseLabel,
      termCode: workshop.termCode,
      summary: workshop.summary,
      tags: workshop.tags,
      templateVersion: workshop.templateVersion,
      visibility: workshop.visibility,
      createdByName: workshop.createdByName,
      createdAt: workshop.createdAt,
      updatedAt: workshop.updatedAt
    }))
  });
}

export async function POST(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "workshop_generator",
    guardActionType: "workshop_save_guard",
    idempotencyActionType: "workshop_save",
    rateLimit: {
      actionTypes: ["workshop_save", "workshop_save_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) {
    return guard.response;
  }

  try {
    const payload = saveWorkshopRequestSchema.parse(await request.json());
    const normalizedWorkshop = normalizeWorkshopInput(payload.workshop);
    const summary = normalizedWorkshop.overview.slice(0, 300) || null;
    const tags = normalizedWorkshop.tags.slice(0, 20);

    const shouldOverwrite =
      Boolean(payload.sourceWorkshopId) && !payload.saveAsCopy && authResult.user.role === Role.ADMIN;

    const sourceWorkshop = payload.sourceWorkshopId
      ? await prisma.workshop.findUnique({
          where: { id: payload.sourceWorkshopId ?? "" }
        })
      : null;
    const courseWorkspaceId = payload.courseWorkspaceId ?? sourceWorkshop?.courseWorkspaceId ?? null;
    if (!courseWorkspaceId) {
      return NextResponse.json({ error: "Save or open a class before creating workshops." }, { status: 400 });
    }
    const courseWorkspace = await prisma.courseWorkspace.findFirst({
      where: { id: courseWorkspaceId, archivedAt: null }
    });
    if (!courseWorkspace) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const existing = shouldOverwrite
      ? sourceWorkshop
      : null;

    let savedWorkshop;
    if (existing) {
      savedWorkshop = await prisma.workshop.update({
        where: { id: existing.id },
        data: {
          title: normalizedWorkshop.title,
          courseWorkspaceId,
          courseLabel: normalizedWorkshop.courseLabel,
          termCode: normalizedWorkshop.termCode,
          summary,
          tags,
          inputJson: normalizedWorkshop,
          templateVersion: "workshop-template-v1",
          visibility: payload.visibility
        }
      });
    } else {
      savedWorkshop = await prisma.workshop.create({
        data: {
          title: normalizedWorkshop.title,
          courseWorkspaceId,
          courseLabel: normalizedWorkshop.courseLabel,
          termCode: normalizedWorkshop.termCode,
          summary,
          tags,
          inputJson: normalizedWorkshop,
          templateVersion: "workshop-template-v1",
          visibility: payload.visibility,
          createdById: authResult.user.id,
          createdByName: authResult.user.name ?? authResult.user.email ?? "Staff User"
        }
      });
    }

    await recordActionHistory({
      actor,
      actionType: "workshop_save",
      description: existing ? "Updated workshop from generator." : "Saved workshop from generator.",
      area: "workshop_generator",
      affectedType: "workshop",
      affectedId: savedWorkshop.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: {
        saveAsCopy: payload.saveAsCopy,
        termCode: normalizedWorkshop.termCode,
        courseLabel: normalizedWorkshop.courseLabel,
        courseWorkspaceId
      }
    });

    const responsePayload = {
      workshop: {
        id: savedWorkshop.id,
        courseWorkspaceId: savedWorkshop.courseWorkspaceId,
        title: savedWorkshop.title,
        courseLabel: savedWorkshop.courseLabel,
        termCode: savedWorkshop.termCode,
        summary: savedWorkshop.summary,
        tags: savedWorkshop.tags,
        createdAt: savedWorkshop.createdAt,
        updatedAt: savedWorkshop.updatedAt
      },
      saveMode: existing ? "updated" : "created"
    };

    await recordIdempotentMutationResult({
      actor,
      actionType: "workshop_save",
      area: "workshop_generator",
      idempotencyKey: guard.idempotency.key,
      statusCode: 200,
      payload: responsePayload,
      description: "Recorded workshop save response for idempotency replay."
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid request." : "Failed to save workshop.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
