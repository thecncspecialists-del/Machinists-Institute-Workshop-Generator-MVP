"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { CopyHtmlButton } from "@/components/workshop-generator/CopyHtmlButton";
import { SaveWorkshopDialog } from "@/components/workshop-generator/SaveWorkshopDialog";
import { WorkshopCommonsSearch } from "@/components/workshop-generator/WorkshopCommonsSearch";
import { WorkshopForm } from "@/components/workshop-generator/WorkshopForm";
import { WorkshopPreview } from "@/components/workshop-generator/WorkshopPreview";
import { DEFAULT_WORKSHOP_INPUT } from "@/lib/workshop-generator/default-workshop-input";
import { generateWorkshopHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { WorkshopInput } from "@/lib/workshop-generator/workshop-schema";

type LoadResponse = {
  workshop: {
    id: string;
    inputJson: WorkshopInput;
  };
};

export function WorkshopGeneratorShell() {
  const searchParams = useSearchParams();
  const [workshop, setWorkshop] = useState<WorkshopInput>(DEFAULT_WORKSHOP_INPUT);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [saveAsCopy, setSaveAsCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; success: boolean } | null>(null);

  const html = useMemo(() => generateWorkshopHtml(workshop), [workshop]);

  useEffect(() => {
    const openWorkshopId = searchParams.get("open");
    if (!openWorkshopId || openWorkshopId === selectedWorkshopId) {
      return;
    }
    void loadWorkshop(openWorkshopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function clearWorkshop() {
    setWorkshop(DEFAULT_WORKSHOP_INPUT);
    setSelectedWorkshopId(null);
    setNotice({ message: "Started a new workshop draft.", success: true });
  }

  async function loadWorkshop(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/workshops/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as LoadResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load workshop.");
      }
      setWorkshop(payload.workshop.inputJson);
      setSelectedWorkshopId(payload.workshop.id);
      setNotice({ message: "Loaded workshop from commons.", success: true });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to load workshop.", success: false });
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkshop() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/workshops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify({
          workshop,
          sourceWorkshopId: selectedWorkshopId,
          saveAsCopy
        })
      });

      const payload = (await response.json()) as { workshop?: { id: string }; error?: string; saveMode?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save workshop.");
      }

      setSelectedWorkshopId(payload.workshop?.id ?? selectedWorkshopId);
      setNotice({
        message: payload.saveMode === "updated" ? "Workshop updated in commons." : "Workshop saved to commons.",
        success: true
      });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Failed to save workshop.", success: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid create-workspace workshop-workspace">
      <div className="create-input-panel">
        <header className="panel">
          <div className="eyebrow">Machinists Institute</div>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.05 }}>Workshop Generator</h1>
          <p className="lede">
            Generate standardized Canvas LMS workshop HTML from structured workshop information.
          </p>
          <div className="button-row" style={{ marginTop: 10 }}>
            <CopyHtmlButton html={html} onCopied={(message, success) => setNotice({ message, success })} />
            <button className="btn ghost" type="button" onClick={clearWorkshop}>
              Clear / Start New
            </button>
          </div>
          {notice ? <div className={`warning ${notice.success ? "info" : ""}`}>{notice.message}</div> : null}
        </header>

        <SaveWorkshopDialog busy={busy} saveAsCopy={saveAsCopy} onChangeSaveAsCopy={setSaveAsCopy} onSave={saveWorkshop} />
        <WorkshopCommonsSearch onOpenWorkshop={loadWorkshop} />
        <WorkshopForm value={workshop} onChange={setWorkshop} />
      </div>

      <div className="preview-panel">
        <WorkshopPreview html={html} />
        <section className="panel">
          <div className="eyebrow">Copy Source</div>
          <h3>Canvas HTML</h3>
          <pre className="html-code" style={{ maxHeight: 320 }}>
            {html}
          </pre>
        </section>
      </div>
    </div>
  );
}
