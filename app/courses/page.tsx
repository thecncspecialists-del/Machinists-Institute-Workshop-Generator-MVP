import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { DebugIssueNotificationPane } from "@/components/debug/DebugIssueNotificationPane";
import { buildCourseBreadcrumbs, EditorBreadcrumbs } from "@/components/workshop-generator/EditorStatus";
import { prisma } from "@/lib/db";
import { emptyLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type CourseSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function getCourses(searchParams: Record<string, string | string[] | undefined>) {
  const query = stringParam(searchParams.q);
  const program = stringParam(searchParams.program);
  const year = stringParam(searchParams.year);
  const quarter = stringParam(searchParams.quarter);
  const page = Math.max(1, Number(stringParam(searchParams.page) || "1"));
  const sort = normalizeSort(stringParam(searchParams.sort));
  const direction = normalizeDirection(stringParam(searchParams.direction));
  const pageSize = 50;

  const where: Prisma.CourseWhereInput = {
    ...(query
      ? {
          OR: [
            { courseName: { contains: query, mode: "insensitive" as const } },
            { courseCode: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(program ? { courseCode: { startsWith: program, mode: "insensitive" as const } } : {}),
    ...(year ? { year: Number(year) } : {}),
    ...(quarter ? { quarter: Number(quarter) } : {})
  };

  const [total, items, programOptions] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: buildCourseOrderBy(sort, direction),
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    getProgramOptions()
  ]);

  return { total, page, pageSize, items, programOptions, sort, direction };
}

export default async function CoursesPage({ searchParams }: { searchParams: CourseSearchParams }) {
  const params = await searchParams;
  let data: Awaited<ReturnType<typeof getCourses>> = {
    total: 0,
    page: 1,
    pageSize: 50,
    items: [],
    programOptions: [],
    sort: "courseCode",
    direction: "asc"
  };
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
          <EditorBreadcrumbs items={buildCourseBreadcrumbs()} />
          <h1>Course Catalog</h1>
        </div>
      </header>

      <DebugIssueNotificationPane />

      <section className="panel">
        <form className="form-grid">
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={stringParam(params.q)} placeholder="Course code, name, or description" />
          </div>
          <div className="field">
            <label htmlFor="program">Program</label>
            <select id="program" name="program" defaultValue={stringParam(params.program)}>
              <option value="">All programs</option>
              {data.programOptions.map((program) => (
                <option key={program.code} value={program.code}>
                  {program.label}
                </option>
              ))}
            </select>
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
              Apply Filters
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
            <h2>{data.total} courses</h2>
            <p className="inline-notice">
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
                  <th>{renderSortLink("Code", "courseCode", params, data.sort, data.direction)}</th>
                  <th>{renderSortLink("Name", "courseName", params, data.sort, data.direction)}</th>
                  <th>{renderSortLink("Description", "description", params, data.sort, data.direction)}</th>
                  <th>{renderSortLink("Hours", "hours", params, data.sort, data.direction)}</th>
                  <th>{renderSortLink("Year", "year", params, data.sort, data.direction)}</th>
                  <th>{renderSortLink("Quarter", "quarter", params, data.sort, data.direction)}</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {emptyLabel(course.courseCode)}
                      </Link>
                    </td>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {course.courseName}
                      </Link>
                    </td>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {truncate(course.description, 160)}
                      </Link>
                    </td>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {emptyLabel(course.hours)}
                      </Link>
                    </td>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {emptyLabel(course.year)}
                      </Link>
                    </td>
                    <td>
                      <Link className="catalog-row-link" href={courseWorkspaceHref(course)}>
                        {emptyLabel(course.quarter)}
                      </Link>
                    </td>
                    <td>{renderCourseActions(course)}</td>
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

const sortableColumns = [
  "courseCode",
  "courseName",
  "description",
  "hours",
  "year",
  "quarter"
] as const;

type SortableColumn = (typeof sortableColumns)[number];
type SortDirection = "asc" | "desc";

function normalizeSort(value: string): SortableColumn {
  return sortableColumns.includes(value as SortableColumn) ? (value as SortableColumn) : "courseCode";
}

function normalizeDirection(value: string): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function buildCourseOrderBy(sort: SortableColumn, direction: SortDirection): Prisma.CourseOrderByWithRelationInput[] {
  if (sort === "courseName") {
    return [{ courseName: direction }, { courseCode: { sort: "asc", nulls: "last" } }];
  }

  return [{ [sort]: { sort: direction, nulls: "last" } }, { courseName: "asc" }];
}

const programNames: Record<string, string> = {
  BASC: "Basic Academic Skills",
  BERT: "Boeing Employee Req. Transfer",
  BPET: "Boeing Pre-Employment Training",
  BRAP: "Boeing Registered Apprenticeship",
  CAMP: "Bootcamps",
  DEMO: "Demo Courses",
  FLMA: "Flightline Mechanic",
  FWAP: "Fabrication Welder",
  HDEM: "Heavy Duty Equipment",
  HEID: "Heidenhain North America",
  IMTA: "Industrial Maintenance",
  INCW: "Incumbent Worker Training",
  MACH: "Machinist",
  MICA: "MI Career Accelerator",
  MIYA: "MI Youth Academy",
  MOAP: "Machine Operator",
  MTAP: "Mechatronics Tech",
  MWRK: "Missouri Works Initiative",
  OSHA: "OSHA10 General",
  PDEV: "Personal Development",
  SBOX: "Sandbox Testing Environments",
  TCVM: "Trailer, Container, Van",
  TRIB: "Tribal Trainings"
};

async function getProgramOptions() {
  const courses = await prisma.course.findMany({
    select: { courseCode: true },
    orderBy: { courseCode: "asc" }
  });
  const programs = new Set<string>();

  courses.forEach((course) => {
    const program = programFromCourseCode(course.courseCode);
    if (program) programs.add(program);
  });

  return Array.from(programs)
    .sort((a, b) => a.localeCompare(b))
    .map((code) => ({
      code,
      label: programNames[code] ? `${code} - ${programNames[code]}` : code
    }));
}

function programFromCourseCode(courseCode: string | null) {
  return courseCode?.trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? null;
}

function renderSortLink(
  label: string,
  column: SortableColumn,
  params: Record<string, string | string[] | undefined>,
  activeSort: SortableColumn,
  activeDirection: SortDirection
) {
  const active = activeSort === column;
  const nextDirection: SortDirection = active && activeDirection === "asc" ? "desc" : "asc";

  return (
    <Link className={`table-sort ${active ? "active" : ""}`} href={buildSortLink(params, column, nextDirection)}>
      <span>{label}</span>
      {active ? <span aria-label={`Sorted ${activeDirection}`}>{activeDirection === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

function truncate(value: string | null, length: number) {
  if (!value) return "Not provided";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

type CatalogCourse = Awaited<ReturnType<typeof getCourses>>["items"][number];

function courseWorkspaceHref(course: CatalogCourse) {
  return `/courses/${course.id}`;
}

function renderCourseActions(course: CatalogCourse) {
  return (
    <div className="button-row">
      <Link className="btn primary" href={`/courses/${course.id}`}>
        View Details
      </Link>
    </div>
  );
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

function buildSortLink(params: Record<string, string | string[] | undefined>, sort: SortableColumn, direction: SortDirection) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const serialized = Array.isArray(value) ? value[0] : value;
    if (!serialized || key === "page" || key === "sort" || key === "direction") continue;
    query.set(key, serialized);
  }
  query.set("sort", sort);
  query.set("direction", direction);
  return `/courses?${query.toString()}`;
}
