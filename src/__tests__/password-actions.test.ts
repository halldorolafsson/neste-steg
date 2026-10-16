import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "./mocks";
import { changePassword, createPasswordReset, resetPassword } from "@/app/actions/password-actions";
import { requireAdmin } from "@/lib/authorization";
import { requireAuth } from "@/lib/auth";
import { allowPasswordReset } from "@/lib/auth-rate-limit";
import bcrypt from "bcryptjs";

vi.mock("@/lib/authorization", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/auth-rate-limit", () => ({
  allowInvitationCreation: vi.fn(() => true), allowPasswordChange: vi.fn(() => true),
  allowPasswordReset: vi.fn(() => true), hashToken: vi.fn(() => "token-hash"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));

function form(password = "new-password-123", confirmation = password) {
  const data = new FormData();
  data.set("password", password); data.set("confirmation", confirmation);
  data.set("currentPassword", "old-password-123"); data.set("token", "a".repeat(64));
  return data;
}

describe("password recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: "admin" } } as Awaited<ReturnType<typeof requireAdmin>>);
    vi.mocked(allowPasswordReset).mockReturnValue(true);
    vi.mocked(bcrypt.hash).mockResolvedValue("new-hash" as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    mockDb.$transaction.mockImplementation(async (callback) => callback(mockDb));
    mockDb.user.findUnique.mockResolvedValue({ id: "user-1", hashedPassword: "old-hash", sessionVersion: 0 });
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
    mockDb.passwordReset.updateMany.mockResolvedValue({ count: 1 });
    mockDb.passwordReset.findUnique.mockResolvedValue({ id: "reset-1", userId: "user-1", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
  });

  it("requires admin and stores only a hash with a 30-minute expiry", async () => {
    const result = await createPasswordReset("user-1");
    expect(requireAdmin).toHaveBeenCalled();
    expect(result).toMatchObject({ path: expect.stringMatching(/^\/reset-password#token=[a-f0-9]{64}$/) });
    expect(mockDb.passwordReset.create).toHaveBeenCalledWith({ data: {
      userId: "user-1", tokenHash: "token-hash", expiresAt: expect.any(Date),
    } });
    const expires = mockDb.passwordReset.create.mock.calls[0][0].data.expiresAt.getTime();
    expect(expires - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(mockDb.passwordReset.updateMany).toHaveBeenCalled();
  });

  it("rejects non-admin link creation", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Forbidden"));
    await expect(createPasswordReset("user-1")).rejects.toThrow("Forbidden");
    expect(mockDb.passwordReset.create).not.toHaveBeenCalled();
  });

  it.each(["missing", "used", "expired"])("rejects a %s reset", async (state) => {
    mockDb.passwordReset.findUnique.mockResolvedValue(state === "missing" ? null : {
      id: "reset-1", userId: "user-1", usedAt: state === "used" ? new Date() : null,
      expiresAt: state === "expired" ? new Date(0) : new Date(Date.now() + 60_000),
    });
    expect(await resetPassword(form())).toEqual({ error: "invalidLink" });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("claims a token atomically and invalidates old sessions and other reset links", async () => {
    expect(await resetPassword(form())).toEqual({ success: true });
    expect(mockDb.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: {
      hashedPassword: "new-hash", sessionVersion: { increment: 1 },
    } });
    expect(mockDb.passwordReset.updateMany).toHaveBeenCalledWith({
      where: { id: "reset-1", usedAt: null, expiresAt: { gt: expect.any(Date) } }, data: { usedAt: expect.any(Date) },
    });
  });

  it("rejects concurrent reuse without changing the password", async () => {
    mockDb.passwordReset.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await resetPassword(form())).toEqual({ error: "invalidLink" });
    expect(mockDb.user.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hashedPassword: expect.anything() }) }));
  });

  it.each(["short", "å".repeat(37)])("rejects invalid password length", async (password) => {
    expect(await resetPassword(form(password))).toEqual({ error: "invalidPassword" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords and malformed tokens", async () => {
    expect(await resetPassword(form("new-password-123", "different-password"))).toEqual({ error: "invalidPassword" });
    const data = form(); data.set("token", "invalid");
    expect(await resetPassword(data)).toEqual({ error: "invalidLink" });
  });

  it("limits reset attempts", async () => {
    vi.mocked(allowPasswordReset).mockReturnValueOnce(false);
    expect(await resetPassword(form())).toEqual({ error: "rateLimited" });
    expect(mockDb.passwordReset.findUnique).not.toHaveBeenCalled();
  });

  it("checks current password before changing it", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    expect(await changePassword(form())).toEqual({ error: "wrongPassword" });
    expect(mockDb.user.updateMany).not.toHaveBeenCalled();
  });

  it("changes only the signed-in user's password with an optimistic lock", async () => {
    expect(await changePassword(form())).toEqual({ success: true });
    expect(requireAuth).toHaveBeenCalled();
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", hashedPassword: "old-hash", sessionVersion: 0 },
      data: { hashedPassword: "new-hash", sessionVersion: { increment: 1 } },
    });
  });

  it("rejects a competing password change", async () => {
    mockDb.user.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await changePassword(form())).toEqual({ error: "wrongPassword" });
    expect(mockDb.passwordReset.updateMany).not.toHaveBeenCalled();
  });
});
