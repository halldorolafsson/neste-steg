"use client";

import { useActionState } from "react";
import { signOut } from "next-auth/react";
import { changePassword, resetPassword } from "@/app/actions/password-actions";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function PasswordForm({ token }: { token?: string }) {
  const { t } = useI18n();
  const [error, action, pending] = useActionState(async (_previous: string, form: FormData) => {
    try {
      if (token !== undefined) form.set("token", token);
      const result = token === undefined ? await changePassword(form) : await resetPassword(form);
      if (result.error) return t.passwords[result.error];
      if (token !== undefined) window.history.replaceState(null, "", "/reset-password");
      await signOut({ callbackUrl: "/login?passwordChanged=1" });
      return "";
    } catch { return t.passwords.genericError; }
  }, "");

  return <form action={action} className="space-y-4 max-w-sm">
    {token === undefined && <label className="block space-y-1 text-sm">
      <span>{t.passwords.currentPassword}</span>
      <Input name="currentPassword" type="password" autoComplete="current-password" required disabled={pending} />
    </label>}
    <label className="block space-y-1 text-sm">
      <span>{t.passwords.newPassword}</span>
      <Input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={pending} />
    </label>
    <label className="block space-y-1 text-sm">
      <span>{t.passwords.confirmation}</span>
      <Input name="confirmation" type="password" autoComplete="new-password" minLength={12} required disabled={pending} />
    </label>
    <p className="text-xs text-muted-foreground">{t.register.passwordHint}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={pending} type="submit">{pending ? t.passwords.saving : t.passwords.save}</Button>
  </form>;
}
