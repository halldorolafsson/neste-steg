"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { parseTaskFilters, rememberTaskFilters, taskQuery, taskStatuses, taskPriorities, type TaskFilterKey } from "@/lib/task-filters";

interface Area {
  id: string;
  name: string;
  slug: string;
}

function closeFilterMenus(root: HTMLDivElement | null, restoreFocus = false) {
  root?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((menu) => {
    menu.open = false;
    if (restoreFocus) menu.querySelector("summary")?.focus();
  });
}

export function TaskFilters({ areas, userId }: { areas: Area[]; userId: string }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.toString();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useOptimistic(urlQuery);
  const filters = parseTaskFilters(new URLSearchParams(query));

  useEffect(() => {
    rememberTaskFilters(userId, urlQuery);
  }, [userId, urlQuery]);

  useEffect(() => {
    function closeOutside(event: Event) {
      if (!(event.target instanceof Node)) return;
      const target = event.target;
      root.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((menu) => {
        if (!menu.contains(target)) menu.open = false;
      });
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeFilterMenus(root.current, true);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function navigate(params: URLSearchParams) {
    closeFilterMenus(root.current, true);
    const next = taskQuery(params);
    rememberTaskFilters(userId, next);
    startTransition(() => {
      setQuery(next);
      router.push(`/tasks?${next}`, { scroll: false });
    });
  }

  function toggle(key: TaskFilterKey, value: string) {
    const params = new URLSearchParams(query);
    const selected: readonly string[] = filters[key];
    params.delete(key);
    for (const entry of selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]) {
      params.append(key, entry);
    }
    navigate(params);
  }

  const groups = [
    { key: "status" as const, label: t.tasks.status, all: t.tasks.allStatuses, options: taskStatuses.map((value) => ({ value, label: t.status[value] })) },
    { key: "area" as const, label: t.tasks.area, all: t.tasks.allAreas, options: areas.map((area) => ({ value: area.slug, label: area.name })) },
    { key: "priority" as const, label: t.tasks.priority, all: t.tasks.allPriorities, options: taskPriorities.map((value) => ({ value, label: t.priority[value] })) },
  ];

  return (
    <div ref={root} className="flex flex-wrap items-start gap-2" aria-busy={pending}>
      {groups.map((group) => (
        <details key={group.key} name="task-filter" className="relative w-full sm:w-44">
          <summary className="cursor-pointer rounded-md border bg-background px-3 py-2 text-xs break-words">
            {group.label}: {filters[group.key].length || group.all}
          </summary>
          <fieldset disabled={pending} className="absolute left-0 top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-md">
            <legend className="sr-only">{group.label}</legend>
            {group.options.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 p-2 text-sm break-words">
                <input type="checkbox" checked={filters[group.key].some((v) => v === option.value)} onChange={() => toggle(group.key, option.value)} className="size-4 shrink-0" />
                {option.label}
              </label>
            ))}
          </fieldset>
        </details>
      ))}
      <label className="flex max-w-full items-center gap-2 text-xs">
        {t.tasks.sort}
        <select disabled={pending} value={filters.sort} onChange={(event) => {
          const params = new URLSearchParams(query);
          params.set("sort", event.target.value);
          navigate(params);
        }} className="min-w-0 rounded-md border bg-background px-2 py-2 text-xs">
          <option value="priority">{t.tasks.priority}</option>
          <option value="newest">{t.tasks.newest}</option>
          <option value="oldest">{t.tasks.oldest}</option>
          <option value="title">{t.tasks.taskTitle}</option>
        </select>
      </label>
      <button type="button" disabled={pending} onClick={() => navigate(new URLSearchParams())} className="px-2 py-2 text-xs underline disabled:opacity-50">
        {t.tasks.resetFilters}
      </button>
    </div>
  );
}
