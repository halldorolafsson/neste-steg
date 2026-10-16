import { createHash } from "node:crypto";
import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter";

const loginGlobal = new SlidingWindowRateLimiter(100, 60_000);
const loginAccounts = new SlidingWindowRateLimiter(10, 15 * 60_000);
const registrations = new SlidingWindowRateLimiter(20, 15 * 60_000);
const invitationAttempts = new SlidingWindowRateLimiter(5, 15 * 60_000);
const adminInvitations = new SlidingWindowRateLimiter(20, 60_000);
const passwordAttempts = new SlidingWindowRateLimiter(10, 15 * 60_000);
const resetAttempts = new SlidingWindowRateLimiter(60, 60_000);

export function allowPasswordChange(userId: string) {
  return passwordAttempts.check(userId).allowed;
}

export function allowPasswordReset(token: string) {
  return resetAttempts.check("reset").allowed && passwordAttempts.check(hashToken(token)).allowed;
}

export function allowLogin(email: string) {
  return loginGlobal.check("login").allowed && loginAccounts.check(hashToken(email.trim().toLowerCase())).allowed;
}

export function allowRegistration(token: string) {
  return registrations.check("registration").allowed && invitationAttempts.check(hashToken(token)).allowed;
}

export function allowInvitationCreation(userId: string) {
  return adminInvitations.check(userId).allowed;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
