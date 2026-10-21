import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxForm } from "@/components/inbox-form";
import { TaskItem } from "@/components/task-item";
import { PageTitle, TranslatedText } from "@/components/translated";
import Link from "next/link";

export default async function InboxPage() {
  const session = await requireAuth();

  const [inboxTasks, areas] = await Promise.all([
    db.task.findMany({
      where: { userId: session.user.id, status: "INBOX" },
      include: { area: true },
      orderBy: { createdAt: "desc" },
    }),
    db.area.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle page="inbox.title" />
        <Link href="/tasks/new" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <TranslatedText path="tasks.new" />
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <InboxForm />
      </div>

      <div className="space-y-2">
        {inboxTasks.length === 0 ? (
          <div className="py-4 text-center">
            <TranslatedText path="inbox.empty" className="text-sm text-muted-foreground" as="p" />
            <TranslatedText path="inbox.emptyHint" className="text-xs text-muted-foreground" as="p" />
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {inboxTasks.length} <TranslatedText path="inbox.count" />
            </p>
            {inboxTasks.map((task) => (
              <TaskItem key={task.id} task={task} mode="inbox" areas={areas} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
