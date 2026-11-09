import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Design System & Orange Theme tokens", () => {
  const cssPath = path.resolve(import.meta.dirname, "../src/styles/globals.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  it("defines orange primary color token in root and dark mode", () => {
    expect(cssContent).toContain("--primary: oklch(0.63 0.21 42)");
    expect(cssContent).toContain("--primary: oklch(0.65 0.21 42)");
  });

  it("defines dark mode background matching charcoal black aesthetic", () => {
    expect(cssContent).toContain("--background: oklch(0.12 0.005 285)");
    expect(cssContent).toContain("--sidebar: oklch(0.105 0.005 285)");
  });

  it("defines sidebar primary and chart color tokens with orange palette", () => {
    expect(cssContent).toContain("--sidebar-primary:");
    expect(cssContent).toContain("--chart-1: oklch(0.65 0.21 42)");
  });
});
