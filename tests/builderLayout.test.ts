import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("builder workspace layout", () => {
  it("uses one shared editor and preview height for homepage, workshop, and unit pages", () => {
    expect(globalsCss).toContain("--builder-preview-height: calc(100vh - 150px);");
    expect(globalsCss).not.toContain("--builder-preview-height: calc(100vh - 48px);");

    const homePageModeBlock = globalsCss.match(/\.mode-home-page\s*{[^}]*}/)?.[0] ?? "";
    expect(homePageModeBlock).toContain("--mode-accent: var(--mi-blue);");
    expect(homePageModeBlock).not.toContain("--builder-preview-height");
  });

  it("keeps Copy Source in the shared lower workspace band", () => {
    expect(globalsCss).toContain(".source-panel-wide");
    expect(globalsCss).toContain("grid-column: 1 / -1;");
    expect(globalsCss).toContain("max-height: 310px;");
  });
});
