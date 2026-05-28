import Link from "next/link";
import { Filter } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { assetStatuses, assetTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { compactDateTime, emptyLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type AssetSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AssetLibraryPage({ searchParams }: { searchParams: AssetSearchParams }) {
  const params = await searchParams;
  const courseId = stringParam(params.courseId);
  const assetType = stringParam(params.assetType);
  const status = stringParam(params.status);

  let assets: Awaited<ReturnType<typeof getAssets>> = [];
  let courses: Awaited<ReturnType<typeof getCourses>> = [];
  let error: string | null = null;

  try {
    [assets, courses] = await Promise.all([getAssets({ courseId, assetType, status }), getCourses()]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Database is not available.";
  }

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Asset Library</div>
          <h1>Review saved curriculum drafts.</h1>
          <p className="lede">Saved assets stay local and move through simple status labels.</p>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid">
          <div className="field">
            <label htmlFor="courseId">Course</label>
            <select id="courseId" name="courseId" defaultValue={courseId}>
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.courseCode ? `${course.courseCode} - ` : ""}
                  {course.courseName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="assetType">Asset type</label>
            <select id="assetType" name="assetType" defaultValue={assetType}>
              <option value="">All types</option>
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {assetStatuses.map((assetStatus) => (
                <option key={assetStatus} value={assetStatus}>
                  {assetStatus}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button className="btn primary" type="submit">
              <Filter size={18} />
              Filter
            </button>
            <Link className="btn ghost" href="/assets">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Saved Assets</div>
            <h2>{assets.length} results</h2>
          </div>
        </div>
        {error ? <p className="warning">{error}</p> : null}
        {!error && assets.length === 0 ? <div className="empty-state">No saved generated assets found.</div> : null}
        {assets.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <Link href={`/assets/${asset.id}`}>{asset.title}</Link>
                    </td>
                    <td>{asset.course?.courseCode || asset.course?.courseName || "Standalone asset"}</td>
                    <td>{asset.assetType}</td>
                    <td>
                      <StatusPill status={asset.status} />
                    </td>
                    <td>{emptyLabel(asset.createdBy)}</td>
                    <td>{compactDateTime(asset.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

function getAssets(filters: { courseId: string; assetType: string; status: string }) {
  return prisma.curriculumAsset.findMany({
    where: {
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.assetType ? { assetType: filters.assetType } : {}),
      ...(filters.status ? { status: filters.status } : {})
    },
    include: {
      course: {
        select: {
          courseCode: true,
          courseName: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

function getCourses() {
  return prisma.course.findMany({
    select: { id: true, courseCode: true, courseName: true },
    orderBy: [{ courseCode: "asc" }, { courseName: "asc" }],
    take: 500
  });
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
