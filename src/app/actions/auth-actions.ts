"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/authorization";
import { allowInvitationCreation, allowRegistration, hashToken } from "@/lib/auth-rate-limit";
import { revalidatePath } from "next/cache";

const registerSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd").max(100),
  email: z.string().trim().email("Ugyldig e-postadresse").max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12, "Passordet må være minst 12 tegn").refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Passordet er for langt"),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function registerUser(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length > 64 || !allowRegistration(token)) {
    throw new Error("Registrering krever en gyldig invitasjon. Prøv igjen senere.");
  }
  const parsed = registerSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    token,
  });

  const tokenHash = hashToken(parsed.token);
  const invitation = await db.userInvitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.email !== parsed.email || invitation.usedAt || invitation.expiresAt <= new Date()) {
    throw new Error("Invitasjonen er ugyldig eller utløpt.");
  }
  const hashedPassword = await bcrypt.hash(parsed.password, 12);
  await db.$transaction(async (transaction) => {
    const claimed = await transaction.userInvitation.updateMany({
      where: { tokenHash, email: parsed.email, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("Invitasjonen er ugyldig eller utløpt.");
    const existing = await transaction.user.findFirst({ where: { email: { equals: parsed.email, mode: "insensitive" } } });
    if (existing) throw new Error("E-postadressen er allerede registrert");
    await transaction.user.create({ data: { name: parsed.name, email: parsed.email, hashedPassword, isAdmin: false } });
  });
  return { success: true };
}

export async function createUserInvitation(formData: FormData) {
  const session = await requireAdmin();
  if (!allowInvitationCreation(session.user.id)) throw new Error("For mange invitasjoner. Prøv igjen senere.");
  const email = registerSchema.shape.email.parse(formData.get("email"));
  const existing = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) throw new Error("E-postadressen er allerede registrert");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60_000);
  await db.userInvitation.create({ data: { email, tokenHash: hashToken(token), expiresAt } });
  revalidatePath("/settings");
  return { path: `/register#token=${token}`, expiresAt: expiresAt.toISOString() };
}

export async function revokeUserInvitation(id: string) {
  await requireAdmin();
  if (!z.string().min(1).max(100).safeParse(id).success) throw new Error("Ugyldig invitasjon.");
  await db.userInvitation.updateMany({ where: { id, usedAt: null }, data: { expiresAt: new Date(0) } });
  revalidatePath("/settings");
}

export async function getInvitationEmail(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !allowRegistration(token)) return null;
  const invitation = await db.userInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) return null;
  return invitation.email;
}
