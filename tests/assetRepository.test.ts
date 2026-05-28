import { describe, expect, it } from "vitest";
import { createAssetSnapshot } from "@/lib/assetRepository";

describe("asset repository guardrails", () => {
  it("allowsStandaloneAssetsWithoutCourseAttachment", async () => {
    const writes: string[] = [];
    const db = {
      curriculumAsset: {
        create: async ({ data }: { data: { courseId: string | null; assetType: string; title: string } }) => {
          writes.push("asset");
          return { id: "asset-1", ...data };
        }
      },
      assetContextLink: {
        create: async () => {
          writes.push("context");
          return { id: "context-1" };
        }
      }
    };

    const asset = await createAssetSnapshot(db as never, {
      courseId: null,
      assetType: "Workshop",
      title: "Standalone Workshop",
      status: "Draft",
      inputJson: {},
      outputJson: {},
      richTextOutput: "",
      htmlOutput: "",
      createdBy: "Curriculum Community"
    });

    expect(asset.courseId).toBeNull();
    expect(writes).toEqual(["asset"]);
  });

  it("attachesCourseContextWhenCourseIsProvided", async () => {
    const writes: string[] = [];
    const db = {
      curriculumAsset: {
        create: async ({ data }: { data: { courseId: string | null; assetType: string; title: string } }) => {
          writes.push("asset");
          return { id: "asset-1", ...data };
        }
      },
      assetContextLink: {
        create: async ({ data }: { data: { courseId: string | null; contextType: string } }) => {
          writes.push(`${data.contextType}:${data.courseId}`);
          return { id: "context-1", ...data };
        }
      }
    };

    await createAssetSnapshot(db as never, {
      courseId: "00000000-0000-0000-0000-000000000000",
      assetType: "Workshop",
      title: "Course Workshop",
      status: "Draft",
      inputJson: {},
      outputJson: {},
      richTextOutput: "",
      htmlOutput: "",
      createdBy: "Curriculum Community",
      contextSnapshotJson: { source: "imported_course_reference" }
    });

    expect(writes).toEqual(["asset", "imported_course_reference:00000000-0000-0000-0000-000000000000"]);
  });
});
