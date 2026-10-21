import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsClient } from "./settings-client";
import { resolveTaskFields } from "@/lib/task-form-fields";

export default async function SettingsPage() {
  const session = await requireAuth();
  const preference = await db.taskFormPreference.findUnique({ where: { userId: session.user.id } });

  const [areas, locations, locationCounts, navigationSettings, user] =
    await Promise.all([
      db.area.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          _count: {
            select: { tasks: true, assets: true },
          },
        },
      }),
      db.location.findMany({ orderBy: { sortOrder: "asc" } }),
      db.task.groupBy({
        by: ["locationType"],
        _count: true,
      }),
      db.navigationSetting.findMany(),
      db.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
      }),
    ]);

  const taskCountByLocation = new Map(
    locationCounts.map((entry) => [entry.locationType, entry._count])
  );

  const users = user?.isAdmin ? await db.user.findMany({
    select: { id: true, name: true, email: true, isAdmin: true }, orderBy: { email: "asc" },
  }) : [];
  const invitations = user?.isAdmin ? await db.userInvitation.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, expiresAt: true }, orderBy: { createdAt: "desc" },
  }) : [];

  return (
    <SettingsClient
      visibleTaskFields={resolveTaskFields(preference?.visibleFields)}
      areas={areas}
      locations={locations.map((location) => ({
        ...location,
        taskCount: taskCountByLocation.get(location.slug) ?? 0,
      }))}
      navigationSettings={navigationSettings}
      isAdmin={user?.isAdmin ?? false}
      users={users}
      invitations={invitations.map((invitation) => ({ ...invitation, expiresAt: invitation.expiresAt.toISOString() }))}
    />
  );
}
