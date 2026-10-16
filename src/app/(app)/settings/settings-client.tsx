"use client";

import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AreaManager } from "@/components/area-manager";
import { LocationManager } from "@/components/location-manager";
import { NavigationManager } from "@/components/navigation-manager";
import {
  navigationItems,
  resolveNavigationVisibility,
} from "@/lib/navigation-config";
import Link from "next/link";
import { UserInvitations, type UserInvitationsProps } from "@/components/user-invitations";
import { PasswordForm } from "@/components/password-form";

interface Area {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { tasks: number; assets: number };
}

interface Location {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  taskCount: number;
}

interface SettingsClientProps {
  areas: Area[];
  locations: Location[];
  navigationSettings: { key: string; isVisible: boolean }[];
  isAdmin: boolean;
  users: UserInvitationsProps["users"];
  invitations: UserInvitationsProps["invitations"];
}

export function SettingsClient({
  areas,
  locations,
  navigationSettings,
  isAdmin,
  users,
  invitations,
}: SettingsClientProps) {
  const { t } = useI18n();
  const visibility = resolveNavigationVisibility(navigationSettings);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t.settings.title}</h1>
      <section className="space-y-4 border-t pt-4">
        <h2 className="text-sm font-medium">{t.passwords.changeTitle}</h2>
        <PasswordForm />
      </section>

      {/* Language */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t.settings.language}</h2>
          <p className="text-xs text-muted-foreground">{t.settings.languageDescription}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Areas */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t.settings.areasSection}</h2>
          <p className="text-xs text-muted-foreground">{t.settings.areasDescription}</p>
        </div>
        <AreaManager areas={areas} />
      </div>

      {isAdmin && (
        <>
          <UserInvitations users={users} invitations={invitations} />
          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {t.settings.locationsSection}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.locationsDescription}
              </p>
            </div>
            <LocationManager locations={locations} />
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {t.settings.menuSection}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.menuDescription}
              </p>
            </div>
            <NavigationManager
              items={navigationItems.map((item) => ({
                key: item.key,
                isVisible: visibility[item.key],
              }))}
            />
          </div>
        </>
      )}

      {/* Import */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Importer oppgaver</h2>
          <p className="text-xs text-muted-foreground">Last inn oppgaver fra en JSON-fil</p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Gå til import
        </Link>
      </div>
    </div>
  );
}
