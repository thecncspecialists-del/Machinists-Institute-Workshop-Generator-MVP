import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { buildCourseBreadcrumbs, EditorBreadcrumbs } from "@/components/workshop-generator/EditorStatus";
import {
  externalLmsProviders,
  getExternalLmsAssetKey,
  getExternalLmsSearchMatches,
  isExternalLmsProvider,
  type ExternalLmsCatalogItem,
  type ExternalLmsProvider
} from "@/lib/external-lms-catalog";
import { prisma } from "@/lib/db";
import { emptyLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type LmsBrowserSearchParams = Promise<Record<string, string | string[] | undefined>>;

type UsageEntry = {
  courseId: string;
  courseCode: string;
  courseName: string;
  program: string;
  workshopTitle: string;
  unitNumber: number;
  unitTitle: string;
};

const providerLabels: Record<ExternalLmsProvider, string> = {
  electude: "Electude",
  amatrol: "Amatrol",
  "tooling-u": "Tooling U"
};

export default async function LmsBrowserPage({ searchParams }: { searchParams: LmsBrowserSearchParams }) {
  const params = await searchParams;
  const query = stringParam(params.q);
  const provider = normalizeProvider(stringParam(params.provider));
  const program = stringParam(params.program).toUpperCase();
  const page = Math.max(1, Number(stringParam(params.page) || "1"));
  const pageSize = 50;
  const usageByAsset = await getUsageByAsset();
  const programOptions = await getProgramOptions();
  const matches = getExternalLmsSearchMatches({ provider, query });
  const filteredMatches = program
    ? matches.filter((item) => usageForItem(item, usageByAsset).some((usage) => usage.program === program))
    : matches;
  const totalResults = filteredMatches.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const activePage = Math.min(page, totalPages);
  const from = totalResults === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const to = Math.min(totalResults, activePage * pageSize);
  const filteredItems = filteredMatches.slice((activePage - 1) * pageSize, activePage * pageSize);
  const previousPage = activePage > 1 ? buildPageLink(params, activePage - 1) : null;
  const nextPage = activePage < totalPages ? buildPageLink(params, activePage + 1) : null;

  return (
    <>
      <header className="page-header">
        <div>
          <EditorBreadcrumbs items={[...buildCourseBreadcrumbs(), { label: "LMS Browser" }]} />
          <h1>LMS Browser</h1>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid">
          <div className="field">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={query} placeholder="Asset title, class ID, department, path" />
          </div>
          <div className="field">
            <label htmlFor="provider">Provider</label>
            <select id="provider" name="provider" defaultValue={provider}>
              <option value="all">All providers</option>
              {externalLmsProviders.map((providerOption) => (
                <option key={providerOption} value={providerOption}>
                  {providerLabels[providerOption]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="program">Program Usage</label>
            <select id="program" name="program" defaultValue={program}>
              <option value="">All programs</option>
              {programOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row full">
            <button className="btn primary" type="submit">
              <Search size={18} />
              Apply Filters
            </button>
            <Link className="btn ghost" href="/lms-browser">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{totalResults} LMS assets</h2>
            <p className="inline-notice">
              Showing {from}-{to} of {totalResults}
              {program ? ` used by ${program}` : ""}
            </p>
          </div>
        </div>

        {filteredItems.length === 0 ? <div className="empty-state">No LMS assets found.</div> : null}
        {filteredItems.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Asset</th>
                  <th>Catalog</th>
                  <th>Department / Path</th>
                  <th>Used In</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.providerLabel}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="table-subtext">{item.description ? truncate(item.description, 120) : emptyLabel(item.level || item.language)}</div>
                    </td>
                    <td>
                      <strong>{emptyLabel(item.classId || item.catalogId || item.module)}</strong>
                      <div className="table-subtext">{emptyLabel(item.duration || item.lastUpdated)}</div>
                    </td>
                    <td>{truncate(item.department || item.section || item.path || item.functionalArea, 160)}</td>
                    <td>{renderUsage(item, usageForItem(item, usageByAsset))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {totalResults > pageSize ? (
          <div className="button-row" style={{ marginTop: 14 }}>
            {previousPage ? (
              <Link className="btn ghost" href={previousPage}>
                Previous
              </Link>
            ) : null}
            <span className="lede">
              Page {activePage} of {totalPages}
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

async function getUsageByAsset() {
  const units = await prisma.workshopUnit.findMany({
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
  const usageByAsset = new Map<string, UsageEntry[]>();

  for (const unit of units) {
    const input = unit.inputJson as Prisma.JsonObject;
    const asset = input.externalLmsAsset as Prisma.JsonObject | undefined;
    const assetId = typeof asset?.id === "string" ? asset.id : "";
    const assetKey = savedAssetKey(asset);
    const course = unit.workshop.courseWorkspace?.course;
    if ((!assetId && !assetKey) || input.deliveryType !== "external-lms" || !course) continue;

    const usage: UsageEntry = {
      courseId: course.id,
      courseCode: course.courseCode ?? "",
      courseName: course.courseName,
      program: programFromCourseCode(course.courseCode) ?? "",
      workshopTitle: unit.workshop.title,
      unitNumber: unit.unitNumber,
      unitTitle: unit.title
    };
    for (const key of [assetId, assetKey].filter(Boolean)) {
      usageByAsset.set(key, [...(usageByAsset.get(key) ?? []), usage]);
    }
  }

  return usageByAsset;
}

function usageForItem(item: ExternalLmsCatalogItem, usageByAsset: Map<string, UsageEntry[]>) {
  const byId = usageByAsset.get(item.id) ?? [];
  const byKey = usageByAsset.get(getExternalLmsAssetKey(item)) ?? [];
  const unique = new Map<string, UsageEntry>();

  for (const usage of [...byId, ...byKey]) {
    unique.set(`${usage.courseId}:${usage.workshopTitle}:${usage.unitNumber}:${usage.unitTitle}`, usage);
  }

  return Array.from(unique.values());
}

function savedAssetKey(asset: Prisma.JsonObject | undefined) {
  if (!asset) return "";
  const provider = typeof asset.provider === "string" && isExternalLmsProvider(asset.provider) ? asset.provider : null;
  const title = typeof asset.title === "string" ? asset.title : "";
  if (!provider || !title) return "";

  return getExternalLmsAssetKey({
    provider,
    title,
    catalogId: typeof asset.catalogId === "string" ? asset.catalogId : "",
    classId: typeof asset.classId === "string" ? asset.classId : "",
    module: typeof asset.module === "string" ? asset.module : ""
  });
}

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
      label: code
    }));
}

function renderUsage(item: ExternalLmsCatalogItem, usages: UsageEntry[]) {
  if (usages.length === 0) {
    return <span className="table-subtext">Not used yet</span>;
  }

  return (
    <div className="lms-usage-list">
      {usages.slice(0, 3).map((usage) => (
        <Link className="lms-usage-link" href={`/courses/${usage.courseId}`} key={`${item.id}-${usage.courseId}-${usage.unitNumber}`}>
          <strong>{emptyLabel(usage.courseCode)}</strong>
          <span>
            Unit {usage.unitNumber}: {usage.unitTitle}
          </span>
        </Link>
      ))}
      {usages.length > 3 ? <span className="table-subtext">+{usages.length - 3} more</span> : null}
    </div>
  );
}

function normalizeProvider(value: string): ExternalLmsProvider | "all" {
  return isExternalLmsProvider(value) ? value : "all";
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function programFromCourseCode(courseCode: string | null) {
  return courseCode?.trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? null;
}

function truncate(value: string | null | undefined, length: number) {
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
  return `/lms-browser?${query.toString()}`;
}
