import nb from "./nb.json";
import en from "./en.json";

export type Locale = "nb" | "en";
export type Translations = typeof nb;

const dictionaries: Record<Locale, Translations> = { nb, en };

export function getDictionary(locale: Locale): Translations {
  return dictionaries[locale] || dictionaries.nb;
}

export function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}
