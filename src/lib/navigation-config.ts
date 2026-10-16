export const navigationItems = [
  { href: "/", key: "dashboard", defaultVisible: true, mobile: true },
  { href: "/inbox", key: "inbox", defaultVisible: false, mobile: true },
  { href: "/tasks", key: "tasks", defaultVisible: true, mobile: true },
  { href: "/areas", key: "areas", defaultVisible: true, mobile: false },
  { href: "/assets", key: "assets", defaultVisible: true, mobile: false },
  { href: "/focus", key: "focus", defaultVisible: true, mobile: true },
  { href: "/weekly", key: "weekly", defaultVisible: true, mobile: false },
  { href: "/settings", key: "settings", defaultVisible: true, mobile: true },
] as const;

export type NavigationKey = (typeof navigationItems)[number]["key"];

export interface StoredNavigationSetting {
  key: string;
  isVisible: boolean;
}

export function resolveNavigationVisibility(
  settings: StoredNavigationSetting[]
): Record<NavigationKey, boolean> {
  const stored = new Map(
    settings.map((setting) => [setting.key, setting.isVisible])
  );

  return Object.fromEntries(
    navigationItems.map((item) => [
      item.key,
      stored.get(item.key) ?? item.defaultVisible,
    ])
  ) as Record<NavigationKey, boolean>;
}

export function isNavigationKey(value: string): value is NavigationKey {
  return navigationItems.some((item) => item.key === value);
}
