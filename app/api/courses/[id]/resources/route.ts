import { ActionHistoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActionHistory } from "@/lib/action-history";
import { recordIdempotentMutationResult, runApiMutationGuard } from "@/lib/api-mutation-guards";
import { prisma } from "@/lib/db";
import { requireAdminUser } from "@/lib/require-staff-user";

const paramsSchema = z.object({
  id: z.string().uuid()
});

const requestSchema = z.object({
  syllabusUrl: z.string().nullable().optional(),
  canvasShellUrl: z.string().nullable().optional()
});

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdminUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const actor = { id: authResult.user.id, email: authResult.user.email };
  const guard = await runApiMutationGuard({
    request,
    actor,
    area: "course_resources",
    guardActionType: "course_resource_update_guard",
    idempotencyActionType: "course_resource_update",
    rateLimit: {
      actionTypes: ["course_resource_update", "course_resource_update_guard"],
      max: 80,
      windowMs: 5 * 60 * 1000
    }
  });
  if (guard.response) return guard.response;

  const { id } = paramsSchema.parse(await params);
  const body = requestSchema.parse(await request.json());
  const syllabusUrl = normalizeOptionalHttpUrl(body.syllabusUrl, "Syllabus URL");
  const canvasShellUrl = normalizeOptionalHttpUrl(body.canvasShellUrl, "Course template URL");

  if (syllabusUrl.error) {
    return NextResponse.json({ error: syllabusUrl.error }, { status: 400 });
  }
  if (canvasShellUrl.error) {
    return NextResponse.json({ error: canvasShellUrl.error }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      syllabusUrl: true,
      canvasShellUrl: true
    }
  });
  if (!existing) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const changedFields = [
    existing.syllabusUrl !== syllabusUrl.value ? "syllabusUrl" : "",
    existing.canvasShellUrl !== canvasShellUrl.value ? "canvasShellUrl" : ""
  ].filter(Boolean);

  const course = await prisma.course.update({
    where: { id },
    data: {
      syllabusUrl: syllabusUrl.value,
      canvasShellUrl: canvasShellUrl.value
    },
    select: {
      id: true,
      syllabusUrl: true,
      canvasShellUrl: true
    }
  });

  await recordActionHistory({
    actor,
    actionType: "course_resource_update",
    description: "Updated course resource links.",
    area: "course_resources",
    affectedType: "course",
    affectedId: course.id,
    status: ActionHistoryStatus.SUCCESS,
    metadata: {
      changedFields,
      hasSyllabusUrl: Boolean(course.syllabusUrl),
      hasCanvasShellUrl: Boolean(course.canvasShellUrl)
    }
  });

  const responsePayload = { course };
  await recordIdempotentMutationResult({
    actor,
    actionType: "course_resource_update",
    area: "course_resources",
    idempotencyKey: guard.idempotency.key,
    statusCode: 200,
    payload: responsePayload,
    description: "Recorded course resource update response for idempotency replay."
  });

  return NextResponse.json(responsePayload);
}

function normalizeOptionalHttpUrl(value: string | null | undefined, label: string): { value: string | null; error: string | null } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { value: null, error: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { value: null, error: `${label} must be a valid URL.` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { value: null, error: `${label} must start with http:// or https://.` };
  }

  return { value: trimmed, error: null };
}
