export type SaveState = {
  message?: string;
  savedAt?: string;
  status: "idle" | "dirty" | "saving" | "saved" | "error";
};

export type CanvasReadinessItem = {
  label: string;
  passed: boolean;
};

export function stableEditorStringify(value: unknown) {
  return JSON.stringify(sortForStableStringify(value));
}

export function isEditorDirty(current: unknown, saved: unknown) {
  return stableEditorStringify(current) !== stableEditorStringify(saved);
}

export function createSaveState(status: SaveState["status"], message?: string): SaveState {
  return {
    message,
    savedAt: status === "saved" ? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : undefined,
    status
  };
}

export function getSaveStateLabel(state: SaveState) {
  if (state.status === "saving") return "Saving...";
  if (state.status === "dirty") return "Unsaved changes";
  if (state.status === "saved") return state.savedAt ? `Saved at ${state.savedAt}` : "Saved";
  if (state.status === "error") return state.message ? `Save failed: ${state.message}` : "Save failed";
  return "No changes";
}

export function getCanvasReadiness(input: {
  authoredLinesRendered?: boolean;
  hasCopyTarget: boolean;
  requiredContextPresent: boolean;
  sourceHtml: string;
}): CanvasReadinessItem[] {
  const imageSources = Array.from(input.sourceHtml.matchAll(/<img[^>]+src="([^"]+)"/gi)).map((match) => match[1] ?? "");

  return [
    { label: "All authored lines rendered", passed: input.authoredLinesRendered ?? true },
    { label: "No script tags", passed: !/<script[\s>]/i.test(input.sourceHtml) },
    {
      label: "Images use reachable URLs",
      passed: imageSources.length === 0 || imageSources.every((src) => src.startsWith("http") || src.startsWith("/"))
    },
    { label: "Required title/context present", passed: input.requiredContextPresent },
    { label: "Copy target available", passed: input.hasCopyTarget }
  ];
}

export function hasPassedCanvasReadiness(items: CanvasReadinessItem[]) {
  return items.every((item) => item.passed);
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortForStableStringify((value as Record<string, unknown>)[key]);
      return sorted;
    }, {});
}
