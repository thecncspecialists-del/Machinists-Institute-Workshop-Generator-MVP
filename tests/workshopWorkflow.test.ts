import { describe, expect, it } from "vitest";

import { buildVisibleWorkshopWhere } from "@/lib/workshop-generator/search-workshops";
import { getUnitModeButtonState } from "@/lib/workshop-generator/workshop-workflow";

describe("workshop generator workflow", () => {
  it("routes unsaved workshops to the unit gate", () => {
    expect(getUnitModeButtonState({ hasSavedWorkshop: false, unitCount: 0 })).toEqual({
      action: "show-gate",
      label: "Create Unit",
      helper: "Save workshop first"
    });
  });

  it("uses the unit mode button as create unit when a saved workshop has no units", () => {
    expect(getUnitModeButtonState({ hasSavedWorkshop: true, unitCount: 0 })).toEqual({
      action: "create-unit",
      label: "Create Unit",
      helper: "Start Unit 1"
    });
  });

  it("uses the unit mode button as edit units after units exist", () => {
    expect(getUnitModeButtonState({ hasSavedWorkshop: true, unitCount: 2 })).toEqual({
      action: "edit-units",
      label: "Edit Units",
      helper: "2 saved units"
    });
  });

  it("excludes auto-created placeholder workshops from visible workshop search", () => {
    expect(buildVisibleWorkshopWhere()).toEqual({
      archivedAt: null,
      NOT: {
        title: "Untitled workshop draft",
        courseLabel: "Course Name",
        summary: "Workshop overview pending."
      }
    });
  });
});
