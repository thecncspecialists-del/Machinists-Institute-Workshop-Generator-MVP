"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight, ClipboardList, Database, Layers3, LogOut, PanelTop, Sparkles, TableProperties, Trash2 } from "lucide-react";

import { AdminUserOverlay } from "@/components/admin/AdminUserOverlay";
import { DebugIssueOverlay } from "@/components/debug/DebugIssueOverlay";
import { WorkflowContextProvider, useWorkflowContext } from "@/components/workflow-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkflowContextProvider>
      <AppShellContent>{children}</AppShellContent>
    </WorkflowContextProvider>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSignInRoute = pathname.startsWith("/sign-in");
  const { state } = useWorkflowContext();
  const [courseExpanded, setCourseExpanded] = useState(true);
  const [expandedWorkshops, setExpandedWorkshops] = useState<Record<string, boolean>>({});

  const courseHref = state.course?.href ?? state.workspace?.href ?? "/courses";
  const activeWorkshopId = useMemo(
    () => state.workshops.find((workshop) => workshop.active)?.id ?? state.workshop?.id ?? null,
    [state.workshop?.id, state.workshops]
  );
  const workshops = useMemo(() => {
    if (state.workshops.length > 0) {
      return state.workshops;
    }
    if (state.workshop && state.workshop.id !== "draft-workshop") {
      return [{ ...state.workshop, active: true, units: state.units }];
    }
    return [];
  }, [state.units, state.workshop, state.workshops]);
  const hasActiveCourse = Boolean(state.course || state.workspace);
  const activeCourseTitle = state.course?.title ?? state.workspace?.title ?? "Active Course";
  const homeActive = Boolean(state.workspace?.href && pathname.startsWith("/workshop-generator/course-workspace"));
  const courseActive =
    hasActiveCourse &&
    (pathname.startsWith("/courses/") || pathname.startsWith("/workshop-generator/course-workspace") || pathname === "/workshop-generator");

  useEffect(() => {
    if (!hasActiveCourse) return;
    setCourseExpanded(true);
    setExpandedWorkshops({});
  }, [hasActiveCourse, state.course?.id, state.workspace?.id]);

  useEffect(() => {
    if (!activeWorkshopId) return;
    setExpandedWorkshops((previous) => ({ ...previous, [activeWorkshopId]: true }));
  }, [activeWorkshopId]);

  if (isSignInRoute) {
    return <main>{children}</main>;
  }

  async function deleteWorkshop(workshop: (typeof workshops)[number]) {
    const confirmed = window.confirm(
      `Delete "${workshop.title}"?\n\nThis will remove the workshop from this class and hide its units from the class workflow. This can be destructive.`
    );
    if (!confirmed) return;

    const response = await fetch(`/api/workshops/${workshop.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error || "Failed to delete workshop.");
      return;
    }

    if (workshop.active || workshop.id === state.workshop?.id) {
      router.push(state.workspace?.href ?? state.course?.href ?? "/courses");
    } else {
      router.refresh();
    }
  }

  async function deleteUnit(workshop: (typeof workshops)[number], unit: NonNullable<(typeof workshops)[number]["units"]>[number]) {
    const confirmed = window.confirm(`Delete ${unit.label}: "${unit.title}"?`);
    if (!confirmed) return;

    const response = await fetch(`/api/workshops/${workshop.id}/units/${unit.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error || "Failed to delete unit.");
      return;
    }

    if (unit.active) {
      router.push(workshop.href);
    } else {
      router.refresh();
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/sign-in", redirect: false });
    window.location.assign("/sign-in");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <img src="/branding/mi-logo-short.png" alt="Machinists Institute" />
          </span>
          <span>
            <span className="brand-title">Machinists Institute</span>
            <span className="brand-subtitle">Canvas Asset Builder</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary navigation">
          <div className="nav-section">
            <Link href="/courses" className={`nav-link ${pathname === "/courses" ? "active" : ""}`}>
              <BookOpen size={18} />
              <span>Course Catalog</span>
            </Link>
          </div>
          {hasActiveCourse ? <CourseTree /> : null}
        </nav>
        <nav className="nav sidebar-secondary-nav" aria-label="LMS navigation">
          <div className="nav-section">
            <Link href="/lms-browser" className={`nav-link ${pathname.startsWith("/lms-browser") ? "active" : ""}`}>
              <Database size={18} />
              <span>LMS Browser</span>
            </Link>
            <Link href="/database-browser" className={`nav-link ${pathname.startsWith("/database-browser") ? "active" : ""}`}>
              <TableProperties size={18} />
              <span>Database Browser</span>
            </Link>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-tools">
            <DebugIssueOverlay />
            <AdminUserOverlay />
          </div>
          <button className="btn ghost sidebar-sign-out" onClick={() => void handleSignOut()}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );

  function CourseTree() {
    return (
      <div className="nav-section nav-tree" aria-label="Active course hierarchy">
        <div className={`nav-tree-row level-1 ${courseActive ? "active" : ""}`}>
          <button
            aria-expanded={courseExpanded}
            aria-label={`${courseExpanded ? "Collapse" : "Expand"} ${activeCourseTitle}`}
            className="nav-tree-toggle"
            type="button"
            onClick={() => setCourseExpanded((expanded) => !expanded)}
          >
            {courseExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <Link className="nav-tree-link" href={courseHref}>
            <Layers3 size={16} />
            <span>{activeCourseTitle}</span>
          </Link>
        </div>
        {courseExpanded ? (
          <div className="nav-tree-children level-2">
            {state.workspace ? (
              <div className={`nav-tree-row level-2 ${homeActive ? "active" : ""}`}>
                <span className="nav-tree-toggle-spacer" aria-hidden="true" />
                <Link className="nav-tree-link" href={state.workspace.href}>
                  <PanelTop size={15} />
                  <span>Home</span>
                </Link>
                <span className="nav-tree-action-spacer" aria-hidden="true" />
              </div>
            ) : null}
            {workshops.length === 0 ? (
              <div className="nav-tree-empty">No workshops yet</div>
            ) : (
              workshops.map((workshop) => <WorkshopTreeNode key={workshop.id} workshop={workshop} />)
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function WorkshopTreeNode({ workshop }: { workshop: (typeof workshops)[number] }) {
    const units = workshop.units ?? (workshop.id === state.workshop?.id ? state.units : []);
    const expanded = expandedWorkshops[workshop.id] ?? false;
    const active = Boolean(workshop.active || workshop.id === state.workshop?.id || units.some((unit) => unit.active));

    return (
      <div className="nav-tree-branch">
        <div className={`nav-tree-row level-2 ${active ? "active" : ""}`}>
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${workshop.title}`}
            className="nav-tree-toggle"
            type="button"
            onClick={() => setExpandedWorkshops((previous) => ({ ...previous, [workshop.id]: !expanded }))}
          >
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <Link className="nav-tree-link" href={workshop.href}>
            <Sparkles size={15} />
            <span>{workshop.title}</span>
          </Link>
          <button
            aria-label={`Delete ${workshop.title}`}
            className="nav-tree-delete"
            title="Delete workshop"
            type="button"
            onClick={() => void deleteWorkshop(workshop)}
          >
            <Trash2 size={14} />
          </button>
        </div>
        {expanded ? (
          <div className="nav-tree-children level-3">
            {units.length === 0 ? (
              <div className="nav-tree-empty">No units yet</div>
            ) : (
              units.map((unit) => (
                <div className="nav-tree-unit-row" key={unit.id}>
                  <Link className={`nav-tree-unit ${unit.active ? "active" : ""}`} href={unit.href}>
                    <ClipboardList size={14} />
                    <span className="nav-unit-label">{unit.label}</span>
                    <span>{unit.title}</span>
                  </Link>
                  <button
                    aria-label={`Delete ${unit.label}: ${unit.title}`}
                    className="nav-tree-delete"
                    title="Delete unit"
                    type="button"
                    onClick={() => void deleteUnit(workshop, unit)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    );
  }
}
