import { describe, expect, it } from "vitest";
import {
  isNavigationKey,
  resolveNavigationVisibility,
} from "@/lib/navigation-config";

describe("navigation configuration", () => {
  it("hides inbox by default", () => {
    const visibility = resolveNavigationVisibility([]);

    expect(visibility.inbox).toBe(false);
    expect(visibility.dashboard).toBe(true);
  });

  it("uses stored visibility over defaults", () => {
    const visibility = resolveNavigationVisibility([
      { key: "inbox", isVisible: true },
      { key: "weekly", isVisible: false },
    ]);

    expect(visibility.inbox).toBe(true);
    expect(visibility.weekly).toBe(false);
  });

  it("accepts only known navigation keys", () => {
    expect(isNavigationKey("settings")).toBe(true);
    expect(isNavigationKey("unknown")).toBe(false);
  });
});
