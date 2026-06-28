export type UnitModeButtonState = {
  action: "show-gate" | "create-unit" | "edit-units";
  label: string;
  helper: string;
};

export function getUnitModeButtonState({
  hasSavedWorkshop,
  unitCount
}: {
  hasSavedWorkshop: boolean;
  unitCount: number;
}): UnitModeButtonState {
  if (unitCount > 0) {
    return {
      action: "edit-units",
      label: "Edit Units",
      helper: `${unitCount} saved unit${unitCount === 1 ? "" : "s"}`
    };
  }

  if (hasSavedWorkshop) {
    return {
      action: "create-unit",
      label: "Create Unit",
      helper: "Start Unit 1"
    };
  }

  return {
    action: "show-gate",
    label: "Create Unit",
    helper: "Save workshop first"
  };
}
