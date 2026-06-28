import { describe, expect, it } from "vitest";

import { getExternalLmsCatalogItems, searchExternalLmsCatalog } from "@/lib/external-lms-catalog";

describe("external LMS catalog", () => {
  it("loads normalized provider catalogs", () => {
    const items = getExternalLmsCatalogItems();
    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.provider] = (acc[item.provider] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.electude).toBe(9770);
    expect(counts.amatrol).toBe(511);
    expect(counts["tooling-u"]).toBe(660);
  });

  it("keeps Electude module duration and path metadata", () => {
    const result = searchExternalLmsCatalog({ provider: "electude", query: "Parallel Communication", limit: 1 }).items[0];

    expect(result.title).toBe("Parallel Communication");
    expect(result.module).toBe("2");
    expect(result.duration).toBe("22 min");
    expect(result.path).toContain("Introduction to Network Communication Theory");
  });

  it("keeps Amatrol class id and department metadata", () => {
    const result = searchExternalLmsCatalog({ provider: "amatrol", query: "Manufacturing Drawings and Scales", limit: 1 }).items[0];

    expect(result.classId).toBe("WX54008-XX03XEN-E1");
    expect(result.department).toBe("Manufacturing Processes");
    expect(result.language).toBe("English");
  });

  it("keeps Tooling U URL description and level metadata", () => {
    const result = searchExternalLmsCatalog({ provider: "tooling-u", query: "Intro to Adhesive Bonding 110", limit: 1 }).items[0];

    expect(result.url).toBe("https://www.toolingu.com/class/670110");
    expect(result.description).toContain("adhesive bonding");
    expect(result.level).toBe("Beginner");
  });

  it("caps search results", () => {
    const result = searchExternalLmsCatalog({ provider: "all", query: "", limit: 500 });

    expect(result.items).toHaveLength(100);
    expect(result.limit).toBe(100);
  });
});
