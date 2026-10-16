import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "./mocks";
import { registerUser, createUserInvitation, revokeUserInvitation } from "@/app/actions/auth-actions";
import { requireAdmin } from "@/lib/authorization";

vi.mock("@/lib/authorization", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/auth-rate-limit", () => ({
  allowRegistration: vi.fn(() => true),
  allowInvitationCreation: vi.fn(() => true),
  hashToken: vi.fn(() => "token-hash"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password-123") } }));

function form() {
  const data = new FormData();
  data.set("name", "Ola");
  data.set("email", "ola@example.no");
  data.set("password", "long-passord123");
  data.set("token", "a".repeat(64));
  return data;
}

describe("invitation registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: "admin-1" } } as Awaited<ReturnType<typeof requireAdmin>>);
    mockDb.user.findFirst.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({ id: "new-user-id" });
    mockDb.userInvitation.findUnique.mockResolvedValue({ email: "ola@example.no", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    mockDb.userInvitation.updateMany.mockResolvedValue({ count: 1 });
    mockDb.$transaction.mockImplementation(async (callback) => callback(mockDb));
  });

  it("creates a regular user and consumes the invitation inside a transaction", async () => {
    expect(await registerUser(form())).toEqual({ success: true });
    expect(mockDb.$transaction).toHaveBeenCalled();
    expect(mockDb.user.create).toHaveBeenCalledWith({ data: { name: "Ola", email: "ola@example.no", hashedPassword: "hashed-password-123", isAdmin: false } });
  });

  it.each(["missing", "expired", "used", "wrong-email"])("rejects %s invitations", async (state) => {
    mockDb.userInvitation.findUnique.mockResolvedValue(state === "missing" ? null : { email: state === "wrong-email" ? "other@example.no" : "ola@example.no", usedAt: state === "used" ? new Date() : null, expiresAt: state === "expired" ? new Date(0) : new Date(Date.now() + 60_000) });
    await expect(registerUser(form())).rejects.toThrow();
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("rejects direct registration without a token", async () => {
    const data = form(); data.delete("token");
    await expect(registerUser(data)).rejects.toThrow();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a concurrently consumed invitation", async () => {
    mockDb.userInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(registerUser(form())).rejects.toThrow();
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it.each(["short", "å".repeat(37)])("rejects invalid new passwords", async (password) => {
    const data = form(); data.set("password", password);
    await expect(registerUser(data)).rejects.toThrow();
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("rejects an existing user", async () => {
    mockDb.user.findFirst.mockResolvedValue({ id: "existing" });
    await expect(registerUser(form())).rejects.toThrow();
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("only stores the token hash and returns a fragment link to admin", async () => {
    const result = await createUserInvitation(form());
    expect(requireAdmin).toHaveBeenCalled();
    expect(result.path).toMatch(/^\/register#token=[a-f0-9]{64}$/);
    expect(mockDb.userInvitation.create).toHaveBeenCalledWith({ data: { email: "ola@example.no", tokenHash: "token-hash", expiresAt: expect.any(Date) } });
  });

  it("rejects invitation creation and revocation by non-admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    await expect(createUserInvitation(form())).rejects.toThrow("Forbidden");
    await expect(revokeUserInvitation("invite-1")).rejects.toThrow("Forbidden");
    expect(mockDb.userInvitation.create).not.toHaveBeenCalled();
    expect(mockDb.userInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("revokes unused invitations", async () => {
    await revokeUserInvitation("invite-1");
    expect(mockDb.userInvitation.updateMany).toHaveBeenCalledWith({ where: { id: "invite-1", usedAt: null }, data: { expiresAt: new Date(0) } });
  });
});