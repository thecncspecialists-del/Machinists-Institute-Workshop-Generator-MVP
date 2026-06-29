import { ActionHistoryStatus, DebugIssueStatus, Prisma, Role } from "@prisma/client";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import {
  courseLinkFields,
  courseLinkLabels,
  databaseBrowserDatasetIds,
  databaseBrowserDatasets,
  DEFAULT_PAGE_SIZE,
  pageSizeOptions,
  REPORT_ROW_LIMIT,
  type CourseLinkField,
  type DatabaseBrowserColumn,
  type DatabaseBrowserDataset,
  type DatabaseBrowserResult,
  type DatabaseBrowserRow,
  type SortDirection
} from "@/lib/admin-database-browser-shared";
import { prisma } from "@/lib/db";
import {
  getExternalLmsAssetKey,
  getExternalLmsSearchMatches,
  isExternalLmsProvider,
  type ExternalLmsCatalogItem,
  type ExternalLmsProvider
} from "@/lib/external-lms-catalog";
import { compactDateTime, emptyLabel } from "@/lib/format";

const datasetLabels = new Map(databaseBrowserDatasets.map((dataset) => [dataset.id, dataset.label]));

type QueryOptions = {
  report?: boolean;
};

type BrowserParams = Record<string, string | string[] | undefined> | URLSearchParams;

export async function queryDatabaseBrowser(rawParams: BrowserParams, options: QueryOptions = {}): Promise<DatabaseBrowserResult> {
  const params = normalizeParams(rawParams);
  const dataset = normalizeDataset(params.dataset);
  const direction = normalizeDirection(params.direction);
  const page = options.report ? 1 : Math.max(1, Number(params.page || "1") || 1);
  const requestedPageSize = Number(params.pageSize || String(DEFAULT_PAGE_SIZE));
  const pageSize = options.report ? REPORT_ROW_LIMIT : normalizePageSize(requestedPageSize);
  const skip = (page - 1) * pageSize;

  switch (dataset) {
    case "users":
      return queryUsers(params, page, pageSize, skip, direction);
    case "courses":
      return queryCourses(params, page, pageSize, skip, direction);
    case "course-outcomes":
      return queryCourseOutcomes(params, page, pageSize, skip, direction);
    case "course-links":
      return queryCourseLinks(params, page, pageSize, skip, direction);
    case "course-workspaces":
      return queryCourseWorkspaces(params, page, pageSize, skip, direction);
    case "workshops":
      return queryWorkshops(params, page, pageSize, skip, direction);
    case "units":
      return queryUnits(params, page, pageSize, skip, direction);
    case "external-lms-catalog":
      return queryExternalLmsCatalog(params, page, pageSize, skip, direction);
    case "curriculum-assets":
      return queryCurriculumAssets(params, page, pageSize, skip, direction);
    case "debug-requests":
      return queryDebugRequests(params, page, pageSize, skip, direction);
    case "action-history":
      return queryActionHistory(params, page, pageSize, skip, direction);
    case "import-batches":
      return queryImportBatches(params, page, pageSize, skip, direction);
  }
}

export function databaseBrowserResultToCsv(result: DatabaseBrowserResult) {
  const headers = result.columns.map((column) => column.label);
  const lines = [
    headers.map(csvEscape).join(","),
    ...result.rows.map((row) => result.columns.map((column) => csvEscape(row.cells[column.key] ?? "")).join(","))
  ];
  return lines.join("\r\n");
}

export function databaseBrowserReportFilename(dataset: DatabaseBrowserDataset, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `database-browser-${dataset}-${date}.csv`;
}

