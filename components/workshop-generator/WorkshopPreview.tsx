"use client";

type WorkshopPreviewProps = {
  html: string;
};

export function WorkshopPreview({ html }: WorkshopPreviewProps) {
  return (
    <section className="panel">
      <div className="eyebrow">Live Preview</div>
      <h2>Canvas-style Workshop</h2>
      <div className="preview-pane workshop-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
