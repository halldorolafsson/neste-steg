import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("authentication rate limits", () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("limits normalized accounts and releases them after the window", async () => {
    const { allowLogin } = await import("@/lib/auth-rate-limit");
    for (let attempt = 0; attempt < 10; attempt++) expect(allowLogin(" Test@Example.no ")).toBe(true);
    expect(allowLogin("test@example.no")).toBe(false);
    expect(allowLogin("other@example.no")).toBe(true);
    vi.advanceTimersByTime(15 * 60_000);
    expect(allowLogin("test@example.no")).toBe(true);
  });

  it("limits global login attempts across different emails", async () => {
    const { allowLogin } = await import("@/lib/auth-rate-limit");
    for (let attempt = 0; attempt < 100; attempt++) expect(allowLogin(`user${attempt}@example.no`)).toBe(true);
    expect(allowLogin("another@example.no")).toBe(false);
  });

  it("limits invitation acceptance and admin invitation creation", async () => {
    const { allowRegistration, allowInvitationCreation } = await import("@/lib/auth-rate-limit");
    for (let attempt = 0; attempt < 5; attempt++) expect(allowRegistration("token")).toBe(true);
    expect(allowRegistration("token")).toBe(false);
    for (let attempt = 0; attempt < 20; attempt++) expect(allowInvitationCreation("admin")).toBe(true);
    expect(allowInvitationCreation("admin")).toBe(false);
    expect(allowInvitationCreation("other-admin")).toBe(true);
  });
});