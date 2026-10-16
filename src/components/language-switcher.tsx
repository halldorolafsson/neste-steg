"use client";

import { useI18n } from "@/components/i18n-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setLocale("nb")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          locale === "nb"
            ? "bg-primary text-primary-foreground"
            : "border bg-background hover:bg-accent"
        }`}
      >
        {t.settings.norwegian}
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "border bg-background hover:bg-accent"
        }`}
      >
        {t.settings.english}
      </button>
    </div>
  );
}
