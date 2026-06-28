import type { Course, CourseOutcome, CourseWorkspace, CurriculumAsset, Prisma, Workshop, WorkshopUnit } from "@prisma/client";

import { generateHomePageHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";
import { normalizeHomePageInput } from "@/lib/workshop-generator/normalize-home-page-input";

export const COURSE_WORKSPACE_TEMPLATE_VERSION = "course-workspace-v1";
export const IMAGE_PACKAGE_VERSION = "mi-canvas-image-package-v1";

const DEFAULT_HOME_PAGE_SKILLS = [
  { title: "Skill 1", description: "Description" },
  { title: "Skill 2", description: "Description" },
  { title: "Skill 3", description: "Description" },
  { title: "Skill 4", description: "Description" }
];

export type CourseWithOutcomes = Course & {
  outcomes: Pick<CourseOutcome, "outcomeCode" | "description">[];
};

export type CourseHomePageSeed = {
  id: string;
  courseCode: string | null;
  courseName: string;
  description: string | null;
  hours: number | null;
  year: number | null;
  quarter: number | null;
  canvasShellUrl: string | null;
  developmentStatus: string | null;
  outcomes: Pick<CourseOutcome, "outcomeCode" | "description">[];
};

export type CourseWorkspaceSummary = {
  id: string;
  courseId: string;
  title: string;
  summary: string | null;
  homePageInputJson: HomePageInput;
  homePageHtml: string;
  imagePackageVersion: string;
  visibility: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    courseCode: string | null;
    courseName: string;
    developmentStatus: string | null;
    hours: number | null;
    canvasShellUrl: string | null;
  };
  counts: {
    assets: number;
    workshops: number;
    units: number;
  };
  workshops: Array<{
    id: string;
    title: string;
    unitCount: number;
    units: Array<{
      id: string;
      unitNumber: number;
      title: string;
    }>;
  }>;
};

type WorkspaceWithRelations = CourseWorkspace & {
  course: Course & {
    assets?: CurriculumAsset[];
  };
  workshops?: (Workshop & {
    _count?: { units: number };
    units?: Pick<WorkshopUnit, "id" | "unitNumber" | "title">[];
  })[];
};

export function createHomePageInputFromCourse(course: CourseHomePageSeed): HomePageInput {
  const courseTitle = [course.courseCode, course.courseName].filter(Boolean).join(" - ");
  const outcomeSkills = course.outcomes.slice(0, 6).map((outcome) => ({
    title: outcome.outcomeCode || "Course Outcome",
    description: outcome.description
  }));

  return normalizeHomePageInput({
    logoImageUrl: "",
    heroImageUrl: "",
    logoFileName: "mi-logo-full.png",
    heroFileName: "mi-page-header.jpg",
    courseTitle,
    duration: course.year && course.quarter ? `Year ${course.year}, Quarter ${course.quarter}` : "",
    totalHours: course.hours != null ? String(course.hours) : "",
    courseStatus: course.developmentStatus ?? "",
    courseShellUrl: course.canvasShellUrl ?? "",
    overviewParagraphs: course.description ? [course.description] : [],
    skills: outcomeSkills.length ? outcomeSkills : DEFAULT_HOME_PAGE_SKILLS
  });
}

export function prepareCourseWorkspaceForSave(input: HomePageInput) {
  const normalized = normalizeHomePageInput(input);
  return {
    inputJson: normalized,
    html: generateHomePageHtml(normalized),
    summary: normalized.overviewParagraphs.join(" ").slice(0, 300) || null
  };
}

export function buildWorkspaceSearchWhere(query: string): Prisma.CourseWorkspaceWhereInput {
  const trimmed = query.trim();
  if (!trimmed) {
    return { archivedAt: null };
  }

  return {
    archivedAt: null,
    OR: [
      { title: { contains: trimmed, mode: "insensitive" } },
      { summary: { contains: trimmed, mode: "insensitive" } },
      { course: { courseName: { contains: trimmed, mode: "insensitive" } } },
      { course: { courseCode: { contains: trimmed, mode: "insensitive" } } },
      { course: { developmentStatus: { contains: trimmed, mode: "insensitive" } } }
    ]
  };
}

export function serializeCourseWorkspace(workspace: WorkspaceWithRelations): CourseWorkspaceSummary {
  return {
    id: workspace.id,
    courseId: workspace.courseId,
    title: workspace.title,
    summary: workspace.summary,
    homePageInputJson: workspace.homePageInputJson as HomePageInput,
    homePageHtml: workspace.homePageHtml,
    imagePackageVersion: workspace.imagePackageVersion,
    visibility: workspace.visibility,
    createdByName: workspace.createdByName,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    course: {
      id: workspace.course.id,
      courseCode: workspace.course.courseCode,
      courseName: workspace.course.courseName,
      developmentStatus: workspace.course.developmentStatus,
      hours: workspace.course.hours,
      canvasShellUrl: workspace.course.canvasShellUrl
    },
    counts: {
      assets: workspace.course.assets?.length ?? 0,
      workshops: workspace.workshops?.length ?? 0,
      units: workspace.workshops?.reduce((sum, workshop) => sum + (workshop.units?.length ?? workshop._count?.units ?? 0), 0) ?? 0
    },
    workshops:
      workspace.workshops?.map((workshop) => ({
        id: workshop.id,
        title: workshop.title,
        unitCount: workshop.units?.length ?? workshop._count?.units ?? 0,
        units:
          workshop.units?.map((unit) => ({
            id: unit.id,
            unitNumber: unit.unitNumber,
            title: unit.title
          })) ?? []
      })) ?? []
  };
}
