export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Rate limit must be a positive integer.");
    }
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw new Error("Rate limit window must be positive.");
    }
  }

  check(key: string, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;
    const active = (this.attempts.get(key) || []).filter(
      (timestamp) => timestamp > windowStart
    );

    if (active.length >= this.limit) {
      const resetAt = active[0] + this.windowMs;
      this.attempts.set(key, active);
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        resetAt,
      };
    }

    active.push(now);
    this.attempts.set(key, active);
    this.pruneEmptyEntries(windowStart);

    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - active.length,
      retryAfterSeconds: 0,
      resetAt: active[0] + this.windowMs,
    };
  }

  private pruneEmptyEntries(windowStart: number) {
    if (this.attempts.size < 1000) return;

    for (const [key, timestamps] of this.attempts) {
      if (!timestamps.some((timestamp) => timestamp > windowStart)) {
        this.attempts.delete(key);
      }
    }
  }
}
