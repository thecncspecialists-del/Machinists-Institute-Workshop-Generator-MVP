import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";

const paramsSchema = z.object({
  id: z.string().uuid()
});

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = paramsSchema.parse(await params);
  const workshop = await prisma.workshop.findUnique({
    where: { id }
  });

  if (!workshop || workshop.archivedAt) {
    return NextResponse.json({ error: "Workshop not found." }, { status: 404 });
  }

  return NextResponse.json({
    workshop: {
      id: workshop.id,
      title: workshop.title,
      courseLabel: workshop.courseLabel,
      termCode: workshop.termCode,
      summary: workshop.summary,
      tags: workshop.tags,
      inputJson: workshop.inputJson,
      templateVersion: workshop.templateVersion,
      visibility: workshop.visibility,
      createdByName: workshop.createdByName,
      createdAt: workshop.createdAt,
      updatedAt: workshop.updatedAt
    }
  });
}
