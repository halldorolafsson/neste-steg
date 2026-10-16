import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FocusTimer } from "@/components/focus-timer";
import { PageTitle, TranslatedText } from "@/components/translated";
import { startOfDay, endOfDay, format } from "date-fns";
import { nb } from "date-fns/locale";

export default async function FocusPage() {
  const session = await requireAuth();
  const now = new Date();

  const [tasks, todaySessions, recentSessions] = await Promise.all([
    db.task.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      select: { id: true, title: true },
      orderBy: { priority: "desc" },
    }),
    db.focusSession.findMany({
      where: {
        userId: session.user.id,
        completedAt: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
    }),
    db.focusSession.findMany({
      where: {
        userId: session.user.id,
        completedAt: { not: null },
      },
      include: { task: { select: { title: true } } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMin, 0);
  const todayDistractions = todaySessions.reduce((sum, s) => sum + s.distractions, 0);

  return (
    <div className="space-y-6">
      <PageTitle page="focus.title" />

      {/* Today stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{todaySessions.length}</p>
          <TranslatedText path="focus.sessionsToday" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{todayMinutes}</p>
          <TranslatedText path="focus.minutesFocus" className="text-xs text-muted-foreground" as="p" />
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-foreground">{todayDistractions}</p>
          <TranslatedText path="focus.distractions" className="text-xs text-muted-foreground" as="p" />
        </div>
      </div>

      <FocusTimer tasks={tasks} />

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <TranslatedText path="focus.recentSessions" className="text-sm font-medium text-muted-foreground mb-2" as="h2" />
          <div className="space-y-1">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-foreground">
                    {s.task?.title || <TranslatedText path="focus.freeSession" />}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {s.durationMin} <TranslatedText path="common.min" />
                  </span>
                  {s.distractions > 0 && (
                    <span className="text-orange-500 ml-2">
                      {s.distractions} <TranslatedText path="focus.interruptions" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.completedAt
                    ? format(s.completedAt, "d. MMM HH:mm", { locale: nb })
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
