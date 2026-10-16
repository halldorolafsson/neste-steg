import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecommendations } from "@/lib/recommendation-engine";
import { ContextSelector } from "@/components/context-selector";
import { TaskItem } from "@/components/task-item";
import { PageTitle, TranslatedText } from "@/components/translated";
import { startOfDay, endOfDay, differenceInDays } from "date-fns";
import Link from "next/link";
import type { EnergyLevel } from "@/types";

interface Props {
  searchParams: Promise<{ minutes?: string; energy?: string; location?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await requireAuth();
  const params = await searchParams;

  const availableMinutes = Number(params.minutes) || 30;
  const energyLevel = (params.energy as EnergyLevel) || "MEDIUM";
  const now = new Date();

  const [allTasks, completedToday, inboxCount, locations] = await Promise.all([
    db.task.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      include: { area: true },
    }),
    db.task.count({
      where: {
        userId: session.user.id,
        status: "DONE",
        completedAt: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
    }),
    db.task.count({
      where: { userId: session.user.id, status: "INBOX" },
    }),
    db.location.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const defaultLocation =
    locations.find((location) => location.slug === "HOME") ||
    locations.find((location) => location.slug === "ANYWHERE") ||
    locations[0];
  const locationType = locations.some(
    (location) => location.slug === params.location
  )
    ? params.location!
    : defaultLocation?.slug || "ANYWHERE";

  const { top3, quickTasks, neglected } = getRecommendations(allTasks, {
    availableMinutes,
    energyLevel,
    locationType,
  });

  const dueSoon = allTasks
    .filter((t) => t.dueDate && differenceInDays(t.dueDate, now) <= 3 && differenceInDays(t.dueDate, now) >= 0)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageTitle page="dashboard.title" />
        {inboxCount > 0 && (
          <Link
            href="/inbox"
            className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700"
          >
            {inboxCount} <TranslatedText path="dashboard.inInbox" />
          </Link>
        )}
      </div>

      <ContextSelector
        currentMinutes={availableMinutes}
        currentEnergy={energyLevel}
        currentLocation={locationType}
        locations={locations}
      />

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{completedToday}</p>
          <TranslatedText path="dashboard.completedToday" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{allTasks.length}</p>
          <TranslatedText path="common.activeTasks" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{dueSoon.length}</p>
          <TranslatedText path="dashboard.dueSoonCount" className="text-xs text-muted-foreground" as="p" />
        </div>
      </div>

      {/* Top 3 anbefalinger */}
      <div>
        <TranslatedText path="dashboard.recommended" className="text-sm font-medium text-muted-foreground mb-2" as="h2" />
        {top3.length === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-center">
            <TranslatedText path="dashboard.noTasks" className="text-sm text-muted-foreground" as="p" />
            <Link href="/tasks/new" className="text-sm text-primary hover:underline mt-1 inline-block">
              <TranslatedText path="dashboard.createTask" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {top3.map(({ task, reasons, score }) => (
              <div key={task.id}>
                <TaskItem task={task} />
                <p className="text-[10px] text-muted-foreground ml-8 mt-0.5">
                  {reasons.slice(0, 3).join(" · ")} ({score}p)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raske oppgaver */}
      {quickTasks.length > 0 && (
        <div>
          <TranslatedText path="dashboard.quickTasks" className="text-sm font-medium text-muted-foreground mb-2" as="h2" />
          <div className="space-y-2">
            {quickTasks.slice(0, 3).map(({ task }) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Frist snart */}
      {dueSoon.length > 0 && (
        <div>
          <TranslatedText path="dashboard.dueSoon" className="text-sm font-medium text-muted-foreground mb-2" as="h2" />
          <div className="space-y-2">
            {dueSoon.slice(0, 3).map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Forsømt oppgave */}
      {neglected && (
        <div>
          <TranslatedText path="dashboard.neglected" className="text-sm font-medium text-muted-foreground mb-2" as="h2" />
          <TaskItem task={neglected.task} />
          <p className="text-[10px] text-muted-foreground ml-8 mt-0.5">
            <TranslatedText path="dashboard.createdDaysAgo" vars={{ days: differenceInDays(now, neglected.task.createdAt) }} />
          </p>
        </div>
      )}
    </div>
  );
}
