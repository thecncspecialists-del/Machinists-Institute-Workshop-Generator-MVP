import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetReviewControls } from "@/components/AssetReviewControls";
import { OutputTabs } from "@/components/OutputTabs";
import { ReferencePanel } from "@/components/ReferencePanel";
import { StatusPill } from "@/components/StatusPill";
import { prisma } from "@/lib/db";
import { compactDateTime } from "@/lib/format";
import type { StructuredAsset } from "@/lib/renderAsset";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.curriculumAsset.findUnique({
    where: { id },
    include: { course: true }
  });

  if (!asset) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Saved Asset</div>
          <h1>{asset.title}</h1>
          <p className="lede">
            Created by {asset.createdBy || "Curriculum Community"} on {compactDateTime(asset.createdAt)}.
          </p>
        </div>
        <div className="button-row">
          <StatusPill status={asset.status} />
          <Link className="btn ghost" href={asset.courseId ? `/create?courseId=${asset.courseId}` : "/create"}>
            Regenerate Draft
          </Link>
        </div>
      </header>

      <div className="split">
        <div className="grid">
          {asset.course ? (
            <ReferencePanel course={asset.course} compact />
          ) : (
            <section className="panel">
              <div className="eyebrow">Asset Context</div>
              <h2>Standalone asset</h2>
              <p className="lede">This asset is not attached to an imported course reference.</p>
            </section>
          )}
          <AssetReviewControls
            assetId={asset.id}
            initialTitle={asset.title}
            initialStatus={asset.status}
            initialCreatedBy={asset.createdBy}
            defaultContributor={process.env.APP_DEFAULT_CONTRIBUTOR || "Curriculum Community"}
          />
        </div>
        <OutputTabs
          outputJson={asset.outputJson as StructuredAsset}
          richText={asset.richTextOutput}
          html={asset.htmlOutput}
        />
      </div>
    </>
  );
}
