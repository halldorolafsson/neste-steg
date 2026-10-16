import { createHmac } from "node:crypto";
import { getSession } from "@/lib/auth";
import {
  realtimeMaxSessionSeconds,
  realtimeSessionRateLimiter,
} from "@/lib/realtime-session-policy";

export const runtime = "nodejs";

const CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";
const REQUEST_TIMEOUT_MS = 15_000;

interface ClientSecretResponse {
  value?: unknown;
  expires_at?: unknown;
  error?: {
    message?: unknown;
  };
}

function getSafetyIdentifier(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET er ikke konfigurert.");

  return createHmac("sha256", secret).update(userId).digest("hex");
}

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: "Du må være logget inn." }, { status: 401 });
  }

  const rateLimit = realtimeSessionRateLimiter.check(session.user.id);
  const rateLimitHeaders = {
    "Cache-Control": "no-store",
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "For mange nye talesamtaler. Vent litt og prøv igjen." },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OpenAI Realtime er ikke konfigurert." },
      { status: 503, headers: rateLimitHeaders }
    );
  }

  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
  const voice = process.env.OPENAI_REALTIME_VOICE || "marin";

  try {
    const response = await fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": getSafetyIdentifier(session.user.id),
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          audio: {
            output: { voice },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const result = (await response
      .json()
      .catch(() => null)) as ClientSecretResponse | null;

    if (!response.ok || typeof result?.value !== "string") {
      const details = result?.error?.message;
      console.error(
        "Kunne ikke opprette Realtime-sesjon:",
        typeof details === "string" ? details : `HTTP ${response.status}`
      );
      return Response.json(
        { error: "Kunne ikke starte taleagenten." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    return Response.json(
      {
        value: result.value,
        expiresAt:
          typeof result.expires_at === "number" ? result.expires_at : undefined,
        model,
        voice,
        maxSessionSeconds: realtimeMaxSessionSeconds,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : "Ukjent feil";
    console.error("Realtime-sesjonen feilet:", details);
    return Response.json(
      { error: "Kunne ikke koble til taleagenten." },
      { status: 503, headers: rateLimitHeaders }
    );
  }
}
