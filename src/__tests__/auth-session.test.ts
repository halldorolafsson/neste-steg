import { describe, expect, it, vi } from "vitest";
import { mockDb } from "./mocks";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { Session } from "next-auth";

vi.mock("next-auth", () => ({ default: vi.fn(() => vi.fn()) }));

describe("session revocation", () => {
  it.each([
    [0, undefined, true], [0, 0, true], [1, 0, false], [1, undefined, false], [1, 1, true],
  ])("database version %s and token version %s yield access %s", async (version, tokenVersion, allowed) => {
    mockDb.user.findUnique.mockResolvedValue({ sessionVersion: version });
    const session = { user: { id: "", email: "user@example.no" }, expires: "2099-01-01" } as Session;
    const result = await authOptions.callbacks!.session!({
      session, token: { sub: "user-1", sessionVersion: tokenVersion },
    } as never);
    expect(Boolean(result.user)).toBe(allowed);
    expect((result as Session).authInvalidated === true).toBe(!allowed);
  });
});
