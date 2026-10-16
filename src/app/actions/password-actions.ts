"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authorization";
import { allowInvitationCreation, allowPasswordChange, allowPasswordReset, hashToken } from "@/lib/auth-rate-limit";

const newPassword = z.string().min(12).refine((value) => Buffer.byteLength(value, "utf8") <= 72);
const passwordForm = z.object({ password: newPassword, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation);

export async function isPasswordResetValid(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !allowPasswordReset(token)) return false;
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  return Boolean(reset && !reset.usedAt && reset.expiresAt > new Date());
}

export async function createPasswordReset(userId: string) {
  const session = await requireAdmin();
  if (!allowInvitationCreation(session.user.id)) return { error: "rateLimited" } as const;
  if (!z.string().min(1).max(100).safeParse(userId).success) return { error: "genericError" } as const;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  // Lock the user row so concurrent requests leave only one active link.
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
    await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordReset.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  });
  return { path: `/reset-password#token=${token}`, expiresAt: expiresAt.toISOString() };
}

export async function resetPassword(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return { error: "invalidLink" } as const;
  if (!allowPasswordReset(token)) return { error: "rateLimited" } as const;
  const parsed = passwordForm.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { error: "invalidPassword" } as const;
  const tokenHash = hashToken(token);
  const reset = await db.passwordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return { error: "invalidLink" } as const;
  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  return db.$transaction(async (tx) => {
    // Serialize password changes and recovery on the same user before claiming the token.
    await tx.user.update({ where: { id: reset.userId }, data: { updatedAt: new Date() } });
    const claimed = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return { error: "invalidLink" } as const;
    await tx.user.update({ where: { id: reset.userId }, data: { hashedPassword, sessionVersion: { increment: 1 } } });
    await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
    return { success: true } as const;
  });
}

export async function changePassword(formData: FormData) {
  const session = await requireAuth();
  if (!allowPasswordChange(session.user.id)) return { error: "rateLimited" } as const;
  const parsed = passwordForm.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  const currentPassword = formData.get("currentPassword");
  if (!parsed.success) return { error: "invalidPassword" } as const;
  if (typeof currentPassword !== "string" || currentPassword.length > 1024) return { error: "wrongPassword" } as const;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.hashedPassword))) return { error: "wrongPassword" } as const;
  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  return db.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: user.id, hashedPassword: user.hashedPassword, sessionVersion: user.sessionVersion },
      data: { hashedPassword, sessionVersion: { increment: 1 } },
    });
    if (changed.count !== 1) return { error: "wrongPassword" } as const;
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    return { success: true } as const;
  });
}
