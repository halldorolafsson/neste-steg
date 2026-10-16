"use client";

import { useState } from "react";
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "@/app/actions/settings-actions";
import { useI18n } from "@/components/i18n-provider";

interface Location {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  taskCount: number;
}

export function LocationManager({ locations }: { locations: Location[] }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAdd(formData: FormData) {
    try {
      setError("");
      await createLocation(formData);
      setAdding(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t.settings.locationCreateError
      );
    }
  }

  async function handleUpdate(formData: FormData) {
    try {
      setError("");
      await updateLocation(formData);
      setEditingId(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t.settings.locationUpdateError
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      setError("");
      await deleteLocation(id);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t.settings.locationDeleteError
      );
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="divide-y rounded-md border">
        {locations.map((location) =>
          editingId === location.id ? (
            <form
              key={location.id}
              action={handleUpdate}
              className="grid gap-2 p-3 sm:grid-cols-[1fr_5rem_auto] sm:items-center"
            >
              <input type="hidden" name="id" value={location.id} />
              <input
                name="name"
                defaultValue={location.name}
                required
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={location.sortOrder}
                aria-label={t.settings.sortOrder}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  {t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div
              key={location.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{location.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {location.taskCount} {t.settings.tasksUsingLocation}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(location.id)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(location.id)}
                  disabled={
                    location.slug === "ANYWHERE" || location.taskCount > 0
                  }
                  className="text-sm text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t.common.delete}
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {adding ? (
        <form action={handleAdd} className="flex flex-wrap gap-2">
          <input
            name="name"
            required
            autoFocus
            placeholder={t.settings.locationName}
            className="min-w-48 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {t.common.create}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {t.common.cancel}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          {t.settings.addLocation}
        </button>
      )}
    </div>
  );
}
