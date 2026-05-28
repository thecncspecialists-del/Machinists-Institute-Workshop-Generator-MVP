export function StatusPill({ status }: { status: string }) {
  const className =
    status === "Draft"
      ? "draft"
      : status === "Needs Review"
        ? "review"
        : status === "Approved" || status === "Published Manually to Canvas"
          ? "approved"
          : "archived";

  return <span className={`pill ${className}`}>{status}</span>;
}
