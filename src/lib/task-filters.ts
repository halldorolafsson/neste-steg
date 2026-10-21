import type { Prisma } from "@prisma/client";

export const TASK_FILTER_COOKIE = "neste-steg-task-filters";
export const taskStatuses = ["TODO", "IN_PROGRESS", "DONE", "INBOX"] as const;
export const taskPriorities = ["HIGH", "MEDIUM", "LOW"] as const;
export const taskSorts = ["priority", "newest", "oldest", "title"] as const;
export type TaskFilterKey = "status" | "area" | "priority";
export type TaskSearchParams = Record<string, string | string[] | undefined>;

export function parseTaskFilters(params: URLSearchParams) {
  const values = (key: string) => [...new Set(params.getAll(key))];
  return {
    status: values("status").filter((v): v is typeof taskStatuses[number] => taskStatuses.includes(v as typeof taskStatuses[number])),
    priority: values("priority").filter((v): v is typeof taskPriorities[number] => taskPriorities.includes(v as typeof taskPriorities[number])),
    area: values("area").filter((v) => v.length > 0 && v.length <= 80).slice(0, 50),
    sort: taskSorts.find((v) => v === params.get("sort")) ?? "priority",
  };
}

export function taskParams(params: TaskSearchParams) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : value ? [value] : []) result.append(key, entry);
  }
  return result;
}

export function taskQuery(params: URLSearchParams) {
  const filters = parseTaskFilters(params);
  const result = new URLSearchParams({ filters: "1" });
  for (const key of ["status", "area", "priority"] as const) {
    for (const value of filters[key]) result.append(key, value);
  }
  if (filters.sort !== "priority") result.set("sort", filters.sort);
  return result.toString();
}

export function taskWhere(userId: string, params: URLSearchParams): Prisma.TaskWhereInput {
  const filters = parseTaskFilters(params);
  return {
    userId,
    status: filters.status.length ? { in: filters.status } : { notIn: ["ARCHIVED", "INBOX"] },
    ...(filters.priority.length ? { priority: { in: filters.priority } } : {}),
    ...(filters.area.length ? { area: { slug: { in: filters.area } } } : {}),
  };
}

export function taskOrder(params: URLSearchParams): Prisma.TaskOrderByWithRelationInput[] {
  switch (parseTaskFilters(params).sort) {
    case "newest": return [{ createdAt: "desc" }, { id: "asc" }];
    case "oldest": return [{ createdAt: "asc" }, { id: "asc" }];
    case "title": return [{ title: "asc" }, { id: "asc" }];
    default: return [{ priority: "desc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

export function savedTaskQuery(value: string | undefined, userId: string): string | null {
  if (!value || value.length > 4000) return null;
  try {
    const saved = JSON.parse(decodeURIComponent(value));
    if (saved.userId !== userId || typeof saved.query !== "string") return null;
    return taskQuery(new URLSearchParams(saved.query));
  } catch {
    return null;
  }
}

export function rememberTaskFilters(userId: string, query: string) {
  const value = encodeURIComponent(JSON.stringify({ userId, query: taskQuery(new URLSearchParams(query)) }));
  if (value.length > 3800) return;
  document.cookie = `${TASK_FILTER_COOKIE}=${value}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function clearTaskFilters() {
  document.cookie = `${TASK_FILTER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
