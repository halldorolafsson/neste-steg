"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateNavigationVisibility } from "@/app/actions/settings-actions";
import { useI18n } from "@/components/i18n-provider";
import type { NavigationKey } from "@/lib/navigation-config";

interface MenuItem {
  key: NavigationKey;
  isVisible: boolean;
}

export function NavigationManager({ items }: { items: MenuItem[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [visibility, setVisibility] = useState(
    Object.fromEntries(items.map((item) => [item.key, item.isVisible])) as Record<
      NavigationKey,
      boolean
    >
  );
  const [pendingKey, setPendingKey] = useState<NavigationKey | null>(null);
  const [error, setError] = useState("");

  async function handleChange(key: NavigationKey, isVisible: boolean) {
    const previous = visibility[key];
    setVisibility((current) => ({ ...current, [key]: isVisible }));
    setPendingKey(key);
    setError("");

    try {
      await updateNavigationVisibility(key, isVisible);
      router.refresh();
    } catch (caught) {
      setVisibility((current) => ({ ...current, [key]: previous }));
      setError(caught instanceof Error ? caught.message : t.settings.menuUpdateError);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="divide-y rounded-md border">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-3 py-2 text-sm"
          >
            <span>{t.nav[item.key]}</span>
            <input
              type="checkbox"
              checked={visibility[item.key]}
              disabled={pendingKey === item.key}
              onChange={(event) =>
                void handleChange(item.key, event.target.checked)
              }
              className="size-4 accent-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