export async function updateCourseLinksFromDatabaseBrowser({
  actor,
  courseId,
  links,
  request,
  idempotencyKey
}: {
  actor: { id: string; email?: string | null };
  courseId: string;
  links: Partial<Record<CourseLinkField, string | null>>;
  request: Request;
  idempotencyKey?: string;
}) {
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "database_browser",
    guardActionType: "database_browser_course_link_guard",
    idempotencyActionType: "database_browser_course_link_update",
    rateLimit: {
      actionTypes: ["database_browser_course_link_guard", "database_browser_course_link_update"],
      max: 60,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) return { response: guard.response };

  const normalizedLinks: Partial<Record<CourseLinkField, string | null>> = {};
  for (const field of courseLinkFields) {
    if (!(field in links)) continue;
    const normalized = normalizeOptionalHttpUrl(links[field], courseLinkLabels[field]);
    if (normalized.error) {
      return { response: Response.json({ error: normalized.error }, { status: 400 }) };
    }
    normalizedLinks[field] = normalized.value;
  }

  if (Object.keys(normalizedLinks).length === 0) {
    return { response: Response.json({ error: "At least one course link field is required." }, { status: 400 }) };
  }

  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    select: Object.fromEntries(["id", ...courseLinkFields].map((field) => [field, true])) as Prisma.CourseSelect
  });
  if (!existing) {
    return { response: Response.json({ error: "Course not found." }, { status: 404 }) };
  }

  const changedFields = courseLinkFields.filter((field) => field in normalizedLinks && existing[field] !== normalizedLinks[field]);
  const course = await prisma.course.update({
    where: { id: courseId },
    data: normalizedLinks,
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      ...Object.fromEntries(courseLinkFields.map((field) => [field, true]))
    }
  });

  await recordActionHistory({
    actor,
    actionType: "database_browser_course_link_update",
    description: "Updated course links from Database Browser.",
    area: "database_browser",
    affectedType: "course",
    affectedId: course.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: {
      changedFields,
      source: "database_browser"
    }
  });

  const responsePayload = {
    course: {
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      links: pickCourseLinks(course)
    }
  };

  await recordIdempotentMutationResult({
    actor,
    actionType: "database_browser_course_link_update",
    area: "database_browser",
    idempotencyKey: idempotencyKey ?? guard.idempotency.key,
    statusCode: 200,
    payload: responsePayload,
    description: "Recorded Database Browser course link update response for idempotency replay."
  });

  return { payload: responsePayload };
}

function normalizeParams(rawParams: BrowserParams) {
  if (rawParams instanceof URLSearchParams) {
    return Object.fromEntries(rawParams.entries());
  }

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    params[key] = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }
  return params;
}

function normalizeDataset(value: string | undefined): DatabaseBrowserDataset {
  return databaseBrowserDatasetIds.includes(value as DatabaseBrowserDataset) ? (value as DatabaseBrowserDataset) : "courses";
}

function normalizeDirection(value: string | undefined): SortDirection {
  return value === "desc" ? "desc" : "asc";
}

function normalizePageSize(value: number) {
  return pageSizeOptions.includes(value as (typeof pageSizeOptions)[number]) ? value : DEFAULT_PAGE_SIZE;
}

function commonResult(input: Omit<DatabaseBrowserResult, "datasetLabel">): DatabaseBrowserResult {
  return {
    ...input,
    datasetLabel: datasetLabels.get(input.dataset) ?? input.dataset
  };
}

function sortValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function programFromCourseCode(courseCode: string | null | undefined) {
  return courseCode?.trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "";
}

function programWhere(program: string | undefined) {
  return program ? { startsWith: program, mode: "insensitive" as const } : undefined;
}

