"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PasswordForm } from "@/components/password-form";
import { isPasswordResetValid } from "@/app/actions/password-actions";
import { useI18n } from "@/components/i18n-provider";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const capturedToken = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    capturedToken.current ??= new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    const candidate = capturedToken.current;
    isPasswordResetValid(candidate).then((valid) => {
      if (active) setToken(valid ? candidate : "");
    }).catch(() => { if (active) setToken(""); });
    window.history.replaceState(null, "", "/reset-password");
    return () => { active = false; };
  }, []);
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">{t.passwords.resetTitle}</h1>
      {token === null ? <p role="status">{t.common.loading}</p> : token ? <PasswordForm token={token} /> : <p role="alert">{t.passwords.invalidLink}</p>}
      <Link href="/login" className="block text-sm text-blue-600 hover:underline">{t.register.login}</Link>
    </div>
  </div>;
}
