import { notFound } from "next/navigation";

import { CourseWorkspaceClient } from "@/components/workshop-generator/CourseWorkspaceClient";
import { prisma } from "@/lib/db";
import type { CourseHomePageSeed } from "@/lib/workshop-generator/course-workspaces";
import { ensureCourseWorkspaceTables, serializeCourseWorkspace } from "@/lib/workshop-generator/course-workspaces";
import { ensureWorkshopUnitsTable } from "@/lib/workshop-generator/workshop-units";

export const dynamic = "force-dynamic";

type CourseWorkspaceSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CourseWorkspacePage({ searchParams }: { searchParams: CourseWorkspaceSearchParams }) {
  const params = await searchParams;
  const openWorkspaceId = stringParam(params.open);
  const courseId = stringParam(params.courseId);
  await ensureCourseWorkspaceTables(prisma);
  await ensureWorkshopUnitsTable(prisma);

  if (openWorkspaceId) {
    const workspace = await prisma.courseWorkspace.findFirst({
      where: { id: openWorkspaceId, archivedAt: null },
      include: {
        course: {
          include: {
            outcomes: {
              orderBy: { rowIndex: "asc" },
              select: { outcomeCode: true, description: true }
            },
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
            _count: { select: { units: true } }
          }
        }
      }
    });
    if (!workspace) notFound();
    return <CourseWorkspaceClient course={serializeCourseForClient(workspace.course)} initialWorkspace={serializeCourseWorkspace(workspace)} />;
  }

  const course = courseId
    ? await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          outcomes: {
            orderBy: { rowIndex: "asc" },
            select: { outcomeCode: true, description: true }
          },
          assets: true
        }
      })
    : null;

  return <CourseWorkspaceClient course={course ? serializeCourseForClient(course) : null} initialWorkspace={null} />;
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function serializeCourseForClient(
  course: CourseHomePageSeed & {
    assets?: { id: string; title: string; status: string; assetType: string }[];
  }
) {
  return {
    id: course.id,
    courseCode: course.courseCode,
    courseName: course.courseName,
    description: course.description,
    hours: course.hours,
    year: course.year,
    quarter: course.quarter,
    canvasShellUrl: course.canvasShellUrl,
    developmentStatus: course.developmentStatus,
    outcomes: course.outcomes.map((outcome) => ({
      outcomeCode: outcome.outcomeCode,
      description: outcome.description
    })),
    assets: course.assets?.map((asset) => ({
      id: asset.id,
      title: asset.title,
      status: asset.status,
      assetType: asset.assetType
    }))
  };
}
