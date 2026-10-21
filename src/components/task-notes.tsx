"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { setTaskNote } from "@/app/actions/note-actions";

export function TaskNotes({ taskId, notes }: { taskId: string; notes: { id: string; title: string; linked: boolean }[] }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const available = notes.filter((note) => !note.linked);
  async function save(data: FormData) {
    setState("saving");
    try { await setTaskNote(data); setState("idle"); }
    catch { setState("error"); }
  }
  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t.notes.title}</h2>
        <Link href={`/notes/new?taskId=${encodeURIComponent(taskId)}`} className="text-sm underline">{t.notes.new}</Link>
      </div>
      {notes.filter((note) => note.linked).map((note) => (
        <div key={note.id} className="flex items-start justify-between gap-3">
          <Link href={`/notes/${note.id}`} className="min-w-0 break-words text-sm text-primary underline">{note.title}</Link>
          <form action={save}>
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="remove" value="1" />
            <button disabled={state === "saving"} className="whitespace-nowrap text-xs text-muted-foreground underline disabled:opacity-50">{t.notes.unlink}</button>
          </form>
        </div>
      ))}
      {!notes.some((note) => note.linked) && <p className="text-sm text-muted-foreground">{t.notes.none}</p>}
      {available.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">{t.notes.linkNote}</summary>
          <form action={save} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="taskId" value={taskId} />
            <select key={available.map((note) => note.id).join(",")} name="noteId" required aria-label={t.notes.chooseNote} defaultValue="" disabled={state === "saving"} className="min-w-0 max-w-full rounded-md border bg-background px-2 py-2 text-sm">
              <option value="" disabled>{t.notes.chooseNote}</option>
              {available.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
            </select>
            <button disabled={state === "saving"} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">{t.notes.link}</button>
          </form>
        </details>
      )}
      {state === "error" && <p role="alert" className="text-sm text-destructive">{t.notes.error}</p>}
    </section>
  );
}
