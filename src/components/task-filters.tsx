"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

interface Area {
  id: string;
  name: string;
  slug: string;
}

export function TaskFilters({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const statusOptions = [
    { value: "", label: t.tasks.allStatuses },
    { value: "TODO", label: t.status.TODO },
    { value: "IN_PROGRESS", label: t.status.IN_PROGRESS },
    { value: "DONE", label: t.status.DONE },
    { value: "INBOX", label: t.status.INBOX },
  ];

  const priorityOptions = [
    { value: "", label: t.tasks.allPriorities },
    { value: "HIGH", label: t.priority.HIGH },
    { value: "MEDIUM", label: t.priority.MEDIUM },
    { value: "LOW", label: t.priority.LOW },
  ];

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/tasks?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={searchParams.get("status") || ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={searchParams.get("area") || ""}
        onChange={(e) => updateFilter("area", e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        <option value="">{t.tasks.allAreas}</option>
        {areas.map((a) => (
          <option key={a.id} value={a.slug}>{a.name}</option>
        ))}
      </select>

      <select
        value={searchParams.get("priority") || ""}
        onChange={(e) => updateFilter("priority", e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {priorityOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
