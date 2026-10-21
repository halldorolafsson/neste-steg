import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TaskForm } from "@/components/task-form";
import { PageTitle } from "@/components/translated";
import { resolveTaskFields } from "@/lib/task-form-fields";

export default async function NewTaskPage() {
  const session = await requireAuth();
  const preference = await db.taskFormPreference.findUnique({ where: { userId: session.user.id } });

  const [areas, assets, locations] = await Promise.all([
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
    db.asset.findMany({ where: { userId: session.user.id }, orderBy: { name: "asc" } }),
    db.location.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle page="tasks.new" />
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <TaskForm areas={areas} assets={assets} locations={locations} visibleFields={resolveTaskFields(preference?.visibleFields)} />
      </div>
    </div>
  );
}
