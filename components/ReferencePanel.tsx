import { LockedField } from "@/components/LockedField";
import { compactDate, emptyLabel, isHttpUrl } from "@/lib/format";

export type CourseReference = {
  courseCode: string | null;
  courseName: string;
  description: string | null;
  hours: number | null;
  year: number | null;
  quarter: number | null;
  syllabusUrl: string | null;
  canvasShellUrl: string | null;
  physicalInventoryUrl?: string | null;
  curriculumUrl?: string | null;
  certsUrl?: string | null;
  amatrolUrl?: string | null;
  toolingUUrl?: string | null;
  electudeUrl?: string | null;
  developmentStatus: string | null;
  timelineStart?: string | Date | null;
  timelineEnd?: string | Date | null;
  enrollmentTrackerUrl: string | null;
};

export function ReferencePanel({
  course,
  compact = false,
  variant = "cards"
}: {
  course: CourseReference;
  compact?: boolean;
  variant?: "cards" | "summary";
}) {
  const fields = [
    ["Course code", course.courseCode],
    ["Course name", course.courseName],
    ["Description", course.description],
    ["Hours", course.hours],
    ["Year", course.year],
    ["Quarter", course.quarter],
    ["Development status", course.developmentStatus],
    ["Syllabus", course.syllabusUrl],
    ["Canvas shell", course.canvasShellUrl],
    ["Enrollment tracker", course.enrollmentTrackerUrl],
    ["Timeline start", compactDate(course.timelineStart)],
    ["Timeline end", compactDate(course.timelineEnd)]
  ] as const;

  if (variant === "summary") {
    const meta = [
      ["Code", course.courseCode],
      ["Hours", course.hours],
      ["Year", course.year],
      ["Quarter", course.quarter]
    ] as const;
    const links = [
      ["Syllabus", course.syllabusUrl],
      ["Canvas", course.canvasShellUrl],
      ["Enrollment", course.enrollmentTrackerUrl]
    ] as const;

    return (
      <section className="panel course-data-summary">
        <div className="course-data-summary-main">
          <div>
            <div className="eyebrow">Course Data</div>
            <h2>{course.courseName}</h2>
          </div>
          <div className="course-data-meta">
            {meta.map(([label, value]) => (
              <div className="course-data-meta-item" key={label}>
                <span>{label}</span>
                <strong>{emptyLabel(value)}</strong>
              </div>
            ))}
          </div>
        </div>
        <p className="course-data-description">{emptyLabel(course.description)}</p>
        <div className="course-data-links">
          {links.map(([label, value]) =>
            typeof value === "string" && isHttpUrl(value) ? (
              <a className="pill" href={value} key={label} rel="noreferrer" target="_blank">
                {label}
              </a>
            ) : null
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Course Data</h2>
        </div>
      </div>
      <div className="locked-grid">
        {fields.slice(0, compact ? 8 : fields.length).map(([label, value]) => (
          <LockedField key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}
