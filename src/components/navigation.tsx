"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { clearTaskFilters } from "@/lib/task-filters";
import {
  navigationItems,
  type NavigationKey,
} from "@/lib/navigation-config";

interface NavigationProps {
  visibleKeys: NavigationKey[];
}

export function BottomNav({ visibleKeys }: NavigationProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const mobileItems = navigationItems.filter(
    (item) => item.mobile && visibleKeys.includes(item.key)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="flex items-center justify-around overflow-x-auto py-2">
        {mobileItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 px-2 py-2 text-xs",
                isActive
                  ? "text-blue-600 font-medium"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              {t.nav[item.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar({ visibleKeys }: NavigationProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r bg-gray-50">
      <div className="flex items-center h-14 px-4 border-b">
        <h1 className="text-lg font-bold text-gray-900">Neste steg</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigationItems
          .filter((item) => visibleKeys.includes(item.key))
          .map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
      </nav>
      <div className="px-2 py-4 border-t">
        <button
          onClick={() => { clearTaskFilters(); void signOut({ callbackUrl: "/login" }); }}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          {t.nav.logout}
        </button>
      </div>
    </aside>
  );
}
