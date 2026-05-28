import { LockKeyhole } from "lucide-react";
import { emptyLabel, isHttpUrl } from "@/lib/format";

export function LockedField({ label, value }: { label: string; value: unknown }) {
  const display = emptyLabel(value);
  const href = typeof value === "string" && isHttpUrl(value) ? value : null;

  return (
    <div className="locked-field">
      <div className="locked-label">
        <LockKeyhole size={14} />
        {label}
      </div>
      <div className="locked-value">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {display}
          </a>
        ) : (
          display
        )}
      </div>
    </div>
  );
}
