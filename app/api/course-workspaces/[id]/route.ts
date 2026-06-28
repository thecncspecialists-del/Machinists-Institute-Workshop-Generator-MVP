import { WorkshopVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";
import {
  ensureCourseWorkspaceTables,
  prepareCourseWorkspaceForSave,
  serializeCourseWorkspace
} from "@/lib/workshop-generator/course-workspaces";
import { homePageInputSchema } from "@/lib/workshop-generator/home-page-schema";
import { ensureWorkshopUnitsTable } from "@/lib/workshop-generator/workshop-units";

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

  await ensureCourseWorkspaceTables(prisma);
  await ensureWorkshopUnitsTable(prisma);
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

  await ensureCourseWorkspaceTables(prisma);
  await ensureWorkshopUnitsTable(prisma);
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

  return NextResponse.json({ workspace: serializeCourseWorkspace(saved), saveMode: "updated" });
}
