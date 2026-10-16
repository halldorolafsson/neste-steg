import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PageTitle, TranslatedText } from "@/components/translated";

export default async function AreasPage() {
  const session = await requireAuth();

  const areas = await db.area.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              userId: session.user.id,
              status: { notIn: ["DONE", "ARCHIVED"] },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageTitle page="areas.title" />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {areas.map((area) => (
          <Link
            key={area.id}
            href={`/tasks?area=${area.slug}`}
            className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="font-medium text-foreground">{area.name}</h3>
            <p className="text-xs text-muted-foreground">
              {area._count.tasks} <TranslatedText path="common.activeTasks" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
