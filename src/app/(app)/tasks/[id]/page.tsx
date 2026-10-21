import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { TaskActions } from "@/components/task-actions";
import { PageTitle } from "@/components/translated";
import { resolveTaskFields } from "@/lib/task-form-fields";
import { TaskNotes } from "@/components/task-notes";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: Props) {
  const session = await requireAuth();
  const { id } = await params;

  const [task, areas, assets, locations] = await Promise.all([
    db.task.findUnique({
      where: { id, userId: session.user.id },
      include: { area: true, asset: true },
    }),
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
    db.asset.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
    db.location.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!task) notFound();
  const preference = await db.taskFormPreference.findUnique({ where: { userId: session.user.id } });
  const notes = await db.note.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true, taskLinks: { where: { taskId: id }, select: { taskId: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle page="tasks.edit" />
        <TaskActions taskId={task.id} status={task.status} />
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <TaskForm
          areas={areas}
          assets={assets}
          locations={locations}
          task={task}
          visibleFields={resolveTaskFields(preference?.visibleFields)}
        />
      </div>
      <TaskNotes taskId={id} notes={notes.map((note) => ({ id: note.id, title: note.title, linked: note.taskLinks.length > 0 }))} />
    </div>
  );
}
