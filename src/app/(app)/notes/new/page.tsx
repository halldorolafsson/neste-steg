import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NoteForm } from "@/components/note-form";
import { PageTitle } from "@/components/translated";

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ taskId?: string | string[] }> }) {
  const session = await requireAuth();
  const params = await searchParams;
  const tasks = await db.task.findMany({ where: { userId: session.user.id }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  const taskId = typeof params.taskId === "string" ? params.taskId : undefined;
  if (taskId && !tasks.some((task) => task.id === taskId)) notFound();
  return (
    <div className="space-y-4">
      <PageTitle page="notes.new" />
      <NoteForm tasks={tasks} selectedTaskIds={taskId ? [taskId] : []} />
    </div>
  );
}
