"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { getInvitationEmail, registerUser } from "@/app/actions/auth-actions";
import { useI18n } from "@/components/i18n-provider";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    let active = true;
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    getInvitationEmail(candidate).then((invitedEmail) => {
      if (!active) return;
      setEmail(invitedEmail || "");
      setToken(invitedEmail ? candidate : "");
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.set("name", name);
      form.set("email", email);
      form.set("password", password);
      form.set("token", token);

      await registerUser(form);
      window.history.replaceState(null, "", "/register");

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t.register.autoLoginError);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t.register.genericError);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{t.register.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.register.subtitle}</p>
        </div>

        {!ready ? <p role="status">{t.common.loading}</p> : !token ? <p role="alert">{t.register.invitationRequired}</p> : <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              {t.register.name}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t.register.email}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly
              required
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t.register.password}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">{t.register.passwordHint}</p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t.register.submitting : t.register.submit}
          </button>
        </form>}

        <p className="text-center text-sm text-gray-500">
          {t.register.hasAccount}{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            {t.register.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
