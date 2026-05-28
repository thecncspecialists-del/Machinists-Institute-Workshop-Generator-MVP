import type { Prisma, PrismaClient } from "@prisma/client";
import { logBackendEvent } from "@/lib/logger";

type AssetWriteClient = PrismaClient | Prisma.TransactionClient;

export type CreateAssetSnapshotInput = {
  courseId?: string | null;
  assetType: string;
  title: string;
  status: string;
  inputJson: Prisma.InputJsonValue;
  outputJson: Prisma.InputJsonValue;
  richTextOutput: string;
  htmlOutput: string;
  createdBy: string;
  contextSnapshotJson?: Prisma.InputJsonValue;
};

/**
 * Asset persistence and context attachment.
 *
 * This module centralizes the important writes for generated curriculum assets
 * so future teams can audit exactly where draft output enters the repository.
 * It intentionally does not generate AI content, mutate imported course rows,
 * or publish anything to Canvas. Imported reference data stays immutable; an
 * asset records a point-in-time context link instead of editing the course.
 */
export async function createAssetSnapshot(db: AssetWriteClient, input: CreateAssetSnapshotInput) {
  logBackendEvent("asset_created", {
    assetType: input.assetType,
    hasCourseContext: Boolean(input.courseId),
    status: input.status
  });

  const asset = await db.curriculumAsset.create({
    data: {
      courseId: input.courseId ?? null,
      assetType: input.assetType,
      title: input.title,
      status: input.status,
      inputJson: input.inputJson,
      outputJson: input.outputJson,
      richTextOutput: input.richTextOutput,
      htmlOutput: input.htmlOutput,
      createdBy: input.createdBy
    }
  });

  if (input.courseId) {
    await attachAssetContext(db, {
      assetId: asset.id,
      courseId: input.courseId,
      contextType: "imported_course_reference",
      snapshotJson: input.contextSnapshotJson ?? input.inputJson
    });
  }

  logBackendEvent("asset_saved", {
    assetId: asset.id,
    assetType: asset.assetType,
    hasCourseContext: Boolean(asset.courseId)
  });

  return asset;
}

/**
 * Attach a traceable context link to an asset.
 *
 * Assets may be standalone because a curriculum developer might draft reusable
 * materials before selecting a course. When a course is selected, this explicit
 * link records which imported reference context informed the draft without
 * giving the asset permission to overwrite the official imported course row.
 */
export async function attachAssetContext(
  db: AssetWriteClient,
  input: {
    assetId: string;
    contextType: string;
    courseId?: string | null;
    snapshotJson: Prisma.InputJsonValue;
  }
) {
  const link = await db.assetContextLink.create({
    data: {
      assetId: input.assetId,
      contextType: input.contextType,
      courseId: input.courseId ?? null,
      snapshotJson: input.snapshotJson
    }
  });

  logBackendEvent("context_attached", {
    assetId: input.assetId,
    contextType: input.contextType,
    courseId: input.courseId
  });

  return link;
}
