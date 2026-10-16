"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function startFocusSession(formData: FormData) {
  const session = await requireAuth();

  const durationMin = Number(formData.get("durationMin"));
  const taskId = (formData.get("taskId") as string) || null;

  const focusSession = await db.focusSession.create({
    data: {
      userId: session.user.id,
      taskId,
      durationMin,
    },
  });

  revalidatePath("/focus");
  return focusSession.id;
}

export async function completeFocusSession(
  id: string,
  distractions: number,
  notes?: string
) {
  const session = await requireAuth();

  await db.focusSession.update({
    where: { id, userId: session.user.id },
    data: {
      completedAt: new Date(),
      distractions,
      notes: notes || null,
    },
  });

  revalidatePath("/focus");
  revalidatePath("/");
}
