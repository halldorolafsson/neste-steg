"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import { getDictionary, getNestedValue, type Locale, type Translations } from "@/lib/i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  tv: (path: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);
const LOCALE_STORAGE_KEY = "neste-steg-locale";
const LOCALE_CHANGE_EVENT = "neste-steg-locale-change";

function getStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "nb";
}

function getServerLocale(): Locale {
  return "nb";
}

function subscribeToLocale(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCALE_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCALE_CHANGE_EVENT, callback);
  };
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getStoredLocale,
    getServerLocale
  );

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, l);
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  const t = getDictionary(locale);

  const tv = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      let str = getNestedValue(t as unknown as Record<string, unknown>, path);
      if (vars) {
        for (const [key, val] of Object.entries(vars)) {
          str = str.replace(`{${key}}`, String(val));
        }
      }
      return str;
    },
    [t]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tv }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
