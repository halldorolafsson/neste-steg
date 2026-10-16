import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TaskItem } from "@/components/task-item";
import { TaskFilters } from "@/components/task-filters";
import { PageTitle, TranslatedText } from "@/components/translated";
import Link from "next/link";
import { Prisma } from "@prisma/client";

interface Props {
  searchParams: Promise<{ status?: string; area?: string; priority?: string }>;
}

export default async function TasksPage({ searchParams }: Props) {
  const session = await requireAuth();
  const params = await searchParams;

  const where: Prisma.TaskWhereInput = {
    userId: session.user.id,
    status: { not: "ARCHIVED" },
  };

  if (params.status) {
    where.status = params.status as Prisma.EnumTaskStatusFilter;
  } else {
    where.status = { notIn: ["ARCHIVED", "INBOX"] };
  }

  if (params.priority) {
    where.priority = params.priority as Prisma.EnumPriorityFilter;
  }

  if (params.area) {
    where.area = { slug: params.area };
  }

  const [tasks, areas, counts] = await Promise.all([
    db.task.findMany({
      where,
      include: { area: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
    db.task.groupBy({
      by: ["status"],
      where: { userId: session.user.id, status: { not: "ARCHIVED" } },
      _count: true,
    }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <PageTitle page="tasks.title" />
          <p className="text-xs text-muted-foreground mt-1">
            {countMap.TODO || 0} todo · {countMap.IN_PROGRESS || 0} in progress · {countMap.DONE || 0} done
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <TranslatedText path="tasks.new" />
        </Link>
      </div>

      <TaskFilters areas={areas} />

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <TranslatedText path="tasks.noTasks" className="text-sm text-muted-foreground" as="p" />
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
