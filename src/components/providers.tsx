"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/i18n-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>{children}</I18nProvider>
    </SessionProvider>
  );
}
