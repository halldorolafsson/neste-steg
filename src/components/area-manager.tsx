"use client";

import { useState } from "react";
import { createArea, updateArea, deleteArea } from "@/app/actions/area-actions";
import { useI18n } from "@/components/i18n-provider";

interface Area {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { tasks: number; assets: number };
}

export function AreaManager({ areas }: { areas: Area[] }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAdd(formData: FormData) {
    try {
      setError("");
      await createArea(formData);
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feil ved opprettelse");
    }
  }

  async function handleUpdate(formData: FormData) {
    try {
      setError("");
      await updateArea(formData);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feil ved oppdatering");
    }
  }

  async function handleDelete(id: string) {
    try {
      setError("");
      await deleteArea(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feil ved sletting");
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1">
        {areas.map((area) => (
          <div key={area.id}>
            {editingId === area.id ? (
              <form action={handleUpdate} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                <input type="hidden" name="id" value={area.id} />
                <input
                  name="name"
                  defaultValue={area.name}
                  required
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                />
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={area.sortOrder}
                  className="w-16 rounded border bg-background px-2 py-1 text-sm"
                />
                <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
                  {t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  {t.common.cancel}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent text-sm">
                <span>
                  {area.name}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({area._count.tasks} {t.common.activeTasks}, {area._count.assets} {t.assets.title.toLowerCase()})
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingId(area.id)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t.common.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(area.id)}
                    className="text-sm text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={area._count.tasks > 0 || area._count.assets > 0}
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <form
          action={handleAdd}
          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
        >
          <input
            name="name"
            required
            placeholder={t.areas.areaName}
            className="flex-1 rounded border bg-background px-2 py-1 text-sm"
            autoFocus
          />
          <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
            {t.common.create}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-md border px-3 py-1 text-sm"
          >
            {t.common.cancel}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
        >
          {t.areas.addArea}
        </button>
      )}
    </div>
  );
}
