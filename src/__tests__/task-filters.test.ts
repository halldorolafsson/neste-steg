import { beforeEach, describe, expect, it } from "vitest";
import { TASK_FILTER_COOKIE, clearTaskFilters, parseTaskFilters, rememberTaskFilters, savedTaskQuery, taskOrder, taskParams, taskQuery, taskWhere } from "@/lib/task-filters";

describe("task filters", () => {
  beforeEach(() => clearTaskFilters());

  it("combines selections with OR within groups and AND between groups, scoped to the user", () => {
    const params = new URLSearchParams("status=TODO&status=IN_PROGRESS&priority=HIGH&priority=MEDIUM&area=hus&area=bil");
    expect(taskWhere("user-1", params)).toEqual({
      userId: "user-1", status: { in: ["TODO", "IN_PROGRESS"] },
      priority: { in: ["HIGH", "MEDIUM"] }, area: { slug: { in: ["hus", "bil"] } },
    });
  });

  it("preserves old single-value links", () => {
    expect(parseTaskFilters(taskParams({ status: "TODO", priority: ["HIGH", "LOW"] }))).toMatchObject({ status: ["TODO"], priority: ["HIGH", "LOW"] });
  });

  it("rejects unknown enum values, deduplicates and keeps archives excluded", () => {
    const params = new URLSearchParams("status=ARCHIVED&status=bad&priority=HIGH&priority=HIGH&priority=bad&sort=bad");
    expect(parseTaskFilters(params)).toMatchObject({ status: [], priority: ["HIGH"], sort: "priority" });
    expect(taskWhere("user-1", params).status).toEqual({ notIn: ["ARCHIVED", "INBOX"] });
  });

  it("allows selecting inbox explicitly", () => {
    expect(taskWhere("user-1", new URLSearchParams("status=INBOX")).status).toEqual({ in: ["INBOX"] });
  });

  it("has stable sorting for every mode", () => {
    for (const sort of ["priority", "newest", "oldest", "title"]) {
      expect(taskOrder(new URLSearchParams({ sort })).at(-1)).toEqual({ id: "asc" });
    }
    expect(taskOrder(new URLSearchParams("sort=oldest"))[0]).toEqual({ createdAt: "asc" });
    expect(taskOrder(new URLSearchParams("sort=title"))[0]).toEqual({ title: "asc" });
  });

  it("restores a filter cookie only for its owner and clears it at logout/login", () => {
    rememberTaskFilters("user-1", "status=TODO&priority=HIGH&sort=newest");
    const value = document.cookie.split(`${TASK_FILTER_COOKIE}=`)[1];
    expect(savedTaskQuery(value, "user-1")).toBe("filters=1&status=TODO&priority=HIGH&sort=newest");
    expect(savedTaskQuery(value, "user-2")).toBeNull();
    clearTaskFilters();
    expect(document.cookie).not.toContain(TASK_FILTER_COOKIE);
  });

  it("stores an explicit reset rather than restoring older filters", () => {
    rememberTaskFilters("user-1", "status=DONE");
    rememberTaskFilters("user-1", "");
    expect(savedTaskQuery(document.cookie.split(`${TASK_FILTER_COOKIE}=`)[1], "user-1")).toBe("filters=1");
    expect(taskWhere("user-1", new URLSearchParams())).toEqual({ userId: "user-1", status: { notIn: ["ARCHIVED", "INBOX"] } });
  });

  it("tolerates malformed and oversized cookies without trusting paths or extra parameters", () => {
    for (const value of [undefined, "%xx", "null", "{}", "x".repeat(4001)]) expect(savedTaskQuery(value, "u")).toBeNull();
    expect(savedTaskQuery(encodeURIComponent(JSON.stringify({ userId: "u", query: "next=https://evil.example&status=DONE" })), "u")).toBe("filters=1&status=DONE");
    expect(taskQuery(new URLSearchParams("extra=ignored&sort=title"))).toBe("filters=1&sort=title");
  });
});
