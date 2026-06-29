import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { ActionHistoryStatus, Role, WorkshopVisibility } from "@prisma/client";
import { FilePlus2 } from "lucide-react";
import { auth } from "@/auth";
import { CourseDetailWorkflowContext } from "@/components/CourseDetailWorkflowContext";
import { CourseResourceLinks } from "@/components/CourseResourceLinks";
import { ReferencePanel } from "@/components/ReferencePanel";
import { buildCourseBreadcrumbs, EditorBreadcrumbs } from "@/components/workshop-generator/EditorStatus";
import { recordActionHistory } from "@/lib/action-history";
import { prisma } from "@/lib/db";
import { compactDateTime } from "@/lib/format";
import { requireStaffUser } from "@/lib/require-staff-user";
import { createHomePageInputFromCourse, prepareCourseWorkspaceForSave } from "@/lib/workshop-generator/course-workspaces";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, session] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        sourceImportBatch: true,
        outcomes: { orderBy: { rowIndex: "asc" } },
        assets: { orderBy: { createdAt: "desc" }, take: 5 },
        workspaces: {
          where: { archivedAt: null },
          orderBy: { updatedAt: "desc" },
          include: {
            workshops: {
              where: { archivedAt: null },
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                title: true,
                units: {
                  orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
                  select: { id: true, unitNumber: true, title: true }
                }
              }
            },
            _count: { select: { workshops: true } }
          }
        }
      }
    }),
    auth()
  ]);

  if (!course) notFound();
  const isAdmin = session?.user?.role === Role.ADMIN;
  const latestWorkspace = course.workspaces[0] ?? null;
  const courseTitle = [course.courseCode, course.courseName].filter(Boolean).join(" - ");
  const sidebarWorkshops = course.workspaces.flatMap((workspace) =>
    workspace.workshops.map((workshop) => ({
      id: workshop.id,
      title: workshop.title,
      href: `/workshop-generator?workspace=${workspace.id}&open=${workshop.id}`,
      units: workshop.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        label: `Unit ${unit.unitNumber}`,
        href: `/workshop-generator?workspace=${workspace.id}&open=${workshop.id}&unit=${unit.id}`
      }))
    }))
  );

  return (
    <>
      <CourseDetailWorkflowContext
        course={{ id: course.id, title: courseTitle || course.courseName, href: `/courses/${course.id}` }}
        workspace={
          latestWorkspace
            ? {
                id: latestWorkspace.id,
                title: latestWorkspace.title,
                href: `/workshop-generator/course-workspace?open=${latestWorkspace.id}`
              }
            : null
        }
        workshops={sidebarWorkshops}
      />
      <header className="page-header">
        <div>
          <EditorBreadcrumbs
            items={buildCourseBreadcrumbs({
              courseId: course.id,
              includeCourseDetails: true
            })}
          />
          <h1>{course.courseName}</h1>
        </div>
      </header>

      <section className="workspace-cta-panel">
        <form action={openCourseWorkspace}>
          <input type="hidden" name="courseId" value={course.id} />
          <button className="btn primary workspace-cta-button" type="submit">
            <FilePlus2 size={22} />
            Open Class
          </button>
        </form>
      </section>

      <CourseResourceLinks
        courseId={course.id}
        initialSyllabusUrl={course.syllabusUrl}
        initialCanvasShellUrl={course.canvasShellUrl}
        isAdmin={isAdmin}
      />

      <ReferencePanel course={course} variant="summary" />

      <section className="grid two" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>{course.outcomes.length} outcomes</h2>
            </div>
          </div>
          {course.outcomes.length === 0 ? (
            <div className="empty-state">No outcomes were detected for this course.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {course.outcomes.map((outcome) => (
                    <tr key={outcome.id}>
                      <td>{outcome.outcomeCode}</td>
                      <td>{outcome.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Build State</h2>
            </div>
          </div>
          <div className="locked-grid">
            <div className="locked-field">
              <div className="locked-label">Class Build Status</div>
              <div className="locked-value">{course.workspaces[0] ? "Ready" : "Not started"}</div>
            </div>
            <div className="locked-field">
              <div className="locked-label">Workshops</div>
              <div className="locked-value">
                {course.workspaces.reduce((sum, workspace) => sum + workspace._count.workshops, 0)}
              </div>
            </div>
            <div className="locked-field">
              <div className="locked-label">Last Updated</div>
              <div className="locked-value">{course.workspaces[0] ? compactDateTime(course.workspaces[0].updatedAt) : "Not provided"}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

async function openCourseWorkspace(formData: FormData) {
  "use server";

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) redirect("/courses");

  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    redirect("/sign-in");
  }

  const existingWorkspace = await prisma.courseWorkspace.findFirst({
    where: { courseId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true }
  });
  if (existingWorkspace) {
    redirect(`/workshop-generator/course-workspace?open=${existingWorkspace.id}`);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      outcomes: {
        orderBy: { rowIndex: "asc" },
        select: { outcomeCode: true, description: true }
      }
    }
  });
  if (!course) redirect("/courses");

  const homePage = createHomePageInputFromCourse(course);
  const prepared = prepareCourseWorkspaceForSave(homePage);
  const title = prepared.inputJson.courseTitle || [course.courseCode, course.courseName].filter(Boolean).join(" - ");
  const workspace = await prisma.courseWorkspace.create({
    data: {
      courseId: course.id,
      title,
      summary: prepared.summary,
      homePageInputJson: prepared.inputJson,
      homePageHtml: prepared.html,
      visibility: WorkshopVisibility.STAFF_COMMONS,
      createdById: authResult.user.id,
      createdByName: authResult.user.name ?? authResult.user.email ?? "Staff User"
    },
    select: { id: true }
  });

  await recordActionHistory({
    actor: { id: authResult.user.id, email: authResult.user.email },
    actionType: "course_workspace_save",
    description: "Created course workspace from course overview.",
    area: "course_workspace",
    affectedType: "course_workspace",
    affectedId: workspace.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: { courseId: course.id, saveMode: "created" }
  });

  redirect(`/workshop-generator/course-workspace?open=${workspace.id}`);
}
