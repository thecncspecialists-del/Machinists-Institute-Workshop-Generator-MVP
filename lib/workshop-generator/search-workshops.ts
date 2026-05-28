import { Prisma } from "@prisma/client";

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
