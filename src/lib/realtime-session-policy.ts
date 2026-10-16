import { SlidingWindowRateLimiter } from "@/lib/sliding-window-rate-limiter";

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_SESSION_LIMIT_PER_MINUTE = 5;
const DEFAULT_MAX_SESSION_SECONDS = 300;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export const realtimeSessionLimitPerMinute = boundedInteger(
  process.env.OPENAI_REALTIME_SESSION_LIMIT_PER_MINUTE,
  DEFAULT_SESSION_LIMIT_PER_MINUTE,
  1,
  60
);

export const realtimeMaxSessionSeconds = boundedInteger(
  process.env.OPENAI_REALTIME_MAX_SESSION_SECONDS,
  DEFAULT_MAX_SESSION_SECONDS,
  60,
  3600
);

const globalForRateLimit = globalThis as typeof globalThis & {
  realtimeSessionRateLimiter?: SlidingWindowRateLimiter;
};

export const realtimeSessionRateLimiter =
  globalForRateLimit.realtimeSessionRateLimiter ||
  new SlidingWindowRateLimiter(
    realtimeSessionLimitPerMinute,
    RATE_LIMIT_WINDOW_MS
  );

globalForRateLimit.realtimeSessionRateLimiter = realtimeSessionRateLimiter;
