import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TaskForm } from "@/components/task-form";
import { PageTitle } from "@/components/translated";

export default async function NewTaskPage() {
  await requireAuth();

  const [areas, assets, locations] = await Promise.all([
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
    db.asset.findMany({ orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle page="tasks.new" />
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <TaskForm areas={areas} assets={assets} locations={locations} />
      </div>
    </div>
  );
}
