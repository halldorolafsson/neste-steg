"use client";

import { useRouter } from "next/navigation";
import { deleteTask, archiveTask, snoozeTask, completeTask } from "@/app/actions/task-actions";
import { useI18n } from "@/components/i18n-provider";
import { addDays, format } from "date-fns";

interface TaskActionsProps {
  taskId: string;
  status: string;
}

export function TaskActions({ taskId, status }: TaskActionsProps) {
  const router = useRouter();
  const { t } = useI18n();

  async function handleDelete() {
    if (confirm("Slett denne oppgaven?")) {
      await deleteTask(taskId);
      router.push("/tasks");
    }
  }

  async function handleArchive() {
    await archiveTask(taskId);
    router.push("/tasks");
  }

  async function handleSnooze(days: number) {
    const until = format(addDays(new Date(), days), "yyyy-MM-dd");
    await snoozeTask(taskId, until);
  }

  async function handleComplete() {
    await completeTask(taskId);
    router.push("/tasks");
  }

  return (
    <div className="flex items-center gap-1">
      {status !== "DONE" && (
        <button
          onClick={handleComplete}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          {t.tasks.complete}
        </button>
      )}

      <div className="relative group">
        <button
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          {t.tasks.snooze}
        </button>
        <div className="absolute right-0 top-full z-10 mt-1 hidden w-32 rounded-md border bg-card shadow-md group-hover:block">
          <button
            onClick={() => handleSnooze(1)}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
          >
            1 dag
          </button>
          <button
            onClick={() => handleSnooze(3)}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
          >
            3 dager
          </button>
          <button
            onClick={() => handleSnooze(7)}
            className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
          >
            1 uke
          </button>
        </div>
      </div>

      <button
        onClick={handleArchive}
        className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
      >
        {t.tasks.archive}
      </button>

      <button
        onClick={handleDelete}
        className="rounded-md border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        {t.common.delete}
      </button>
    </div>
  );
}
