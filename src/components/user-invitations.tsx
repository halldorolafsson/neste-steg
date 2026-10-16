"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserInvitation, revokeUserInvitation } from "@/app/actions/auth-actions";
import { createPasswordReset } from "@/app/actions/password-actions";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export interface UserInvitationsProps {
  users: { id: string; name: string | null; email: string; isAdmin: boolean }[];
  invitations: { id: string; email: string; expiresAt: string }[];
}

export function UserInvitations({ users, invitations }: UserInvitationsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [resetExpires, setResetExpires] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCopied, setResetCopied] = useState(false);

  async function createReset(user: UserInvitationsProps["users"][number]) {
    setBusy(true); setError(""); setResetLink(""); setResetCopied(false);
    try {
      const result = await createPasswordReset(user.id);
      if (result.error) { setError(t.passwords[result.error]); return; }
      setResetLink(window.location.origin + result.path);
      setResetExpires(result.expiresAt); setResetEmail(user.email);
    } catch { setError(t.passwords.genericError); }
    finally { setBusy(false); }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setLink(""); setCopied(false);
    try {
      const result = await createUserInvitation(data);
      setLink(window.location.origin + result.path);
      router.refresh();
    } catch { setError(t.invitations.error); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setError("");
    try { await revokeUserInvitation(id); setLink(""); router.refresh(); }
    catch { setError(t.invitations.error); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-4 border-t pt-4">
      <h2 className="text-sm font-medium">{t.invitations.title}</h2>
      <ul className="divide-y">
        {users.map((user) => <li key={user.id} className="py-2 text-sm break-words">
          <span className="font-medium">{user.name || user.email}</span>
          <span className="block text-muted-foreground">{user.email} · {user.isAdmin ? t.invitations.admin : t.invitations.member}</span>
          <Button type="button" variant="outline" className="mt-2" disabled={busy} onClick={() => createReset(user)}>{t.passwords.createLink}</Button>
        </li>)}
      </ul>
      {resetLink && <div className="space-y-2">
        <p className="text-sm break-words">{resetEmail}</p>
        <p className="text-xs text-muted-foreground">{t.invitations.expires}: {new Date(resetExpires).toLocaleString()}</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label={t.passwords.resetLink} readOnly value={resetLink} className="min-w-0 flex-1" onFocus={(event) => event.target.select()} />
          <Button type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(resetLink); setResetCopied(true); }
            catch { setError(t.invitations.copyError); }
          }}>{resetCopied ? t.invitations.copied : t.invitations.copy}</Button>
        </div>
      </div>}
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-0 space-y-1 text-sm">
          <span>{t.register.email}</span>
          <Input name="email" type="email" maxLength={254} required disabled={busy} />
        </label>
        <Button type="submit" disabled={busy}>{t.invitations.create}</Button>
      </form>
      {link && <div className="flex flex-wrap gap-2">
        <Input aria-label={t.invitations.link} readOnly value={link} className="min-w-0 flex-1" onFocus={(event) => event.target.select()} />
        <Button type="button" variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setCopied(true); }
          catch { setError(t.invitations.copyError); }
        }}>{copied ? t.invitations.copied : t.invitations.copy}</Button>
      </div>}
      <ul className="divide-y">
        {invitations.map((invitation) => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <div className="min-w-0 break-all">{invitation.email}<span className="block text-xs text-muted-foreground">{t.invitations.expires}: {new Date(invitation.expiresAt).toLocaleString()}</span></div>
          <Button type="button" variant="outline" disabled={busy} onClick={() => revoke(invitation.id)}>{t.invitations.revoke}</Button>
        </li>)}
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
