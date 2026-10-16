"use client";

import { completeTask, uncompleteTask, deleteTask, moveInboxTask } from "@/app/actions/task-actions";
import { useI18n } from "@/components/i18n-provider";
import Link from "next/link";

interface Area {
  id: string;
  name: string;
}

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    energyLevel: string;
    estimatedMinutes: number | null;
    dueDate: Date | null;
    snoozeCount: number;
    area: { name: string };
  };
  mode?: "inbox" | "list";
  areas?: Area[];
}

const priorityColors: Record<string, string> = {
  HIGH: "text-red-600 bg-red-50 border-red-200",
  MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
  LOW: "text-green-600 bg-green-50 border-green-200",
};

export function TaskItem({ task, mode = "list", areas = [] }: TaskItemProps) {
  const { t, locale } = useI18n();
  const isDone = task.status === "DONE";

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
      <input
        type="checkbox"
        checked={isDone}
        onChange={() =>
          void (isDone ? uncompleteTask(task.id) : completeTask(task.id))
        }
        aria-label={isDone ? t.tasks.uncomplete : t.tasks.complete}
        className="mt-1 size-4 shrink-0 accent-primary"
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.id}`}
          className={`block text-sm font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {task.title}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">
            {task.area.name}
          </span>

          {task.priority !== "MEDIUM" && (
            <span className={`rounded-full border px-1.5 py-0.5 ${priorityColors[task.priority]}`}>
              {t.priority[task.priority as keyof typeof t.priority]}
            </span>
          )}

          {task.estimatedMinutes && (
            <span className="text-muted-foreground">
              {task.estimatedMinutes} {t.common.min}
            </span>
          )}

          <span className="text-muted-foreground">
            {t.tasks.energy}: {t.energy[task.energyLevel as keyof typeof t.energy]}
          </span>

          {task.dueDate && (
            <span className={`text-xs ${new Date(task.dueDate) < new Date() ? "font-medium text-red-600" : "text-muted-foreground"}`}>
              {new Date(task.dueDate).toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB")}
            </span>
          )}

          {task.snoozeCount > 0 && (
            <span className="text-orange-500">×{task.snoozeCount}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {mode === "inbox" && areas.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) moveInboxTask(task.id, e.target.value);
            }}
            defaultValue=""
            className="rounded border bg-background px-1.5 py-1 text-xs"
          >
            <option value="" disabled>{t.tasks.moveToArea}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => deleteTask(task.id)}
          className="text-xs text-destructive hover:underline"
        >
          {t.common.delete}
        </button>
      </div>
    </div>
  );
}
