import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { emptyLabel, isHttpUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

type CourseSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function getCourses(searchParams: Record<string, string | string[] | undefined>) {
  const query = stringParam(searchParams.q);
  const status = stringParam(searchParams.status);
  const year = stringParam(searchParams.year);
  const quarter = stringParam(searchParams.quarter);
  const page = Math.max(1, Number(stringParam(searchParams.page) || "1"));
  const pageSize = 50;

  const where = {
    ...(query
      ? {
          OR: [
            { courseName: { contains: query, mode: "insensitive" as const } },
            { courseCode: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status ? { developmentStatus: status } : {}),
    ...(year ? { year: Number(year) } : {}),
    ...(quarter ? { quarter: Number(quarter) } : {})
  };

  const [total, items] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ courseCode: "asc" }, { courseName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return { total, page, pageSize, items };
}

export default async function CoursesPage({ searchParams }: { searchParams: CourseSearchParams }) {
  const params = await searchParams;
  let data: Awaited<ReturnType<typeof getCourses>> = { total: 0, page: 1, pageSize: 50, items: [] };
  let error: string | null = null;

  try {
    data = await getCourses(params);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Database is not available.";
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);
  const previousPage = data.page > 1 ? buildPageLink(params, data.page - 1) : null;
  const nextPage = data.page < totalPages ? buildPageLink(params, data.page + 1) : null;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Course Catalog</div>
          <h1>Search imported course reference data.</h1>
          <p className="lede">Selecting a course opens locked imported fields and the workshop creation flow.</p>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid">
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={stringParam(params.q)} placeholder="Course code, name, or description" />
          </div>
          <div className="field">
            <label htmlFor="status">Development status</label>
            <input id="status" name="status" defaultValue={stringParam(params.status)} placeholder="Ready, N/A, ..." />
          </div>
          <div className="field">
            <label htmlFor="year">Year</label>
            <input id="year" name="year" defaultValue={stringParam(params.year)} inputMode="numeric" />
          </div>
          <div className="field">
            <label htmlFor="quarter">Quarter</label>
            <input id="quarter" name="quarter" defaultValue={stringParam(params.quarter)} inputMode="numeric" />
          </div>
          <div className="button-row full">
            <button className="btn primary" type="submit">
              <Search size={18} />
              Search Catalog
            </button>
            <Link className="btn ghost" href="/courses">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Results</div>
            <h2>{data.total} courses</h2>
            <p className="lede">
              Showing {from}-{to} of {data.total}
            </p>
          </div>
          <Link className="btn ghost" href="/import">
            Import Course Catalog
          </Link>
        </div>

        {error ? <p className="warning">{error}</p> : null}
        {!error && data.items.length === 0 ? <div className="empty-state">No imported courses found.</div> : null}
        {data.items.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Hours</th>
                  <th>Year</th>
                  <th>Qtr</th>
                  <th>Status</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((course) => (
                  <tr key={course.id}>
                    <td>{emptyLabel(course.courseCode)}</td>
                    <td>
                      <Link href={`/courses/${course.id}`}>{course.courseName}</Link>
                    </td>
                    <td>{truncate(course.description, 160)}</td>
                    <td>{emptyLabel(course.hours)}</td>
                    <td>{emptyLabel(course.year)}</td>
                    <td>{emptyLabel(course.quarter)}</td>
                    <td>{emptyLabel(course.developmentStatus)}</td>
                    <td>
                      <div className="button-row">
                        {isHttpUrl(course.syllabusUrl) ? (
                          <a href={course.syllabusUrl} target="_blank" rel="noreferrer">
                            Syllabus
                          </a>
                        ) : null}
                        {isHttpUrl(course.canvasShellUrl) ? (
                          <a href={course.canvasShellUrl} target="_blank" rel="noreferrer">
                            Canvas
                          </a>
                        ) : null}
                        {isHttpUrl(course.enrollmentTrackerUrl) ? (
                          <a href={course.enrollmentTrackerUrl} target="_blank" rel="noreferrer">
                            Enrollment
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {data.total > data.pageSize ? (
          <div className="button-row" style={{ marginTop: 14 }}>
            {previousPage ? (
              <Link className="btn ghost" href={previousPage}>
                Previous
              </Link>
            ) : null}
            <span className="lede">
              Page {data.page} of {totalPages}
            </span>
            {nextPage ? (
              <Link className="btn ghost" href={nextPage}>
                Next
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function truncate(value: string | null, length: number) {
  if (!value) return "Not provided";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function buildPageLink(params: Record<string, string | string[] | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const serialized = Array.isArray(value) ? value[0] : value;
    if (!serialized || key === "page") continue;
    query.set(key, serialized);
  }
  query.set("page", String(page));
  return `/courses?${query.toString()}`;
}
