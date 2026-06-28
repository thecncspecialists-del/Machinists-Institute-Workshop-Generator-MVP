import { ActionHistoryStatus, WorkshopVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import {
  buildWorkspaceSearchWhere,
  createHomePageInputFromCourse,
  ensureCourseWorkspaceTables,
  prepareCourseWorkspaceForSave,
  serializeCourseWorkspace
} from "@/lib/workshop-generator/course-workspaces";
import { homePageInputSchema } from "@/lib/workshop-generator/home-page-schema";
import { ensureWorkshopUnitsTable } from "@/lib/workshop-generator/workshop-units";

export const runtime = "nodejs";

const saveWorkspaceRequestSchema = z.object({
  courseId: z.string().uuid(),
  homePage: homePageInputSchema.optional(),
  sourceWorkspaceId: z.string().uuid().optional().nullable(),
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

  await ensureCourseWorkspaceTables(prisma);
  await ensureWorkshopUnitsTable(prisma);
  const url = new URL(request.url);
  const query = parseStringParam(url, "q");
  const courseId = parseStringParam(url, "courseId");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 50;

  const workspaces = await prisma.courseWorkspace.findMany({
    where: {
      ...buildWorkspaceSearchWhere(query),
      ...(courseId ? { courseId } : {})
    },
    include: {
      course: {
        include: {
          assets: true
        }
      },
      workshops: {
        where: { archivedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          units: {
            orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
            select: { id: true, unitNumber: true, title: true }
          },
          _count: {
            select: { units: true }
          }
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    take
  });

  return NextResponse.json({ workspaces: workspaces.map(serializeCourseWorkspace) });
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
    area: "course_workspace",
    guardActionType: "course_workspace_save_guard",
    idempotencyActionType: "course_workspace_save",
    rateLimit: {
      actionTypes: ["course_workspace_save", "course_workspace_save_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) {
    return guard.response;
  }

  try {
    await ensureCourseWorkspaceTables(prisma);
    await ensureWorkshopUnitsTable(prisma);
    const payload = saveWorkspaceRequestSchema.parse(await request.json());
    const course = await prisma.course.findUnique({
      where: { id: payload.courseId },
      include: {
        outcomes: {
          orderBy: { rowIndex: "asc" },
          select: { outcomeCode: true, description: true }
        }
      }
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const homePage = payload.homePage ?? createHomePageInputFromCourse(course);
    const prepared = prepareCourseWorkspaceForSave(homePage);
    const title = prepared.inputJson.courseTitle || [course.courseCode, course.courseName].filter(Boolean).join(" - ");
    const existing = payload.sourceWorkspaceId
      ? await prisma.courseWorkspace.findFirst({
          where: { id: payload.sourceWorkspaceId, courseId: course.id, archivedAt: null }
        })
      : null;

    const savedWorkspace = existing
      ? await prisma.courseWorkspace.update({
          where: { id: existing.id },
          data: {
            title,
            summary: prepared.summary,
            homePageInputJson: prepared.inputJson,
            homePageHtml: prepared.html,
            visibility: payload.visibility
          }
        })
      : await prisma.courseWorkspace.create({
          data: {
            courseId: course.id,
            title,
            summary: prepared.summary,
            homePageInputJson: prepared.inputJson,
            homePageHtml: prepared.html,
            visibility: payload.visibility,
            createdById: authResult.user.id,
            createdByName: authResult.user.name ?? authResult.user.email ?? "Staff User"
          }
        });

    await recordActionHistory({
      actor,
      actionType: "course_workspace_save",
      description: existing ? "Updated course workspace." : "Created course workspace.",
      area: "course_workspace",
      affectedType: "course_workspace",
      affectedId: savedWorkspace.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { courseId: course.id, saveMode: existing ? "updated" : "created" }
    });

    const workspace = await prisma.courseWorkspace.findUniqueOrThrow({
      where: { id: savedWorkspace.id },
      include: {
        course: { include: { assets: true } },
        workshops: {
          where: { archivedAt: null },
          orderBy: [{ updatedAt: "desc" }],
          include: {
            units: {
              orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
              select: { id: true, unitNumber: true, title: true }
            },
            _count: { select: { units: true } }
          }
        }
      }
    });
    const responsePayload = {
      workspace: serializeCourseWorkspace(workspace),
      saveMode: existing ? "updated" : "created"
    };

    await recordIdempotentMutationResult({
      actor,
      actionType: "course_workspace_save",
      area: "course_workspace",
      idempotencyKey: guard.idempotency.key,
      statusCode: 200,
      payload: responsePayload,
      description: "Recorded course workspace save response for idempotency replay."
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid request." : "Failed to save class.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
