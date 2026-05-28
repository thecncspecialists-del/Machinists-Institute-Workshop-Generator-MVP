"use server";

import { prisma } from "@/lib/db";

export async function listRecentWorkshops() {
  return prisma.workshop.findMany({
    where: { archivedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
    select: {
      id: true,
      title: true,
      courseLabel: true,
      termCode: true,
      updatedAt: true
    }
  });
}
