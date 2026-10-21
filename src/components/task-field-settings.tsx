"use client";

import { startTransition, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { optionalTaskFields, taskFieldLabels, type OptionalTaskField } from "@/lib/task-form-fields";
import { saveTaskFormPreference } from "@/app/actions/task-form-actions";

export function TaskFieldSettings({ visibleFields }: { visibleFields: OptionalTaskField[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(visibleFields);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-sm font-medium">{t.taskFields.title}</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setState("saving");
        startTransition(async () => {
          try { await saveTaskFormPreference(data); setState("saved"); }
          catch { setState("error"); }
        });
      }} onChange={() => setState("idle")} className="space-y-3">
        <fieldset disabled={state === "saving"} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{t.taskFields.title}</legend>
          {optionalTaskFields.map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="fields" value={field} checked={selected.includes(field)} onChange={(event) => setSelected(event.target.checked ? [...selected, field] : selected.filter((value) => value !== field))} className="size-4" />
              {t.tasks[taskFieldLabels[field]]}
            </label>
          ))}
        </fieldset>
        <button disabled={state === "saving"} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {state === "saving" ? t.taskFields.saving : t.common.save}
        </button>
        {state === "saved" && <p role="status" className="text-sm text-green-700">{t.taskFields.saved}</p>}
        {state === "error" && <p role="alert" className="text-sm text-destructive">{t.taskFields.error}</p>}
      </form>
    </section>
  );
}
