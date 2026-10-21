"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const idSchema = z.string().min(1).max(100);
const noteSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100_000),
  taskIds: z.array(idSchema).max(500),
});

function refreshNotes() {
  revalidatePath("/notes", "layout");
  revalidatePath("/tasks", "layout");
}

export async function saveNote(formData: FormData) {
  const session = await requireAuth();
  const parsed = noteSchema.parse({
    id: formData.get("id") || undefined,
    title: formData.get("title"), content: formData.get("content") ?? "",
    taskIds: [...new Set(formData.getAll("taskIds"))],
  });
  const note = await db.$transaction(async (tx) => {
    if (parsed.taskIds.length) {
      const count = await tx.task.count({ where: { id: { in: parsed.taskIds }, userId: session.user.id } });
      if (count !== parsed.taskIds.length) throw new Error("Invalid task selection");
    }
    const data = { title: parsed.title, content: parsed.content };
    if (parsed.id) {
      return tx.note.update({
        where: { id: parsed.id, userId: session.user.id },
        data: { ...data, taskLinks: { deleteMany: {}, create: parsed.taskIds.map((taskId) => ({ taskId })) } },
        select: { id: true },
      });
    }
    return tx.note.create({
      data: { ...data, userId: session.user.id, taskLinks: { create: parsed.taskIds.map((taskId) => ({ taskId })) } },
      select: { id: true },
    });
  });
  refreshNotes();
  return note.id;
}

export async function deleteNote(id: string) {
  const session = await requireAuth();
  await db.note.delete({ where: { id: idSchema.parse(id), userId: session.user.id } });
  refreshNotes();
}

export async function setTaskNote(formData: FormData) {
  const session = await requireAuth();
  const taskId = idSchema.parse(formData.get("taskId"));
  const noteId = idSchema.parse(formData.get("noteId"));
  const remove = formData.get("remove") === "1";
  await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId, userId: session.user.id }, select: { id: true } });
    const note = await tx.note.findUnique({ where: { id: noteId, userId: session.user.id }, select: { id: true } });
    if (!task || !note) throw new Error("Not found");
    if (remove) {
      await tx.taskNote.deleteMany({ where: { taskId, noteId } });
    } else {
      await tx.taskNote.upsert({ where: { taskId_noteId: { taskId, noteId } }, create: { taskId, noteId }, update: {} });
    }
  });
  refreshNotes();
}
