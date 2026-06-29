"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Save, Search, X } from "lucide-react";

import {
  courseLinkFields,
  courseLinkLabels,
  databaseBrowserDatasets,
  pageSizeOptions,
  type CourseLinkField,
  type DatabaseBrowserDataset,
  type DatabaseBrowserResult,
  type SortDirection
} from "@/lib/admin-database-browser-shared";

const externalProviderOptions = [
  { value: "electude", label: "Electude" },
  { value: "amatrol", label: "Amatrol" },
  { value: "tooling-u", label: "Tooling U" }
];

type DatabaseBrowserClientProps = {
  result: DatabaseBrowserResult;
  params: Record<string, string>;
};

export function DatabaseBrowserClient({ result, params }: DatabaseBrowserClientProps) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  const reportHref = buildLink("/api/admin/database-browser/report", params, { dataset: result.dataset, page: "", pageSize: "" });

  return (
    <>
      <section className="panel database-browser-toolbar">
        <div className="database-browser-tabs" aria-label="Database datasets">
          {databaseBrowserDatasets.map((dataset) => (
            <Link
              className={`database-browser-tab ${dataset.id === result.dataset ? "active" : ""}`}
              href={buildDatasetLink(params, dataset.id)}
              key={dataset.id}
            >
              {dataset.label}
            </Link>
          ))}
        </div>

        <form className="database-browser-filters" action="/database-browser">
          <input type="hidden" name="dataset" value={result.dataset} />
          <div className="field">
            <label htmlFor="db-q">Search</label>
            <input id="db-q" name="q" defaultValue={params.q ?? ""} placeholder="Search visible fields" />
          </div>
          <DatasetFilters dataset={result.dataset} params={params} />
          <div className="field">
            <label htmlFor="db-page-size">Page Size</label>
            <select id="db-page-size" name="pageSize" defaultValue={String(result.pageSize)} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row full">
            <button className="btn primary" type="submit">
              <Search size={17} />
              Search
            </button>
            <Link className="btn ghost" href={`/database-browser?dataset=${result.dataset}`}>
              Clear
            </Link>
            <a className="btn ghost" href={reportHref}>
              <Download size={17} />
              Export CSV
            </a>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{result.datasetLabel}</h2>
            <p className="inline-notice">
              Showing {from}-{to} of {result.total}
            </p>
          </div>
        </div>

        {result.rows.length === 0 ? <div className="empty-state">No records found.</div> : null}
        {result.rows.length > 0 ? (
          <div className="table-wrap database-browser-table-wrap">
            <table className="database-browser-table">
              <thead>
                <tr>
                  {result.columns.map((column) => (
                    <th key={column.key}>
                      {column.sortable ? renderSortLink(column.label, column.key, params, result.sort, result.direction) : column.label}
                    </th>
                  ))}
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    {result.columns.map((column) => (
                      <td key={column.key}>{renderCell(row.cells[column.key])}</td>
                    ))}
                    <td className="database-browser-details-cell">
                      <details className="database-browser-details">
                        <summary>Open</summary>
                        <div className="database-browser-detail-grid">
                          {Object.entries(row.details).map(([label, value]) => (
                            <div className="database-browser-detail-item" key={label}>
                              <span>{label}</span>
                              {renderDetailValue(value)}
                            </div>
                          ))}
                        </div>
                        {row.courseLinks ? <CourseLinkEditor courseId={row.courseLinks.courseId} initialLinks={row.courseLinks.links} /> : null}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {result.total > result.pageSize ? (
          <div className="button-row" style={{ marginTop: 14 }}>
            {result.page > 1 ? (
              <Link className="btn ghost" href={buildLink("/database-browser", params, { page: String(result.page - 1) })}>
                Previous
              </Link>
            ) : null}
            <span className="lede">
              Page {result.page} of {totalPages}
            </span>
            {result.page < totalPages ? (
              <Link className="btn ghost" href={buildLink("/database-browser", params, { page: String(result.page + 1) })}>
                Next
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function DatasetFilters({ dataset, params }: { dataset: DatabaseBrowserDataset; params: Record<string, string> }) {
  if (dataset === "users") {
    return (
      <SelectFilter name="role" label="Role" value={params.role ?? ""} options={[["", "All roles"], ["ADMIN", "Admin"], ["STAFF", "Staff"]]} />
    );
  }
  if (["courses", "course-outcomes", "course-links", "course-workspaces", "workshops", "units"].includes(dataset)) {
    return (
      <>
        <TextFilter name="program" label="Program" value={params.program ?? ""} placeholder="MACH, BASC..." />
        {dataset === "courses" ? <TextFilter name="year" label="Year" value={params.year ?? ""} placeholder="1" /> : null}
        {dataset === "courses" ? <TextFilter name="quarter" label="Quarter" value={params.quarter ?? ""} placeholder="1" /> : null}
        {dataset === "course-links" ? (
          <SelectFilter name="linkStatus" label="Links" value={params.linkStatus ?? ""} options={[["", "Any"], ["linked", "Has links"], ["missing", "Missing links"]]} />
        ) : null}
        {["course-workspaces", "workshops"].includes(dataset) ? (
          <SelectFilter name="archived" label="Archived" value={params.archived ?? ""} options={[["", "Active"], ["all", "All"], ["yes", "Archived"]]} />
        ) : null}
      </>
    );
  }
  if (dataset === "external-lms-catalog") {
    return (
      <SelectFilter
        name="provider"
        label="Provider"
        value={params.provider ?? ""}
        options={[["", "All providers"], ...externalProviderOptions.map((option) => [option.value, option.label] as [string, string])]}
      />
    );
  }
  if (dataset === "curriculum-assets") {
    return (
      <>
        <TextFilter name="assetType" label="Asset Type" value={params.assetType ?? ""} placeholder="Workshop" />
        <TextFilter name="status" label="Status" value={params.status ?? ""} placeholder="Draft" />
      </>
    );
  }
  if (dataset === "debug-requests") {
    return (
      <>
        <SelectFilter name="status" label="Status" value={params.status ?? ""} options={[["", "Any"], ["OPEN", "Open"], ["IN_PROGRESS", "In Progress"], ["FIXED", "Fixed"]]} />
        <SelectFilter name="archived" label="Archived" value={params.archived ?? ""} options={[["", "Active"], ["all", "All"], ["yes", "Archived"]]} />
      </>
    );
  }
  if (dataset === "action-history") {
    return (
      <>
        <TextFilter name="area" label="Area" value={params.area ?? ""} placeholder="database_browser" />
        <SelectFilter name="status" label="Status" value={params.status ?? ""} options={[["", "Any"], ["SUCCESS", "Success"], ["WARNING", "Warning"], ["ERROR", "Error"]]} />
      </>
    );
  }
  return null;
}

function TextFilter({ label, name, placeholder, value }: { label: string; name: string; placeholder?: string; value: string }) {
  return (
    <div className="field">
      <label htmlFor={`db-${name}`}>{label}</label>
      <input id={`db-${name}`} name={name} defaultValue={value} placeholder={placeholder} />
    </div>
  );
}

function SelectFilter({ label, name, options, value }: { label: string; name: string; options: Array<[string, string]>; value: string }) {
  return (
    <div className="field">
      <label htmlFor={`db-${name}`}>{label}</label>
      <select id={`db-${name}`} name={name} defaultValue={value} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CourseLinkEditor({ courseId, initialLinks }: { courseId: string; initialLinks: Record<CourseLinkField, string> }) {
  const [savedLinks, setSavedLinks] = useState(initialLinks);
  const [links, setLinks] = useState(initialLinks);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const changedLinks = useMemo(() => {
    return Object.fromEntries(courseLinkFields.filter((field) => links[field] !== savedLinks[field]).map((field) => [field, links[field]]));
  }, [savedLinks, links]);
  const hasChanges = Object.keys(changedLinks).length > 0;

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/database-browser/course-links", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({ courseId, links: changedLinks })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; course?: { links: Record<CourseLinkField, string> } } | null;
      if (!response.ok || !payload?.course) {
        throw new Error(payload?.error || "Could not update course links.");
      }
      setSavedLinks(payload.course.links);
      setLinks(payload.course.links);
      setEditing(false);
      setNotice("Course links updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update course links.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="database-course-link-editor">
      <div className="panel-header compact">
        <div>
          <h3>Course Links</h3>
          <p>Limited safe edit fields.</p>
        </div>
        {!editing ? (
          <button className="btn ghost" type="button" onClick={() => setEditing(true)}>
            Edit Links
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="database-course-link-grid">
          {courseLinkFields.map((field) => (
            <div className="field" key={field}>
              <label htmlFor={`${courseId}-${field}`}>{courseLinkLabels[field]}</label>
              <input id={`${courseId}-${field}`} value={links[field]} placeholder="https://..." onChange={(event) => setLinks((current) => ({ ...current, [field]: event.target.value }))} />
            </div>
          ))}
          <div className="button-row full">
            <button className="btn primary" type="button" disabled={busy || !hasChanges} onClick={() => void save()}>
              <Save size={16} />
              Save Links
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setLinks(savedLinks);
                setEditing(false);
                setNotice("");
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="database-link-list">
          {courseLinkFields.map((field) => (
            links[field] ? (
              <a href={links[field]} key={field} rel="noreferrer" target="_blank">
                <ExternalLink size={14} />
                {courseLinkLabels[field]}
              </a>
            ) : null
          ))}
        </div>
      )}
      {notice ? <p className={notice.includes("updated") ? "inline-notice" : "warning"}>{notice}</p> : null}
    </div>
  );
}

function renderSortLink(label: string, column: string, params: Record<string, string>, activeSort: string, activeDirection: SortDirection) {
  const active = activeSort === column;
  const nextDirection = active && activeDirection === "asc" ? "desc" : "asc";
  return (
    <Link className={`table-sort ${active ? "active" : ""}`} href={buildLink("/database-browser", params, { sort: column, direction: nextDirection, page: "" })}>
      <span>{label}</span>
      {active ? <span>{activeDirection === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

function renderCell(value: string | undefined) {
  if (!value || value === "Not provided") return <span className="table-subtext">Not provided</span>;
  return value;
}

function renderDetailValue(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return (
      <a href={value} rel="noreferrer" target="_blank">
        {value}
      </a>
    );
  }
  return <strong>{value}</strong>;
}

function buildDatasetLink(params: Record<string, string>, dataset: DatabaseBrowserDataset) {
  return buildLink("/database-browser", params, { dataset, page: "", sort: "", direction: "" });
}

function buildLink(basePath: string, params: Record<string, string>, updates: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || key === "page") continue;
    query.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    query.delete(key);
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}
