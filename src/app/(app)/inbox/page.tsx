import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxForm } from "@/components/inbox-form";
import { TaskItem } from "@/components/task-item";
import { PageTitle, TranslatedText } from "@/components/translated";

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
      <PageTitle page="inbox.title" />

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
