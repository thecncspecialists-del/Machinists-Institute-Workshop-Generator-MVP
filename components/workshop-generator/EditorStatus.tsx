import Link from "next/link";

import { getSaveStateLabel, type CanvasReadinessItem, type SaveState } from "@/lib/workshop-generator/editor-state";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

type BreadcrumbContext = {
  courseId?: string | null;
  workspaceId?: string | null;
  workshopHref?: string | null;
  includeCourseDetails?: boolean;
  includeHome?: boolean;
  includeWorkshop?: boolean;
  includeUnit?: boolean;
};

export function buildCourseBreadcrumbs({
  courseId,
  workspaceId,
  workshopHref,
  includeCourseDetails = false,
  includeHome = false,
  includeWorkshop = false,
  includeUnit = false
}: BreadcrumbContext = {}): BreadcrumbItem[] {
  return [
    { href: "/courses", label: "Course Catalog" },
    ...(includeCourseDetails
      ? [{ href: courseId ? `/courses/${courseId}` : undefined, label: "Course Details" }]
      : []),
    ...(includeHome
      ? [{ href: workspaceId ? `/workshop-generator/course-workspace?open=${workspaceId}` : undefined, label: "Home" }]
      : []),
    ...(includeWorkshop
      ? [{ href: workshopHref ?? undefined, label: "Workshop" }]
      : []),
    ...(includeUnit ? [{ label: "Unit" }] : [])
  ];
}

export function EditorBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="editor-breadcrumbs" aria-label="Editor breadcrumb">
      {items.map((item, index) => (
        <span className="editor-breadcrumb-item" key={`${item.label}-${index}`}>
          {index > 0 ? <span className="editor-breadcrumb-separator">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function SaveStateBadge({ state }: { state: SaveState }) {
  return (
    <div className={`save-state-badge ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
      {getSaveStateLabel(state)}
    </div>
  );
}

export function ContextChips({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="context-chip-row" aria-label="Selected editor context">
      {items.map((item) => (
        <div className="active-context-chip compact" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function CanvasReadinessPanel({ items }: { items: CanvasReadinessItem[] }) {
  return (
    <div className="canvas-readiness" aria-label="Canvas readiness">
      <div className="eyebrow">Canvas Readiness</div>
      <div className="canvas-readiness-list">
        {items.map((item) => (
          <span className={`canvas-readiness-item ${item.passed ? "passed" : "failed"}`} key={item.label}>
            <span aria-hidden>{item.passed ? "OK" : "!"}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
