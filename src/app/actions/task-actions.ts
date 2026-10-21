"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createTaskSchema, inboxTaskSchema } from "@/lib/validations";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
  const session = await requireAuth();

  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    areaId: formData.get("areaId") as string,
    assetId: (formData.get("assetId") as string) || undefined,
    estimatedMinutes: formData.get("estimatedMinutes")
      ? Number(formData.get("estimatedMinutes"))
      : undefined,
    energyLevel: (formData.get("energyLevel") as string) || "MEDIUM",
    locationType: (formData.get("locationType") as string) || "ANYWHERE",
    priority: (formData.get("priority") as string) || "MEDIUM",
    dueDate: (formData.get("dueDate") as string) || undefined,
  };

  const parsed = createTaskSchema.parse(raw);
  await requireLocation(parsed.locationType);

  await db.task.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      areaId: parsed.areaId,
      assetId: parsed.assetId || null,
      estimatedMinutes: parsed.estimatedMinutes,
      energyLevel: parsed.energyLevel,
      locationType: parsed.locationType,
      priority: parsed.priority,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      status: "TODO",
      userId: session.user.id,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function createInboxTask(formData: FormData) {
  const session = await requireAuth();

  const raw = {
    title: formData.get("title") as string,
    areaId: (formData.get("areaId") as string) || undefined,
  };

  const parsed = inboxTaskSchema.parse(raw);

  await db.task.create({
    data: {
      title: parsed.title,
      areaId: parsed.areaId || (await getDefaultAreaId()),
      status: "INBOX",
      userId: session.user.id,
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function updateTask(formData: FormData) {
  const session = await requireAuth();
  const id = formData.get("id") as string;

  const updates: Record<string, unknown> = {};
  const fields = [
    "title", "description", "areaId", "assetId",
    "energyLevel", "locationType", "priority", "status",
  ];

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null && (value !== "" || field === "description" || field === "assetId")) {
      updates[field] = value as string;
    }
  }

  if (formData.has("estimatedMinutes")) {
    updates.estimatedMinutes = formData.get("estimatedMinutes") ? Number(formData.get("estimatedMinutes")) : null;
  }

  if (formData.has("dueDate")) {
    updates.dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  }

  if (formData.get("clearDueDate")) {
    updates.dueDate = null;
  }

  if (updates.status === "DONE") {
    updates.completedAt = new Date();
  }

  if (updates.assetId === "") {
    updates.assetId = null;
  }

  if (typeof updates.locationType === "string") {
    await requireLocation(updates.locationType);
  }

  await db.task.update({
    where: { id, userId: session.user.id },
    data: updates,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
}

export async function completeTask(id: string) {
  const session = await requireAuth();

  await db.task.update({
    where: { id, userId: session.user.id },
    data: { status: "DONE", completedAt: new Date() },
  });

  revalidatePath("/tasks");
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function uncompleteTask(id: string) {
  const session = await requireAuth();

  await db.task.update({
    where: { id, userId: session.user.id },
    data: { status: "TODO", completedAt: null },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const session = await requireAuth();

  await db.task.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/tasks");
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function snoozeTask(id: string, until: string) {
  const session = await requireAuth();

  await db.task.update({
    where: { id, userId: session.user.id },
    data: {
      snoozedUntil: new Date(until),
      snoozeCount: { increment: 1 },
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function archiveTask(id: string) {
  const session = await requireAuth();

  await db.task.update({
    where: { id, userId: session.user.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function moveInboxTask(id: string, areaId: string) {
  const session = await requireAuth();

  await db.task.update({
    where: { id, userId: session.user.id },
    data: { areaId, status: "TODO" },
  });

  revalidatePath("/inbox");
  revalidatePath("/tasks");
  revalidatePath("/");
}

async function getDefaultAreaId(): Promise<string> {
  const area = await db.area.findFirst({ where: { slug: "admin" } });
  if (!area) throw new Error("Default area not found");
  return area.id;
}

async function requireLocation(slug: string) {
  const location = await db.location.findUnique({ where: { slug } });
  if (!location) throw new Error("Ugyldig sted.");
}

const importTaskSchema = z.array(
  z.object({
    title: z.string().min(1).max(200),
    area: z.string().min(1),
  })
);

export async function importTasksFromJson(json: string) {
  const session = await requireAuth();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Ugyldig JSON");
  }

  const tasks = importTaskSchema.parse(parsed);

  // Look up all areas by slug
  const areas = await db.area.findMany();
  const slugToId = new Map(areas.map((a) => [a.slug, a.id]));

  const errors: string[] = [];
  let created = 0;

  for (const task of tasks) {
    const areaId = slugToId.get(task.area);
    if (!areaId) {
      errors.push(`Ukjent område "${task.area}" for oppgave "${task.title}"`);
      continue;
    }

    await db.task.create({
      data: {
        title: task.title,
        areaId,
        status: "TODO",
        userId: session.user.id,
      },
    });
    created++;
  }

  revalidatePath("/tasks");
  revalidatePath("/");

  return { created, errors };
}
