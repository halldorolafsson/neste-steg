import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { PageTitle, TranslatedText } from "@/components/translated";
import Link from "next/link";

export default async function WeeklyPage() {
  const session = await requireAuth();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [areas, completedThisWeek, allActive, focusSessions] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tasks: {
          where: { userId: session.user.id },
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    }),
    db.task.count({
      where: {
        userId: session.user.id,
        status: "DONE",
        completedAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    db.task.count({
      where: {
        userId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
    db.focusSession.findMany({
      where: {
        userId: session.user.id,
        completedAt: { gte: weekStart, lte: weekEnd },
      },
    }),
  ]);

  const focusMinutes = focusSessions.reduce((s, f) => s + f.durationMin, 0);

  // Analyse per area
  const areaStats = areas.map((area) => {
    const active = area.tasks.filter(
      (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
    ).length;
    const completedWeek = area.tasks.filter(
      (t) =>
        t.status === "DONE" &&
        t.completedAt &&
        t.completedAt >= weekStart &&
        t.completedAt <= weekEnd
    ).length;
    const oldest = area.tasks
      .filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const oldestDays = oldest ? differenceInDays(now, oldest.createdAt) : 0;

    return {
      name: area.name,
      slug: area.slug,
      active,
      completedWeek,
      oldestDays,
    };
  });

  const neglectedAreas = areaStats
    .filter((a) => a.active > 0 && a.completedWeek === 0)
    .sort((a, b) => b.oldestDays - a.oldestDays);

  const bigBacklog = areaStats
    .filter((a) => a.active >= 3)
    .sort((a, b) => b.active - a.active);

  const suggestedFocus = neglectedAreas.slice(0, 2);

  return (
    <div className="space-y-6">
      <PageTitle page="weekly.title" />

      {/* Week stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{completedThisWeek}</p>
          <TranslatedText path="weekly.completedThisWeek" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{allActive}</p>
          <TranslatedText path="weekly.activeTasks" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{focusMinutes}</p>
          <TranslatedText path="weekly.focusMinutes" className="text-xs text-muted-foreground" as="p" />
        </div>
      </div>

      {/* Tasks per area */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <TranslatedText path="weekly.tasksPerArea" className="text-sm font-medium text-muted-foreground mb-3" as="h2" />
        <div className="space-y-2">
          {areaStats.map((area) => (
            <Link
              key={area.slug}
              href={`/tasks?area=${area.slug}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent text-sm"
            >
              <span>{area.name}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{area.active} <TranslatedText path="weekly.active" /></span>
                {area.completedWeek > 0 && (
                  <span className="text-green-600">+{area.completedWeek} <TranslatedText path="common.completed" /></span>
                )}
                {area.active > 0 && area.completedWeek === 0 && (
                  <span className="text-orange-500"><TranslatedText path="weekly.noActivity" /></span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Backlog */}
      {bigBacklog.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <TranslatedText path="weekly.bigBacklog" className="text-sm font-medium text-orange-800 mb-2" as="h2" />
          <div className="space-y-1">
            {bigBacklog.map((area) => (
              <p key={area.slug} className="text-sm text-orange-700">
                {area.name}: {area.active} <TranslatedText path="weekly.activeTasksLabel" />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Neglected areas */}
      {neglectedAreas.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
          <TranslatedText path="weekly.neglectedAreas" className="text-sm font-medium text-red-800 mb-2" as="h2" />
          <div className="space-y-1">
            {neglectedAreas.map((area) => (
              <p key={area.slug} className="text-sm text-red-700">
                {area.name}: {area.active} <TranslatedText path="weekly.pending" />, <TranslatedText path="weekly.oldestDays" vars={{ days: area.oldestDays }} />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Suggested focus */}
      {suggestedFocus.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <TranslatedText path="weekly.suggestedFocus" className="text-sm font-medium text-blue-800 mb-2" as="h2" />
          <div className="space-y-1">
            {suggestedFocus.map((area) => (
              <Link
                key={area.slug}
                href={`/tasks?area=${area.slug}`}
                className="block text-sm text-blue-700 hover:underline"
              >
                {area.name} – <TranslatedText path="weekly.tackTasks" vars={{ count: area.active }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
