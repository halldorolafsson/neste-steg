import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { TaskActions } from "@/components/task-actions";
import { PageTitle } from "@/components/translated";

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
        />
      </div>
    </div>
  );
}
