"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { courseFieldDefinitions } from "@/lib/constants";
import type { ColumnMapping, ImportWarning } from "@/lib/importParser";

type PreviewResponse = {
  filename: string;
  sheetName: string;
  headerRowIndex: number;
  columns: string[];
  suggestedMapping: ColumnMapping;
  previewRows: Record<string, unknown>[];
  courseCount: number;
  outcomeCount: number;
  warnings: ImportWarning[];
  sampleCourses: {
    rowIndex: number;
    courseCode: string | null;
    courseName: string;
    description: string | null;
    hours: number | null;
    year: number | null;
    quarter: number | null;
    developmentStatus: string | null;
    outcomeCount: number;
  }[];
};

export function ImportCatalogClient({ defaultContributor }: { defaultContributor: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contributorName, setContributorName] = useState(defaultContributor);

  const previewColumns = useMemo(() => preview?.columns ?? [], [preview]);

  async function previewImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/imports/preview", { method: "POST", body: formData });
      const data = await readJsonResponse<PreviewResponse>(response);

      if (!response.ok) {
        setError(data.error || "Could not preview import.");
        return;
      }

      setPreview(data);
      setMapping(data.suggestedMapping);
    } catch {
      setError("Could not reach the import preview service. Check the dev server and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping));
    const importedBy = contributorName.trim();
    if (importedBy) formData.append("importedBy", importedBy);

    try {
      const response = await fetch("/api/imports/commit", { method: "POST", body: formData });
      const data = await readJsonResponse<{ courseCount: number; outcomeCount: number }>(response);

      if (!response.ok) {
        setError(data.error || "Could not save import batch. Confirm DATABASE_URL is configured.");
        return;
      }

      setMessage(`Saved import batch with ${data.courseCount} courses and ${data.outcomeCount} outcomes.`);
    } catch {
      setError("Could not reach the import save service. Confirm the dev server is still running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Import Course Catalog</div>
            <h1>Upload spreadsheet reference data.</h1>
          </div>
          <UploadCloud size={28} />
        </div>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="catalog-file">XLSX or CSV file</label>
            <input
              id="catalog-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setMessage(null);
                setError(null);
              }}
            />
          </div>
          <div className="field full">
            <label htmlFor="import-contributor">Contributor label</label>
            <input
              id="import-contributor"
              value={contributorName}
              onChange={(event) => setContributorName(event.target.value)}
              placeholder="Curriculum developer or team"
            />
          </div>
        </div>
        <div className="button-row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={previewImport} disabled={!file || busy}>
            Preview Rows and Columns
          </button>
          <button className="btn gold" onClick={commitImport} disabled={!file || !preview || busy}>
            <CheckCircle2 size={18} />
            Save Import Batch
          </button>
        </div>
        {message ? <p className="lede">{message}</p> : null}
        {error ? <p className="warning">{error}</p> : null}
      </section>

      {preview ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Detected Structure</div>
                <h2>{preview.sheetName}</h2>
              </div>
              <span className="pill">Header row {preview.headerRowIndex + 1}</span>
            </div>
            <div className="grid three">
              <div className="metric">
                <span className="metric-value">{preview.courseCount}</span>
                <span className="metric-label">Detected courses</span>
              </div>
              <div className="metric">
                <span className="metric-value">{preview.outcomeCount}</span>
                <span className="metric-label">Detected outcomes</span>
              </div>
              <div className="metric">
                <span className="metric-value">{preview.columns.length}</span>
                <span className="metric-label">Detected columns</span>
              </div>
            </div>
          </section>

          {preview.warnings.length > 0 ? (
            <section className="panel">
              <div className="eyebrow">Import Warnings</div>
              <div className="warning-list" style={{ marginTop: 12 }}>
                {preview.warnings.map((warning) => (
                  <div key={warning.code} className={`warning ${warning.severity === "info" ? "info" : ""}`}>
                    <strong>{warning.message}</strong>
                    {warning.examples?.length ? <p>Examples: {warning.examples.join(", ")}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Column Mapping</div>
                <h2>Map spreadsheet columns to locked course fields</h2>
              </div>
            </div>
            <div className="form-grid">
              {courseFieldDefinitions.map((field) => (
                <div className="field" key={field.key}>
                  <label htmlFor={`mapping-${field.key}`}>
                    {field.label}
                    {"required" in field && field.required ? " *" : ""}
                  </label>
                  <select
                    id={`mapping-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    <option value="">Do not import</option>
                    {previewColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Preview</div>
                <h2>Detected course rows</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Hours</th>
                    <th>Year</th>
                    <th>Quarter</th>
                    <th>Status</th>
                    <th>Outcomes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleCourses.map((course) => (
                    <tr key={`${course.rowIndex}-${course.courseName}`}>
                      <td>{course.rowIndex}</td>
                      <td>{course.courseCode}</td>
                      <td>{course.courseName}</td>
                      <td>{course.hours}</td>
                      <td>{course.year}</td>
                      <td>{course.quarter}</td>
                      <td>{course.developmentStatus}</td>
                      <td>{course.outcomeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}
