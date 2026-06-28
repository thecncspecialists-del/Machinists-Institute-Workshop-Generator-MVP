import { ActionHistoryStatus, WorkshopVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import { prepareCourseWorkspaceForSave, serializeCourseWorkspace } from "@/lib/workshop-generator/course-workspaces";
import { homePageInputSchema } from "@/lib/workshop-generator/home-page-schema";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid()
});

const updateWorkspaceRequestSchema = z.object({
  homePage: homePageInputSchema,
  visibility: z.nativeEnum(WorkshopVisibility).optional().default(WorkshopVisibility.STAFF_COMMONS)
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = paramsSchema.parse(await params);
  const workspace = await prisma.courseWorkspace.findUnique({
    where: { id },
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
    }
  });

  if (!workspace || workspace.archivedAt) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  return NextResponse.json({ workspace: serializeCourseWorkspace(workspace) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "course_workspace",
    guardActionType: "course_workspace_update_guard",
    idempotencyActionType: "course_workspace_update",
    rateLimit: {
      actionTypes: ["course_workspace_update", "course_workspace_update_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) return guard.response;

  const { id } = paramsSchema.parse(await params);
  const payload = updateWorkspaceRequestSchema.parse(await request.json());
  const existing = await prisma.courseWorkspace.findFirst({
    where: { id, archivedAt: null },
    include: { course: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const prepared = prepareCourseWorkspaceForSave(payload.homePage);
  const saved = await prisma.courseWorkspace.update({
    where: { id: existing.id },
    data: {
      title: prepared.inputJson.courseTitle || existing.title,
      summary: prepared.summary,
      homePageInputJson: prepared.inputJson,
      homePageHtml: prepared.html,
      visibility: payload.visibility
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
    }
  });

  await recordActionHistory({
    actor,
    actionType: "course_workspace_update",
    description: "Updated course workspace home page.",
    area: "course_workspace",
    affectedType: "course_workspace",
    affectedId: saved.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: { courseId: saved.courseId, title: saved.title }
  });

  return NextResponse.json({ workspace: serializeCourseWorkspace(saved), saveMode: "updated" });
}
