import { describe, expect, it } from "vitest";

import { createDefaultUnitInput, prepareUnitForSave, serializeWorkshopUnit } from "@/lib/workshop-generator/workshop-units";

const workshop = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Basic Robotics",
  courseLabel: "BERT 105",
  termCode: "SP26"
};

describe("workshop units", () => {
  it("creates sequential unit defaults from workshop context", () => {
    const unit = createDefaultUnitInput(workshop, 3);

    expect(unit.unitNumber).toBe("3");
    expect(unit.sourceWorkshopId).toBe(workshop.id);
    expect(unit.workshopTitle).toBe("Basic Robotics");
    expect(unit.courseLabel).toBe("BERT 105");
    expect(unit.termLabel).toBe("SP26");
  });

  it("prepares saved units with workshop context and escaped html", () => {
    const prepared = prepareUnitForSave(
      {
        ...createDefaultUnitInput(workshop, 1),
        title: "<b>Startup</b>",
        purpose: "Use <script>alert(1)</script> safely.",
        estimatedTime: "45 minutes"
      },
      workshop
    );

    expect(prepared.title).toBe("<b>Startup</b>");
    expect(prepared.inputJson.sourceWorkshopId).toBe(workshop.id);
    expect(prepared.htmlOutput).toContain("&lt;b&gt;Startup&lt;/b&gt;");
    expect(prepared.htmlOutput).not.toContain("<script>");
  });

  it("serializes unit records for the client", () => {
    const now = new Date("2026-01-02T03:04:05.000Z");
    const serialized = serializeWorkshopUnit({
      id: "00000000-0000-0000-0000-000000000002",
      workshopId: workshop.id,
      unitNumber: 2,
      title: "Motion",
      inputJson: createDefaultUnitInput(workshop, 2),
      htmlOutput: "<div>Motion</div>",
      createdAt: now,
      updatedAt: now
    });

    expect(serialized.unitNumber).toBe(2);
    expect(serialized.inputJson.unitNumber).toBe("2");
    expect(serialized.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });
});
