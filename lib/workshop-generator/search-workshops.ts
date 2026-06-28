import { Prisma } from "@prisma/client";

export const AUTO_CREATED_PLACEHOLDER_WORKSHOP = {
  title: "Untitled workshop draft",
  courseLabel: "Course Name",
  summary: "Workshop overview pending."
} as const;

export function buildVisibleWorkshopWhere() {
  return {
    archivedAt: null,
    NOT: {
      title: AUTO_CREATED_PLACEHOLDER_WORKSHOP.title,
      courseLabel: AUTO_CREATED_PLACEHOLDER_WORKSHOP.courseLabel,
      summary: AUTO_CREATED_PLACEHOLDER_WORKSHOP.summary
    }
  } satisfies Prisma.WorkshopWhereInput;
}

export function buildWorkshopSearchWhere(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return {};
  }

  return {
    OR: [
      { title: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
      { courseLabel: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
      { termCode: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
      { summary: { contains: trimmed, mode: Prisma.QueryMode.insensitive } },
      { tags: { hasSome: [trimmed] } }
    ]
  };
}
