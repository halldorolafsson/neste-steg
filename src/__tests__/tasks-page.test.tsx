import { beforeEach, describe, expect, it, vi } from "vitest";
import TasksPage from "@/app/(app)/tasks/page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), cookie: vi.fn(), redirect: vi.fn(),
  tasks: vi.fn(), areas: vi.fn(), counts: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.auth }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => ({ db: {
  task: { findMany: mocks.tasks, groupBy: mocks.counts }, area: { findMany: mocks.areas },
} }));
vi.mock("@/components/task-item", () => ({ TaskItem: () => null }));
vi.mock("@/components/task-filters", () => ({ TaskFilters: () => null }));
vi.mock("@/components/translated", () => ({ PageTitle: () => null, TranslatedText: () => null }));

describe("tasks page remembered filters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.tasks.mockResolvedValue([]);
    mocks.areas.mockResolvedValue([]);
    mocks.counts.mockResolvedValue([]);
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
    mocks.cookie.mockReturnValue({ value: encodeURIComponent(JSON.stringify({ userId: "user-1", query: "status=TODO&status=IN_PROGRESS&priority=HIGH&sort=newest" })) });
  });

  it("restores the saved URL on returning to the list after editing", async () => {
    await expect(TasksPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/tasks?filters=1&status=TODO&status=IN_PROGRESS&priority=HIGH&sort=newest");
    expect(mocks.tasks).not.toHaveBeenCalled();
  });

  it("lets explicit URL filters override remembered selections", async () => {
    await TasksPage({ searchParams: Promise.resolve({ status: ["TODO", "IN_PROGRESS"], priority: ["HIGH", "MEDIUM"], area: ["hus", "bil"], sort: "oldest" }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.tasks).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", status: { in: ["TODO", "IN_PROGRESS"] }, priority: { in: ["HIGH", "MEDIUM"] }, area: { slug: { in: ["hus", "bil"] } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));
  });

  it("does not restore a remembered filter when resetting", async () => {
    await TasksPage({ searchParams: Promise.resolve({ filters: "1" }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.tasks.mock.calls[0][0].where).toEqual({ userId: "user-1", status: { notIn: ["ARCHIVED", "INBOX"] } });
  });

  it("does not restore another user's cookie", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-2" } });
    await TasksPage({ searchParams: Promise.resolve({}) });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.tasks.mock.calls[0][0].where.userId).toBe("user-2");
  });
});
