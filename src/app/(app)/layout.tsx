import { Sidebar, BottomNav } from "@/components/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  navigationItems,
  resolveNavigationVisibility,
} from "@/lib/navigation-config";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const settings = await db.navigationSetting.findMany();
  const visibility = resolveNavigationVisibility(settings);
  const visibleKeys = navigationItems
    .filter((item) => visibility[item.key])
    .map((item) => item.key);

  return (
    <>
      <Sidebar visibleKeys={visibleKeys} />
      <main className="md:pl-60 pb-16 md:pb-0 min-h-full">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav visibleKeys={visibleKeys} />
    </>
  );
}
