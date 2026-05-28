"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { assetStatuses, type AssetStatus } from "@/lib/constants";

export function AssetReviewControls({
  assetId,
  initialTitle,
  initialStatus,
  initialCreatedBy,
  defaultContributor
}: {
  assetId: string;
  initialTitle: string;
  initialStatus: string;
  initialCreatedBy: string | null;
  defaultContributor: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<AssetStatus>(normalizeStatus(initialStatus));
  const [createdBy, setCreatedBy] = useState(initialCreatedBy || defaultContributor);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveReviewDetails() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const contributor = createdBy.trim();
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          ...(contributor ? { createdBy: contributor } : {})
        })
      });
      const data = await readJsonResponse<{ asset?: unknown }>(response);

      if (!response.ok) {
        setError(data.error || "Could not update this asset.");
        return;
      }

      setMessage("Review details saved.");
      router.refresh();
    } catch {
      setError("Could not reach the asset library. Check the dev server and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Review Workflow</div>
          <h2>Asset details</h2>
        </div>
      </div>
      <div className="form-grid single">
        <div className="field full">
          <label htmlFor="asset-title">Title</label>
          <input id="asset-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="asset-status">Status</label>
          <select id="asset-status" value={status} onChange={(event) => setStatus(event.target.value as AssetStatus)}>
            {assetStatuses.map((assetStatus) => (
              <option key={assetStatus} value={assetStatus}>
                {assetStatus}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="asset-contributor">Contributor label</label>
          <input
            id="asset-contributor"
            value={createdBy}
            onChange={(event) => setCreatedBy(event.target.value)}
            placeholder="Curriculum developer or team"
          />
        </div>
      </div>
      <div className="status-ladder" aria-label="Asset status flow">
        {assetStatuses.map((assetStatus) => (
          <span key={assetStatus} className={`status-step ${assetStatus === status ? "active" : ""}`}>
            {assetStatus}
          </span>
        ))}
      </div>
      <div className="button-row" style={{ marginTop: 14 }}>
        <button className="btn primary" type="button" onClick={saveReviewDetails} disabled={busy || !title.trim()}>
          <Save size={18} />
          Save Details
        </button>
      </div>
      {message ? <p className="lede">{message}</p> : null}
      {error ? <p className="warning">{error}</p> : null}
    </section>
  );
}

function normalizeStatus(status: string): AssetStatus {
  return assetStatuses.includes(status as AssetStatus) ? (status as AssetStatus) : "Draft";
}

async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}
