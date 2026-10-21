import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NoteForm } from "@/components/note-form";
import { PageTitle } from "@/components/translated";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const note = await db.note.findUnique({ where: { id, userId: session.user.id }, include: { taskLinks: { where: { task: { userId: session.user.id } }, select: { taskId: true } } } });
  if (!note) notFound();
  const tasks = await db.task.findMany({ where: { userId: session.user.id }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <div className="space-y-4">
      <PageTitle page="notes.edit" />
      <NoteForm key={note.id} note={note} tasks={tasks} selectedTaskIds={note.taskLinks.map((link) => link.taskId)} />
    </div>
  );
}
