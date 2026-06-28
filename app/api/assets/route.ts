import { ActionHistoryStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordActionHistory } from "@/lib/action-history";
import { runApiMutationGuard } from "@/lib/api-mutation-guards";
import { assetStatuses, assetTypes } from "@/lib/constants";
import { createAssetSnapshot } from "@/lib/assetRepository";
import { prisma } from "@/lib/db";
import { logBackendError } from "@/lib/logger";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

/**
 * Curriculum asset repository API.
 *
 * GET lists saved draft assets with optional filters. POST saves AI draft
 * output plus SME/user input. POST may include a courseId, but courseId is
 * optional so teams can store standalone reusable assets; when courseId exists
 * the route creates an asset_context_links row instead of mutating imported
 * course data.
 */
const createAssetSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  assetType: z.enum(assetTypes),
  title: z.string().min(1),
  status: z.enum(assetStatuses).default("Draft"),
  inputJson: z.record(z.unknown()),
  outputJson: z.record(z.unknown()),
  richTextOutput: z.string(),
  htmlOutput: z.string(),
  createdBy: z.string().optional()
});

export async function GET(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  const assetType = url.searchParams.get("assetType");
  const status = url.searchParams.get("status");

  const assets = await prisma.curriculumAsset.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      ...(assetType ? { assetType } : {}),
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      course: {
        select: {
          courseCode: true,
          courseName: true
        }
      }
    },
    take: 100
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const actor = { id: authResult.user.id, email: authResult.user.email };
    const guard = await runApiMutationGuard({
      request,
      actor,
      area: "asset_repository",
      guardActionType: "asset_save_guard",
      idempotencyActionType: "asset_save",
      rateLimit: {
        actionTypes: ["asset_save", "asset_save_guard"],
        max: 80,
        windowMs: 5 * 60 * 1000
      }
    });
    if (guard.response) return guard.response;

    const payload = createAssetSchema.parse(await request.json());
    const createdBy = payload.createdBy?.trim() || process.env.APP_DEFAULT_CONTRIBUTOR || "Curriculum Community";

    await prisma.contributor.upsert({
      where: { displayName: createdBy },
      update: {},
      create: { displayName: createdBy }
    });

    const contextSnapshotJson = payload.courseId
      ? await buildCourseContextSnapshot(payload.courseId, payload.inputJson)
      : undefined;

    const asset = await createAssetSnapshot(prisma, {
      courseId: payload.courseId ?? null,
      assetType: payload.assetType,
      title: payload.title,
      status: payload.status,
      inputJson: payload.inputJson as Prisma.InputJsonValue,
      outputJson: payload.outputJson as Prisma.InputJsonValue,
      richTextOutput: payload.richTextOutput,
      htmlOutput: payload.htmlOutput,
      createdBy,
      contextSnapshotJson
    });

    await recordActionHistory({
      actor,
      actionType: "asset_save",
      description: "Saved curriculum asset snapshot.",
      area: "asset_repository",
      affectedType: "curriculum_asset",
      affectedId: asset.id,
      status: ActionHistoryStatus.SUCCESS,
      metadata: { assetType: asset.assetType, status: asset.status, courseId: asset.courseId }
    });

    return NextResponse.json({ asset });
  } catch (error) {
    logBackendError("asset_saved", error);
    return NextResponse.json(
      { error: "The asset could not be saved. Check the server logs for technical details." },
      { status: 500 }
    );
  }
}

async function buildCourseContextSnapshot(
  courseId: string,
  inputJson: Record<string, unknown>
): Promise<Prisma.InputJsonObject> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { outcomes: { orderBy: { rowIndex: "asc" } } }
  });

  if (!course) {
    throw new Error(`Cannot attach asset context because course ${courseId} was not found.`);
  }

  return {
    source: "imported_course_reference",
    course: {
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      description: course.description,
      hours: course.hours,
      year: course.year,
      quarter: course.quarter,
      syllabusUrl: course.syllabusUrl,
      canvasShellUrl: course.canvasShellUrl,
      developmentStatus: course.developmentStatus,
      enrollmentTrackerUrl: course.enrollmentTrackerUrl
    },
    outcomes: course.outcomes.map((outcome) => ({
      outcomeCode: outcome.outcomeCode,
      description: outcome.description,
      rowIndex: outcome.rowIndex
    })),
    userInputs: inputJson as Prisma.InputJsonObject
  };
}
