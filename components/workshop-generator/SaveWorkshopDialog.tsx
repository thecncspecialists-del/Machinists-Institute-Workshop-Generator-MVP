"use client";

type SaveWorkshopDialogProps = {
  busy: boolean;
  saveAsCopy: boolean;
  onChangeSaveAsCopy: (value: boolean) => void;
  onSave: () => void;
};

export function SaveWorkshopDialog({ busy, saveAsCopy, onChangeSaveAsCopy, onSave }: SaveWorkshopDialogProps) {
  return (
    <section className="panel">
      <div className="eyebrow">Workshop Commons</div>
      <h3>Save Options</h3>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 10px 0" }}>
        <input type="checkbox" checked={saveAsCopy} onChange={(event) => onChangeSaveAsCopy(event.target.checked)} />
        <span>Save as new copy (recommended)</span>
      </label>
      <button type="button" className="btn gold" onClick={onSave} disabled={busy}>
        {busy ? "Saving..." : "Save to Workshop Commons"}
      </button>
    </section>
  );
}
