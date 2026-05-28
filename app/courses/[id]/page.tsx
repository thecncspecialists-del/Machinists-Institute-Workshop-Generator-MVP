import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { ReferencePanel } from "@/components/ReferencePanel";
import { StatusPill } from "@/components/StatusPill";
import { prisma } from "@/lib/db";
import { compactDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sourceImportBatch: true,
      outcomes: { orderBy: { rowIndex: "asc" } },
      assets: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });

  if (!course) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Course Detail</div>
          <h1>{course.courseName}</h1>
          <p className="lede">
            Source: imported from spreadsheet batch `{course.sourceImportBatch.filename}` on{" "}
            {compactDateTime(course.sourceImportBatch.importedAt)}.
          </p>
        </div>
        <Link className="btn primary" href={`/create?courseId=${course.id}`}>
          <FilePlus2 size={18} />
          Open in Asset Composer
        </Link>
      </header>

      <ReferencePanel course={course} />

      <section className="grid two" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Imported Outcomes</div>
              <h2>{course.outcomes.length} preserved outcomes</h2>
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
              <div className="eyebrow">Recent Assets</div>
              <h2>Draft history</h2>
            </div>
          </div>
          {course.assets.length === 0 ? (
            <div className="empty-state">No saved assets for this course yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {course.assets.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <Link href={`/assets/${asset.id}`}>{asset.title}</Link>
                      </td>
                      <td>
                        <StatusPill status={asset.status} />
                      </td>
                      <td>{compactDateTime(asset.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
