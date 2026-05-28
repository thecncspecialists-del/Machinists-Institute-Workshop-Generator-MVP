import { LockedField } from "@/components/LockedField";
import { compactDate } from "@/lib/format";

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

export function ReferencePanel({ course, compact = false }: { course: CourseReference; compact?: boolean }) {
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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Imported Reference Data</div>
          <h2>Locked course context</h2>
        </div>
        <span className="pill">Imported from spreadsheet</span>
      </div>
      <div className="locked-grid">
        {fields.slice(0, compact ? 8 : fields.length).map(([label, value]) => (
          <LockedField key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}
