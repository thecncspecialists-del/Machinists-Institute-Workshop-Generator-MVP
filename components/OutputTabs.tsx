"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, Code2, Download, Eye, FileText, Save } from "lucide-react";
import { assetStatuses, AssetStatus } from "@/lib/constants";
import type { StructuredAsset } from "@/lib/renderAsset";

export function OutputTabs({
  outputJson,
  richText,
  html,
  onSave,
  canSave = false,
  saved = false,
  saveDisabled = false
}: {
  outputJson: StructuredAsset;
  richText: string;
  html: string;
  onSave?: (status: AssetStatus) => Promise<void>;
  canSave?: boolean;
  saved?: boolean;
  saveDisabled?: boolean;
}) {
  const [tab, setTab] = useState<"canvas" | "editor">("canvas");
  const [status, setStatus] = useState<AssetStatus>("Draft");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeCopyMode, setActiveCopyMode] = useState<"rich" | "html">("html");

  const mapped = useMemo(() => mapCanvasPreview(outputJson), [outputJson]);
  const hasDraftContent = useMemo(() => outputJson.sections.some(hasSectionContent), [outputJson]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Could not copy ${label.toLowerCase()}. Use the visible output pane instead.`);
    }
  }

  async function copyActive() {
    if (activeCopyMode === "rich") {
      await copy(richText, "Rich text");
      return;
    }
    await copy(html, "HTML");
  }

  function downloadHtml() {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFilename(outputJson.title)}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("HTML download started.");
    } catch {
      setNotice("Could not start the HTML download.");
    }
  }

  return (
    <section className="output-workspace">
      <div className="output-topbar">
        <div className="output-toolbar" aria-label="Output view actions">
          <button
            className={`icon-btn ${tab === "canvas" ? "active" : ""}`}
            type="button"
            title="Preview"
            aria-label="Preview"
            onClick={() => setTab("canvas")}
          >
            <Eye size={16} aria-hidden />
          </button>
          <button
            className={`icon-btn ${activeCopyMode === "rich" ? "active" : ""}`}
            type="button"
            title="Rich Text"
            aria-label="Rich Text"
            onClick={() => {
              setActiveCopyMode("rich");
              setTab("editor");
            }}
          >
            <FileText size={16} aria-hidden />
          </button>
          <button
            className={`icon-btn ${activeCopyMode === "html" ? "active" : ""}`}
            type="button"
            title="HTML"
            aria-label="HTML"
            onClick={() => {
              setActiveCopyMode("html");
              setTab("editor");
            }}
          >
            <Code2 size={16} aria-hidden />
          </button>
          <button
            className="icon-btn gold"
            type="button"
            title={`Copy ${activeCopyMode === "rich" ? "Rich Text" : "HTML"}`}
            aria-label={`Copy ${activeCopyMode === "rich" ? "Rich Text" : "HTML"}`}
            onClick={copyActive}
          >
            <ClipboardCopy size={16} aria-hidden />
          </button>
          <button
            className="icon-btn"
            type="button"
            title="Download HTML"
            aria-label="Download HTML"
            onClick={downloadHtml}
          >
            <Download size={16} aria-hidden />
          </button>
        </div>

        {canSave && hasDraftContent ? (
          <div className="output-save">
            <select
              aria-label="Asset status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AssetStatus)}
            >
              {assetStatuses.map((assetStatus) => (
                <option key={assetStatus} value={assetStatus}>
                  {assetStatus}
                </option>
              ))}
            </select>
            <button className="btn primary" disabled={saved || saveDisabled} onClick={() => onSave?.(status)}>
              <Save size={18} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      {notice ? <p className="inline-notice">{notice}</p> : null}

      {tab === "canvas" ? (
        <article className="canvas-card">
          <header className="canvas-card-header">
            <img className="canvas-header-image" src="/branding/mi-page-header.jpg" alt="Machinists Institute header banner" />
          </header>

          <div className="canvas-title-row">
            <img className="canvas-logo-image" src="/branding/mi-logo-short.png" alt="Machinists Institute logo" />
            <span>{outputJson.title}</span>
          </div>

          <section className="canvas-overview">
            <h3>Overview</h3>
            <p>{mapped.overview || " "}</p>
          </section>

          <section className="canvas-section">
            <h3>
              <img className="canvas-icon-image" src="/Details.png" alt="" aria-hidden />
              Details
            </h3>
            {mapped.duration ? (
              <p>
                <strong>Duration:</strong> {mapped.duration}
              </p>
            ) : null}
            {mapped.format ? (
              <p>
                <strong>Format:</strong> {mapped.format}
              </p>
            ) : null}
            {mapped.materials.length > 0 ? (
              <>
                <p>
                  <strong>Materials:</strong>
                </p>
                {mapped.materials.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </>
            ) : null}
            {mapped.scope ? (
              <p>
                <strong>Scope:</strong> {mapped.scope}
              </p>
            ) : (
              mapped.details.length === 0
                ? <p> </p>
                : null
            )}
            <div className="canvas-hero" aria-label={`${outputJson.assetType} image placeholder`} />
          </section>

          <section className="canvas-section">
            <h3>
              <img className="canvas-icon-image" src="/Objectives.png" alt="" aria-hidden />
              Objectives
            </h3>
            {mapped.objectives.length === 0 ? (
              <p> </p>
            ) : (
              <ol>
                {mapped.objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="canvas-section">
            <h3>
              <img className="canvas-icon-image" src="/Learning Resources.png" alt="" aria-hidden />
              Learning Resources
            </h3>
            {mapped.resources.length === 0 ? (
              <p> </p>
            ) : (
              <ul>
                {mapped.resources.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="canvas-section">
            <h3>{outputJson.assetType === "Activity" ? "Activity Flow" : "Workshop Flow"}</h3>
            {mapped.flow.length === 0 ? <p> </p> : mapped.flow.map((item) => <p key={item}>{item}</p>)}
          </section>

          <section className="canvas-section">
            <h3>
              <img className="canvas-icon-image" src="/What to Do.png" alt="" aria-hidden />
              What To Do
            </h3>
            {mapped.todo.length === 0 ? (
              <p> </p>
            ) : (
              <ol>
                {mapped.todo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )}
          </section>

          <footer className="canvas-submission">
            <h3>Submission Details</h3>
            <p>{mapped.submission || " "}</p>
            <img className="canvas-footer-image" src="/branding/mi-page-footer.jpg" alt="Machinists Institute footer banner" />
          </footer>
        </article>
      ) : null}
      {tab === "editor" && activeCopyMode === "rich" && hasDraftContent ? <pre className="preview-pane">{richText}</pre> : null}
      {tab === "editor" && activeCopyMode === "html" && hasDraftContent ? <pre className="html-code">{html}</pre> : null}
      {hasDraftContent ? <details className="minimalist output-json">
        <summary>JSON</summary>
        <pre className="json-code">{JSON.stringify(outputJson, null, 2)}</pre>
      </details> : null}
    </section>
  );
}

function hasSectionContent(section: StructuredAsset["sections"][number]) {
  if (Array.isArray(section.content)) return section.content.some((item) => item.trim().length > 0);
  return (section.content ?? "").toString().trim().length > 0;
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "curriculum-asset";
}

function mapCanvasPreview(asset: StructuredAsset) {
  const byId = Object.fromEntries(asset.sections.map((section) => [section.id, section]));
  const durationLines = asLines(byId.duration_and_timing?.content);
  const materialsLines = asLines(byId.materials_and_equipment?.content);
  const formatLine = asLines(byId.facilitation_plan?.content)[0] ?? "";
  return {
    overview: asText(byId.overview?.content),
    duration: durationLines[0] ?? "",
    format: formatLine,
    materials: materialsLines,
    scope: asText(byId.course_context?.content),
    details: [
      asText(byId.preparation?.content),
      asText(byId.instructor_notes?.content)
    ].filter(Boolean),
    objectives: asLines(byId.learning_outcomes?.content),
    resources: asLines(byId.references?.content),
    flow: asLines(byId.facilitation_plan?.content).concat(asLines(byId.activity_steps?.content)),
    todo: asLines(byId.student_instructions?.content).concat(asLines(byId.assessment?.content)),
    submission: asText(byId.review_notes?.content) || "Human review required before publishing to Canvas."
  };
}

function asText(content: StructuredAsset["sections"][number]["content"] | undefined) {
  if (Array.isArray(content)) return content.join(" ").trim();
  return (content ?? "").toString().trim();
}

function asLines(content: StructuredAsset["sections"][number]["content"] | undefined) {
  if (Array.isArray(content)) return content.map((item) => item.trim()).filter(Boolean);
  return (content ?? "")
    .toString()
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
