"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">{t.passwords.forgotTitle}</h1>
      <p className="text-sm text-gray-700">{t.passwords.contactAdmin}</p>
      <Link href="/login" className="block text-sm text-blue-600 hover:underline">{t.register.login}</Link>
    </div>
  </div>;
}
