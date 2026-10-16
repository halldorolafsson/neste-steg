import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "@/lib/sliding-window-rate-limiter";

describe("SlidingWindowRateLimiter", () => {
  it("allows requests up to the configured limit", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);

    expect(limiter.check("user", 1_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.check("user", 2_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("blocks requests over the limit with a retry time", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.check("user", 1_000);
    limiter.check("user", 2_000);

    expect(limiter.check("user", 3_000)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 58,
      resetAt: 61_000,
    });
  });

  it("allows requests after the sliding window expires", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    limiter.check("user", 1_000);

    expect(limiter.check("user", 61_001).allowed).toBe(true);
  });

  it("isolates limits by key", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    limiter.check("first-user", 1_000);

    expect(limiter.check("first-user", 2_000).allowed).toBe(false);
    expect(limiter.check("second-user", 2_000).allowed).toBe(true);
  });
});
