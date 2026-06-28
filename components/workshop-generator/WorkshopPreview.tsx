"use client";

import { useEffect, useRef } from "react";

type WorkshopPreviewProps = {
  activeSection?: string | null;
  emptyDescription?: string;
  emptyTitle?: string;
  html: string;
  title?: string;
};

export function WorkshopPreview({
  activeSection = null,
  emptyDescription = "No content selected.",
  emptyTitle = "No preview",
  html,
  title = "Canvas-style Workshop"
}: WorkshopPreviewProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    preview.querySelectorAll(".preview-section-highlight").forEach((element) => {
      element.classList.remove("preview-section-highlight");
    });

    if (!activeSection) return;

    const headings = Array.from(preview.querySelectorAll("h2, h3"));
    const target = headings.find((heading) => heading.textContent?.toLowerCase().includes(activeSection.toLowerCase()));
    if (!target) return;

    target.classList.add("preview-section-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSection, html]);

  return (
    <section className="panel">
      <h2>{title}</h2>
      {html ? (
        <div className="preview-pane workshop-preview" dangerouslySetInnerHTML={{ __html: html }} ref={previewRef} />
      ) : (
        <div className="preview-pane preview-empty-state">
          <div>
            <div className="eyebrow">{emptyTitle}</div>
            <p>{emptyDescription}</p>
          </div>
        </div>
      )}
    </section>
  );
}
