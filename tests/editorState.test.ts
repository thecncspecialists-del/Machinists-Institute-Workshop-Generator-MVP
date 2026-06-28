import { describe, expect, it } from "vitest";

import { getCanvasReadiness, hasPassedCanvasReadiness, isEditorDirty } from "@/lib/workshop-generator/editor-state";

describe("editor state helpers", () => {
  it("treats matching loaded and current values as pristine", () => {
    const loaded = { title: "Workshop 1", objectives: ["one", "two"] };

    expect(isEditorDirty({ objectives: ["one", "two"], title: "Workshop 1" }, loaded)).toBe(false);
  });

  it("detects edited values as dirty", () => {
    const loaded = { title: "Workshop 1", objectives: ["one"] };

    expect(isEditorDirty({ title: "Workshop 1", objectives: ["one", "two"] }, loaded)).toBe(true);
  });

  it("returns pristine after successful save snapshot is updated", () => {
    const current = { title: "Workshop 1", objectives: ["one", "two"] };
    const savedAfterSave = current;

    expect(isEditorDirty(current, savedAfterSave)).toBe(false);
  });

  it("keeps workshop and unit dirty comparisons isolated", () => {
    const savedWorkshop = { title: "Workshop 1" };
    const savedUnit = { title: "Unit 1" };

    expect(isEditorDirty({ title: "Workshop 1" }, savedWorkshop)).toBe(false);
    expect(isEditorDirty({ title: "Unit 1 revised" }, savedUnit)).toBe(true);
  });

  it("checks Canvas readiness for safe copy output", () => {
    const readiness = getCanvasReadiness({
      hasCopyTarget: true,
      requiredContextPresent: true,
      sourceHtml: '<div><img src="https://workshops.thecnc.network/image.png" /></div>'
    });

    expect(hasPassedCanvasReadiness(readiness)).toBe(true);
  });

  it("blocks Canvas readiness when scripts are present", () => {
    const readiness = getCanvasReadiness({
      hasCopyTarget: true,
      requiredContextPresent: true,
      sourceHtml: "<div><script>alert(1)</script></div>"
    });

    expect(hasPassedCanvasReadiness(readiness)).toBe(false);
  });
});
