"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { optionalTaskFields } from "@/lib/task-form-fields";

export async function saveTaskFormPreference(formData: FormData) {
  const session = await requireAuth();
  const fields = z.array(z.enum(optionalTaskFields)).max(optionalTaskFields.length).parse(formData.getAll("fields"));
  const visibleFields = JSON.stringify([...new Set(fields)]);
  await db.taskFormPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, visibleFields },
    update: { visibleFields },
  });
  revalidatePath("/settings");
  revalidatePath("/tasks", "layout");
}