function display(value: unknown) {
  if (value instanceof Date) return compactDateTime(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return emptyLabel(value);
}

function truncate(value: string | null | undefined, length = 180) {
  if (!value) return "Not provided";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function jsonSnippet(value: unknown, length = 700) {
  const text = JSON.stringify(value ?? null, null, 2);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function csvEscape(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalizeOptionalHttpUrl(value: string | null | undefined, label: string): { value: string | null; error: string | null } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { value: null, error: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { value: null, error: `${label} must be a valid URL.` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { value: null, error: `${label} must start with http:// or https://.` };
  }

  return { value: trimmed, error: null };
}

function pickCourseLinks(course: Record<string, unknown>) {
  return Object.fromEntries(courseLinkFields.map((field) => [field, String(course[field] ?? "")])) as Record<CourseLinkField, string>;
}

const userColumns: DatabaseBrowserColumn[] = [
  { key: "email", label: "Email", sortable: true },
  { key: "name", label: "Name", sortable: true },
  { key: "role", label: "Role", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryUsers(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["email", "name", "role", "createdAt", "updatedAt"] as const, "email");
  const where: Prisma.UserWhereInput = {
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: "insensitive" } },
            { name: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(params.role === Role.ADMIN || params.role === Role.STAFF ? { role: params.role } : {})
  };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ [sort]: direction }, { email: "asc" }],
      skip,
      take: pageSize,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
    })
  ]);

  return commonResult({
    dataset: "users",
    columns: userColumns,
    rows: items.map((user) => ({
      id: user.id,
      cells: {
        email: user.email,
        name: display(user.name),
        role: user.role,
        createdAt: display(user.createdAt),
        updatedAt: display(user.updatedAt)
      },
      details: {
        ID: user.id,
        Email: user.email,
        Name: display(user.name),
        Role: user.role,
        Created: display(user.createdAt),
        Updated: display(user.updatedAt)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: { q: params.q ?? "", role: params.role ?? "" }
  });
}

const courseColumns: DatabaseBrowserColumn[] = [
  { key: "courseCode", label: "Code", sortable: true },
  { key: "courseName", label: "Name", sortable: true },
  { key: "program", label: "Program" },
  { key: "hours", label: "Hours", sortable: true },
  { key: "year", label: "Year", sortable: true },
  { key: "quarter", label: "Quarter", sortable: true },
  { key: "updatedAt", label: "Updated", sortable: true }
];

function courseWhere(params: Record<string, string>): Prisma.CourseWhereInput {
  return {
    ...(params.q
      ? {
          OR: [
            { courseCode: { contains: params.q, mode: "insensitive" } },
            { courseName: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(params.program ? { courseCode: programWhere(params.program) } : {}),
    ...(params.year ? { year: Number(params.year) || undefined } : {}),
    ...(params.quarter ? { quarter: Number(params.quarter) || undefined } : {}),
    ...(params.status ? { developmentStatus: { contains: params.status, mode: "insensitive" } } : {})
  };
}

async function queryCourses(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["courseCode", "courseName", "hours", "year", "quarter", "updatedAt"] as const, "courseCode");
  const where = courseWhere(params);
  const [total, items] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ [sort]: { sort: direction, nulls: "last" } }, { courseName: "asc" }],
      skip,
      take: pageSize,
      include: { _count: { select: { outcomes: true, workspaces: true, assets: true } } }
    })
  ]);

  return commonResult({
    dataset: "courses",
    columns: courseColumns,
    rows: items.map((course) => ({
      id: course.id,
      cells: {
        courseCode: display(course.courseCode),
        courseName: course.courseName,
        program: programFromCourseCode(course.courseCode),
        hours: display(course.hours),
        year: display(course.year),
        quarter: display(course.quarter),
        updatedAt: display(course.updatedAt)
      },
      details: {
        ID: course.id,
        Code: display(course.courseCode),
        Name: course.courseName,
        Description: truncate(course.description, 500),
        "Development Status": display(course.developmentStatus),
        Outcomes: String(course._count.outcomes),
        Workspaces: String(course._count.workspaces),
        Assets: String(course._count.assets),
        "Syllabus URL": display(course.syllabusUrl),
        "Course Template URL": display(course.canvasShellUrl),
        "Raw Import": jsonSnippet(course.rawImportJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program", "year", "quarter", "status"])
  });
}

const outcomeColumns: DatabaseBrowserColumn[] = [
  { key: "courseCode", label: "Course" },
  { key: "outcomeCode", label: "Outcome", sortable: true },
  { key: "description", label: "Description" },
  { key: "rowIndex", label: "Row", sortable: true },
  { key: "createdAt", label: "Created", sortable: true }
];

async function queryCourseOutcomes(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["outcomeCode", "rowIndex", "createdAt"] as const, "rowIndex");
  const where: Prisma.CourseOutcomeWhereInput = {
    ...(params.q
      ? {
          OR: [
            { outcomeCode: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
            { course: { courseCode: { contains: params.q, mode: "insensitive" } } },
            { course: { courseName: { contains: params.q, mode: "insensitive" } } }
          ]
        }
      : {}),
    ...(params.program ? { course: { courseCode: programWhere(params.program) } } : {})
  };
  const [total, items] = await Promise.all([
    prisma.courseOutcome.count({ where }),
    prisma.courseOutcome.findMany({
      where,
      orderBy: [{ [sort]: direction }, { createdAt: "asc" }],
      skip,
      take: pageSize,
      include: { course: { select: { id: true, courseCode: true, courseName: true } } }
    })
  ]);

  return commonResult({
    dataset: "course-outcomes",
    columns: outcomeColumns,
    rows: items.map((outcome) => ({
      id: outcome.id,
      cells: {
        courseCode: display(outcome.course.courseCode),
        outcomeCode: display(outcome.outcomeCode),
        description: truncate(outcome.description, 180),
        rowIndex: String(outcome.rowIndex),
        createdAt: display(outcome.createdAt)
      },
      details: {
        ID: outcome.id,
        Course: `${display(outcome.course.courseCode)} - ${outcome.course.courseName}`,
        "Course ID": outcome.course.id,
        Outcome: display(outcome.outcomeCode),
        Description: outcome.description,
        "Raw Import": jsonSnippet(outcome.rawImportJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program"])
  });
}

const courseLinkColumns: DatabaseBrowserColumn[] = [
  { key: "courseCode", label: "Code", sortable: true },
  { key: "courseName", label: "Course", sortable: true },
  { key: "syllabusUrl", label: "Syllabus" },
  { key: "canvasShellUrl", label: "Template" },
  { key: "externalLinks", label: "External Links" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryCourseLinks(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["courseCode", "courseName", "updatedAt"] as const, "courseCode");
  const where: Prisma.CourseWhereInput = {
    ...courseWhere(params),
    ...(params.linkStatus === "missing"
      ? { OR: courseLinkFields.map((field) => ({ [field]: null })) }
      : {}),
    ...(params.linkStatus === "linked"
      ? { OR: courseLinkFields.map((field) => ({ [field]: { not: null } })) }
      : {})
  };
  const [total, items] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ [sort]: { sort: direction, nulls: "last" } }, { courseName: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        courseCode: true,
        courseName: true,
        updatedAt: true,
        ...Object.fromEntries(courseLinkFields.map((field) => [field, true]))
      }
    })
  ]);

  return commonResult({
    dataset: "course-links",
    columns: courseLinkColumns,
    rows: items.map((course) => {
      const links = pickCourseLinks(course);
      const linkedCount = Object.values(links).filter(Boolean).length;
      return {
        id: course.id,
        cells: {
          courseCode: display(course.courseCode),
          courseName: course.courseName,
          syllabusUrl: links.syllabusUrl ? "Linked" : "Missing",
          canvasShellUrl: links.canvasShellUrl ? "Linked" : "Missing",
          externalLinks: `${linkedCount}/${courseLinkFields.length}`,
          updatedAt: display(course.updatedAt)
        },
        details: Object.fromEntries(courseLinkFields.map((field) => [courseLinkLabels[field], display(links[field])])),
        courseLinks: { courseId: course.id, links }
      };
    }),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program", "linkStatus"])
  });
}

const workspaceColumns: DatabaseBrowserColumn[] = [
  { key: "title", label: "Workspace", sortable: true },
  { key: "course", label: "Course" },
  { key: "visibility", label: "Visibility", sortable: true },
  { key: "workshops", label: "Workshops" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryCourseWorkspaces(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["title", "visibility", "updatedAt"] as const, "updatedAt");
  const where: Prisma.CourseWorkspaceWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { summary: { contains: params.q, mode: "insensitive" } },
            { course: { courseCode: { contains: params.q, mode: "insensitive" } } },
            { course: { courseName: { contains: params.q, mode: "insensitive" } } }
          ]
        }
      : {}),
    ...(params.program ? { course: { courseCode: programWhere(params.program) } } : {}),
    ...(params.archived === "yes" ? { archivedAt: { not: null } } : params.archived === "all" ? {} : { archivedAt: null })
  };
  const [total, items] = await Promise.all([
    prisma.courseWorkspace.count({ where }),
    prisma.courseWorkspace.findMany({
      where,
      orderBy: [{ [sort]: direction }, { title: "asc" }],
      skip,
      take: pageSize,
      include: {
        course: { select: { id: true, courseCode: true, courseName: true } },
        _count: { select: { workshops: true } }
      }
    })
  ]);

  return commonResult({
    dataset: "course-workspaces",
    columns: workspaceColumns,
    rows: items.map((workspace) => ({
      id: workspace.id,
      cells: {
        title: workspace.title,
        course: `${display(workspace.course.courseCode)} - ${workspace.course.courseName}`,
        visibility: workspace.visibility,
        workshops: String(workspace._count.workshops),
        updatedAt: display(workspace.updatedAt)
      },
      details: {
        ID: workspace.id,
        Course: `${display(workspace.course.courseCode)} - ${workspace.course.courseName}`,
        "Course ID": workspace.course.id,
        Summary: truncate(workspace.summary, 500),
        "Created By": display(workspace.createdByName),
        Archived: display(workspace.archivedAt),
        "Home Page Input": jsonSnippet(workspace.homePageInputJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program", "archived"])
  });
}

const workshopColumns: DatabaseBrowserColumn[] = [
  { key: "title", label: "Workshop", sortable: true },
  { key: "courseLabel", label: "Course", sortable: true },
  { key: "termCode", label: "Term", sortable: true },
  { key: "units", label: "Units" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryWorkshops(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["title", "courseLabel", "termCode", "updatedAt"] as const, "updatedAt");
  const where: Prisma.WorkshopWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { courseLabel: { contains: params.q, mode: "insensitive" } },
            { summary: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(params.program ? { courseLabel: programWhere(params.program) } : {}),
    ...(params.archived === "yes" ? { archivedAt: { not: null } } : params.archived === "all" ? {} : { archivedAt: null })
  };
  const [total, items] = await Promise.all([
    prisma.workshop.count({ where }),
    prisma.workshop.findMany({
      where,
      orderBy: [{ [sort]: direction }, { title: "asc" }],
      skip,
      take: pageSize,
      include: {
        courseWorkspace: { select: { id: true, title: true, course: { select: { id: true, courseCode: true, courseName: true } } } },
        _count: { select: { units: true } }
      }
    })
  ]);

  return commonResult({
    dataset: "workshops",
    columns: workshopColumns,
    rows: items.map((workshop) => ({
      id: workshop.id,
      cells: {
        title: workshop.title,
        courseLabel: workshop.courseLabel,
        termCode: workshop.termCode,
        units: String(workshop._count.units),
        updatedAt: display(workshop.updatedAt)
      },
      details: {
        ID: workshop.id,
        Workspace: display(workshop.courseWorkspace?.title),
        Course: workshop.courseWorkspace?.course
          ? `${display(workshop.courseWorkspace.course.courseCode)} - ${workshop.courseWorkspace.course.courseName}`
          : "Not linked",
        Summary: truncate(workshop.summary, 500),
        Tags: workshop.tags.join(", ") || "None",
        Visibility: workshop.visibility,
        Archived: display(workshop.archivedAt),
        Input: jsonSnippet(workshop.inputJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program", "archived"])
  });
}

const unitColumns: DatabaseBrowserColumn[] = [
  { key: "unitNumber", label: "Unit", sortable: true },
  { key: "title", label: "Title", sortable: true },
  { key: "deliveryType", label: "Delivery" },
  { key: "provider", label: "LMS" },
  { key: "workshop", label: "Workshop" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryUnits(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["unitNumber", "title", "updatedAt"] as const, "unitNumber");
  const where: Prisma.WorkshopUnitWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { workshop: { title: { contains: params.q, mode: "insensitive" } } },
            { workshop: { courseLabel: { contains: params.q, mode: "insensitive" } } }
          ]
        }
      : {}),
    ...(params.program ? { workshop: { courseLabel: programWhere(params.program) } } : {})
  };
  const [total, items] = await Promise.all([
    prisma.workshopUnit.count({ where }),
    prisma.workshopUnit.findMany({
      where,
      orderBy: [{ [sort]: direction }, { title: "asc" }],
      skip,
      take: pageSize,
      include: {
        workshop: {
          select: {
            id: true,
            title: true,
            courseLabel: true,
            courseWorkspace: { select: { course: { select: { id: true, courseCode: true, courseName: true } } } }
          }
        }
      }
    })
  ]);

  const rows = items
    .map((unit) => {
      const input = unit.inputJson as Prisma.JsonObject;
      const asset = input.externalLmsAsset as Prisma.JsonObject | undefined;
      const deliveryType = typeof input.deliveryType === "string" ? input.deliveryType : "canvas-html";
      const provider = typeof asset?.providerLabel === "string" ? asset.providerLabel : typeof asset?.provider === "string" ? asset.provider : "";
      return {
        unit,
        deliveryType,
        provider
      };
    })
    .filter((item) => (params.deliveryType ? item.deliveryType === params.deliveryType : true))
    .filter((item) => (params.provider ? item.provider.toLowerCase().includes(params.provider.toLowerCase()) : true));

  return commonResult({
    dataset: "units",
    columns: unitColumns,
    rows: rows.map(({ unit, deliveryType, provider }) => ({
      id: unit.id,
      cells: {
        unitNumber: String(unit.unitNumber),
        title: unit.title,
        deliveryType,
        provider: provider || "None",
        workshop: unit.workshop.title,
        updatedAt: display(unit.updatedAt)
      },
      details: {
        ID: unit.id,
        Workshop: unit.workshop.title,
        Course: unit.workshop.courseWorkspace?.course
          ? `${display(unit.workshop.courseWorkspace.course.courseCode)} - ${unit.workshop.courseWorkspace.course.courseName}`
          : unit.workshop.courseLabel,
        "HTML Length": `${unit.htmlOutput.length} chars`,
        Input: jsonSnippet(unit.inputJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "program", "deliveryType", "provider"])
  });
}

const externalLmsColumns: DatabaseBrowserColumn[] = [
  { key: "provider", label: "Provider", sortable: true },
  { key: "title", label: "Title", sortable: true },
  { key: "catalogId", label: "Catalog ID", sortable: true },
  { key: "department", label: "Department" },
  { key: "duration", label: "Duration" },
  { key: "used", label: "Used" }
];

async function queryExternalLmsCatalog(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const provider = isExternalLmsProvider(params.provider) ? params.provider : "all";
  const matches = getExternalLmsSearchMatches({ provider, query: params.q });
  const usageByAsset = await getExternalLmsUsageByAsset();
  const sorted = [...matches].sort((a, b) => sortExternalLms(a, b, sortValue(params.sort, ["provider", "title", "catalogId"] as const, "provider"), direction));
  const items = sorted.slice(skip, skip + pageSize);

  return commonResult({
    dataset: "external-lms-catalog",
    columns: externalLmsColumns,
    rows: items.map((item) => {
      const usage = usageByAsset.get(getExternalLmsAssetKey(item)) ?? [];
      return {
        id: item.id,
        cells: {
          provider: item.providerLabel,
          title: item.title,
          catalogId: display(item.catalogId || item.classId || item.module),
          department: display(item.department || item.section || item.functionalArea),
          duration: display(item.duration),
          used: String(usage.length)
        },
        details: {
          ID: item.id,
          Provider: item.providerLabel,
          Title: item.title,
          Description: truncate(item.description, 500),
          URL: display(item.url),
          Path: display(item.path),
          Department: display(item.department),
          Section: display(item.section),
          Level: display(item.level),
          Language: display(item.language),
          "Used In": usage.map((entry) => `${entry.courseCode} Unit ${entry.unitNumber}: ${entry.unitTitle}`).join("; ") || "Not used yet"
        }
      };
    }),
    page,
    pageSize,
    total: sorted.length,
    sort: sortValue(params.sort, ["provider", "title", "catalogId"] as const, "provider"),
    direction,
    filters: { q: params.q ?? "", provider: provider === "all" ? "" : provider }
  });
}

function sortExternalLms(a: ExternalLmsCatalogItem, b: ExternalLmsCatalogItem, sort: "provider" | "title" | "catalogId", direction: SortDirection) {
  const multiplier = direction === "desc" ? -1 : 1;
  const aValue = sort === "catalogId" ? a.catalogId || a.classId || a.module : a[sort];
  const bValue = sort === "catalogId" ? b.catalogId || b.classId || b.module : b[sort];
  return aValue.localeCompare(bValue) * multiplier || a.title.localeCompare(b.title);
}

async function getExternalLmsUsageByAsset() {
  const units = await prisma.workshopUnit.findMany({
    where: {
      workshop: {
        archivedAt: null
      }
    },
    select: {
      unitNumber: true,
      title: true,
      inputJson: true,
      workshop: {
        select: {
          title: true,
          courseWorkspace: {
            select: {
              course: {
                select: {
                  id: true,
                  courseCode: true,
                  courseName: true
                }
              }
            }
          }
        }
      }
    }
  });
  const usageByAsset = new Map<string, Array<{ courseId: string; courseCode: string; courseName: string; unitNumber: number; unitTitle: string }>>();

  for (const unit of units) {
    const input = unit.inputJson as Prisma.JsonObject;
    if (input.deliveryType !== "external-lms") continue;
    const asset = input.externalLmsAsset as Prisma.JsonObject | undefined;
    const provider = typeof asset?.provider === "string" && isExternalLmsProvider(asset.provider) ? asset.provider : null;
    const title = typeof asset?.title === "string" ? asset.title : "";
    const course = unit.workshop.courseWorkspace?.course;
    if (!provider || !title || !course) continue;
    const key = getExternalLmsAssetKey({
      provider,
      title,
      catalogId: typeof asset?.catalogId === "string" ? asset.catalogId : "",
      classId: typeof asset?.classId === "string" ? asset.classId : "",
      module: typeof asset?.module === "string" ? asset.module : ""
    });
    usageByAsset.set(key, [
      ...(usageByAsset.get(key) ?? []),
      {
        courseId: course.id,
        courseCode: course.courseCode ?? "",
        courseName: course.courseName,
        unitNumber: unit.unitNumber,
        unitTitle: unit.title
      }
    ]);
  }

  return usageByAsset;
}

const assetColumns: DatabaseBrowserColumn[] = [
  { key: "title", label: "Title", sortable: true },
  { key: "assetType", label: "Type", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "course", label: "Course" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryCurriculumAssets(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["title", "assetType", "status", "updatedAt"] as const, "updatedAt");
  const where: Prisma.CurriculumAssetWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { assetType: { contains: params.q, mode: "insensitive" } },
            { status: { contains: params.q, mode: "insensitive" } },
            { course: { courseCode: { contains: params.q, mode: "insensitive" } } },
            { course: { courseName: { contains: params.q, mode: "insensitive" } } }
          ]
        }
      : {}),
    ...(params.assetType ? { assetType: params.assetType } : {}),
    ...(params.status ? { status: params.status } : {})
  };
  const [total, items] = await Promise.all([
    prisma.curriculumAsset.count({ where }),
    prisma.curriculumAsset.findMany({
      where,
      orderBy: [{ [sort]: direction }, { title: "asc" }],
      skip,
      take: pageSize,
      include: { course: { select: { id: true, courseCode: true, courseName: true } } }
    })
  ]);

  return commonResult({
    dataset: "curriculum-assets",
    columns: assetColumns,
    rows: items.map((asset) => ({
      id: asset.id,
      cells: {
        title: asset.title,
        assetType: asset.assetType,
        status: asset.status,
        course: asset.course ? `${display(asset.course.courseCode)} - ${asset.course.courseName}` : "Standalone",
        updatedAt: display(asset.updatedAt)
      },
      details: {
        ID: asset.id,
        Course: asset.course ? `${display(asset.course.courseCode)} - ${asset.course.courseName}` : "Standalone",
        "Created By": display(asset.createdBy),
        "HTML Length": `${asset.htmlOutput.length} chars`,
        Input: jsonSnippet(asset.inputJson),
        Output: jsonSnippet(asset.outputJson)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "assetType", "status"])
  });
}

const debugColumns: DatabaseBrowserColumn[] = [
  { key: "title", label: "Title", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "reporter", label: "Reporter" },
  { key: "archived", label: "Archived" },
  { key: "updatedAt", label: "Updated", sortable: true }
];

async function queryDebugRequests(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["title", "status", "updatedAt", "createdAt"] as const, "updatedAt");
  const status = Object.values(DebugIssueStatus).includes(params.status as DebugIssueStatus) ? (params.status as DebugIssueStatus) : undefined;
  const where: Prisma.DebugIssueWhereInput = {
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
            { reporterEmail: { contains: params.q, mode: "insensitive" } },
            { reporterName: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(status ? { status } : {}),
    ...(params.archived === "yes" ? { archivedAt: { not: null } } : params.archived === "all" ? {} : { archivedAt: null })
  };
  const [total, items] = await Promise.all([
    prisma.debugIssue.count({ where }),
    prisma.debugIssue.findMany({
      where,
      orderBy: [{ [sort]: direction }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: { _count: { select: { messages: true } } }
    })
  ]);

  return commonResult({
    dataset: "debug-requests",
    columns: debugColumns,
    rows: items.map((issue) => ({
      id: issue.id,
      cells: {
        title: issue.title,
        status: issue.status,
        reporter: issue.reporterName || issue.reporterEmail || "Unknown",
        archived: issue.archivedAt ? "Yes" : "No",
        updatedAt: display(issue.updatedAt)
      },
      details: {
        ID: issue.id,
        Description: issue.description,
        "Page URL": display(issue.pageUrl),
        "Admin Response": display(issue.adminResponse),
        Messages: String(issue._count.messages),
        Reporter: `${display(issue.reporterName)} <${display(issue.reporterEmail)}>`,
        Resolved: display(issue.resolvedAt),
        Archived: display(issue.archivedAt)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "status", "archived"])
  });
}

const actionColumns: DatabaseBrowserColumn[] = [
  { key: "timestamp", label: "Time", sortable: true },
  { key: "actorEmail", label: "Actor" },
  { key: "area", label: "Area", sortable: true },
  { key: "actionType", label: "Action", sortable: true },
  { key: "status", label: "Status", sortable: true }
];

async function queryActionHistory(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["timestamp", "area", "actionType", "status"] as const, "timestamp");
  const where: Prisma.ActionHistoryWhereInput = {
    ...(params.q
      ? {
          OR: [
            { actorEmail: { contains: params.q, mode: "insensitive" } },
            { actionType: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
            { area: { contains: params.q, mode: "insensitive" } },
            { affectedId: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(params.area ? { area: params.area } : {}),
    ...(params.status ? { status: params.status as ActionHistoryStatus } : {})
  };
  const [total, items] = await Promise.all([
    prisma.actionHistory.count({ where }),
    prisma.actionHistory.findMany({
      where,
      orderBy: [{ [sort]: direction }],
      skip,
      take: pageSize
    })
  ]);

  return commonResult({
    dataset: "action-history",
    columns: actionColumns,
    rows: items.map((action) => ({
      id: action.id,
      cells: {
        timestamp: display(action.timestamp),
        actorEmail: display(action.actorEmail),
        area: action.area,
        actionType: action.actionType,
        status: action.status
      },
      details: {
        ID: action.id,
        Description: action.description,
        Actor: display(action.actorEmail),
        "Actor ID": display(action.actorUserId),
        "Affected Type": display(action.affectedType),
        "Affected ID": display(action.affectedId),
        Metadata: jsonSnippet(action.metadata)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q", "area", "status"])
  });
}

const importBatchColumns: DatabaseBrowserColumn[] = [
  { key: "filename", label: "Filename", sortable: true },
  { key: "source", label: "Source", sortable: true },
  { key: "importedBy", label: "Imported By", sortable: true },
  { key: "rowCount", label: "Rows", sortable: true },
  { key: "importedAt", label: "Imported", sortable: true }
];

async function queryImportBatches(params: Record<string, string>, page: number, pageSize: number, skip: number, direction: SortDirection) {
  const sort = sortValue(params.sort, ["filename", "source", "importedBy", "rowCount", "importedAt"] as const, "importedAt");
  const where: Prisma.CourseImportBatchWhereInput = {
    ...(params.q
      ? {
          OR: [
            { filename: { contains: params.q, mode: "insensitive" } },
            { source: { contains: params.q, mode: "insensitive" } },
            { importedBy: { contains: params.q, mode: "insensitive" } },
            { notes: { contains: params.q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const [total, items] = await Promise.all([
    prisma.courseImportBatch.count({ where }),
    prisma.courseImportBatch.findMany({
      where,
      orderBy: [{ [sort]: direction }],
      skip,
      take: pageSize,
      include: { _count: { select: { courses: true } } }
    })
  ]);

  return commonResult({
    dataset: "import-batches",
    columns: importBatchColumns,
    rows: items.map((batch) => ({
      id: batch.id,
      cells: {
        filename: batch.filename,
        source: batch.source,
        importedBy: display(batch.importedBy),
        rowCount: String(batch.rowCount),
        importedAt: display(batch.importedAt)
      },
      details: {
        ID: batch.id,
        Courses: String(batch._count.courses),
        Notes: display(batch.notes)
      }
    })),
    page,
    pageSize,
    total,
    sort,
    direction,
    filters: pickFilters(params, ["q"])
  });
}

function pickFilters(params: Record<string, string>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, params[key] ?? ""]));
}
