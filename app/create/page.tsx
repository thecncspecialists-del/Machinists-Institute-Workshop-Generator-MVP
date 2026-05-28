import { CreateAssetClient } from "@/components/CreateAssetClient";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CreateSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CreatePage({ searchParams }: { searchParams: CreateSearchParams }) {
  const params = await searchParams;
  const initialCourseId = stringParam(params.courseId);
  let contextWarning: string | null = null;

  const courses = await getCourses().catch((error) => {
    contextWarning =
      error instanceof Error
        ? `Imported course context is unavailable: ${error.message}`
        : "Imported course context is unavailable.";
    return [];
  });

  return (
    <CreateAssetClient
      courses={courses.map((course) => ({
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        description: course.description,
        hours: course.hours,
        year: course.year,
        quarter: course.quarter,
        syllabusUrl: course.syllabusUrl,
        canvasShellUrl: course.canvasShellUrl,
        physicalInventoryUrl: course.physicalInventoryUrl,
        curriculumUrl: course.curriculumUrl,
        certsUrl: course.certsUrl,
        amatrolUrl: course.amatrolUrl,
        toolingUUrl: course.toolingUUrl,
        electudeUrl: course.electudeUrl,
        developmentStatus: course.developmentStatus,
        timelineStart: course.timelineStart?.toISOString() ?? null,
        timelineEnd: course.timelineEnd?.toISOString() ?? null,
        enrollmentTrackerUrl: course.enrollmentTrackerUrl,
        outcomes: course.outcomes
      }))}
      initialCourseId={initialCourseId || null}
      defaultContributor={process.env.APP_DEFAULT_CONTRIBUTOR || "Curriculum Community"}
      contextWarning={contextWarning}
    />
  );
}

function getCourses() {
  return prisma.course.findMany({
    orderBy: [{ courseCode: "asc" }, { courseName: "asc" }],
    include: {
      outcomes: {
        orderBy: { rowIndex: "asc" },
        select: { outcomeCode: true, description: true }
      }
    },
    take: 500
  });
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
