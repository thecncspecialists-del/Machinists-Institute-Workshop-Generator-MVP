"use client";

import { useEffect, useState } from "react";

type WorkshopSummary = {
  id: string;
  title: string;
  courseLabel: string;
  termCode: string;
  summary: string | null;
  tags: string[];
  updatedAt: string;
};

type WorkshopCommonsSearchProps = {
  onOpenWorkshop: (id: string) => void;
};

export function WorkshopCommonsSearch({ onOpenWorkshop }: WorkshopCommonsSearchProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<WorkshopSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const searchQuery = query.trim();
        const response = await fetch(`/api/workshops?q=${encodeURIComponent(searchQuery)}&limit=30`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as { workshops?: WorkshopSummary[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Search failed.");
        }
        if (active) {
          setResults(payload.workshops ?? []);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Search failed.");
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <section className="panel">
      <div className="eyebrow">Workshop Commons</div>
      <h2>Find Saved Workshops</h2>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="commons-search">Search by title, course, term, tags, or summary</label>
        <input
          id="commons-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search saved workshops"
        />
      </div>

      {busy ? <p className="inline-notice">Searching...</p> : null}
      {error ? <div className="warning">{error}</div> : null}

      <div className="picker-list" style={{ marginTop: 12 }}>
        {results.length === 0 ? (
          <div className="empty-state">No workshops found yet.</div>
        ) : (
          results.map((workshop) => (
            <button
              className="picker-item"
              type="button"
              key={workshop.id}
              onClick={() => onOpenWorkshop(workshop.id)}
              style={{ textAlign: "left" }}
            >
              <strong>{workshop.title}</strong>
              <span>
                {workshop.courseLabel} | {workshop.termCode}
              </span>
              <span>{workshop.summary || "No summary saved."}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
