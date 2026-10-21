import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Smoke test suite", () => {
  it("verifies test setup is functional", () => {
    expect(true).toBe(true);
  });

  it("verifies path aliases and cn utility", () => {
    const result = cn("text-white", false && "hidden", "bg-orange-500");
    expect(result).toContain("text-white");
    expect(result).toContain("bg-orange-500");
    expect(result).not.toContain("hidden");
  });
});
