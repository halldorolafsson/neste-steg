"use client";

import { useI18n } from "@/components/i18n-provider";

export function PageTitle({ page }: { page: string }) {
  const { tv } = useI18n();
  return <h1 className="text-2xl font-bold text-foreground">{tv(page)}</h1>;
}

export function TranslatedText({
  path,
  vars,
  className,
  as: Component = "span",
}: {
  path: string;
  vars?: Record<string, string | number>;
  className?: string;
  as?: "span" | "p" | "h2" | "h3" | "div";
}) {
  const { tv } = useI18n();
  return <Component className={className}>{tv(path, vars)}</Component>;
}
