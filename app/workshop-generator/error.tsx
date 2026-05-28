"use client";

export default function WorkshopGeneratorError({ reset }: { reset: () => void }) {
  return (
    <div className="panel">
      <h2>Workshop generator error</h2>
      <p className="lede">Something went wrong. Try reloading this page.</p>
      <button className="btn ghost" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
