"use client";

type SaveWorkshopDialogProps = {
  busy: boolean;
  disabled?: boolean;
  label: string;
  onSave: () => void;
};

export function SaveWorkshopDialog({ busy, disabled = false, label, onSave }: SaveWorkshopDialogProps) {
  return (
    <button type="button" className="btn primary mode-save-button" onClick={onSave} disabled={busy || disabled}>
      {busy ? "Saving..." : label}
    </button>
  );
}
