"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { saveNote, deleteNote } from "@/app/actions/note-actions";
import { useI18n } from "@/components/i18n-provider";

interface NoteFormProps {
  note?: { id: string; title: string; content: string };
  tasks: { id: string; title: string }[];
  selectedTaskIds?: string[];
}

export function NoteForm({ note, tasks, selectedTaskIds = [] }: NoteFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [id, setId] = useState(note?.id);
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [selected, setSelected] = useState(selectedTaskIds);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputClass = "mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      setState("saving");
      startTransition(async () => {
      try {
        const savedId = await saveNote(data);
        setId(savedId);
        setState("saved");
        router.replace(`/notes/${savedId}`);
        router.refresh();
      } catch { setState("error"); }
      });
    }} onChange={() => { if (state !== "saving") setState("idle"); }} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      {selected.map((taskId) => <input key={taskId} type="hidden" name="taskIds" value={taskId} />)}
      <fieldset disabled={state === "saving"} className="min-w-0 space-y-4">
        <div>
          <label htmlFor="note-title" className="text-sm font-medium">{t.notes.noteTitle}</label>
          <input id="note-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="note-content" className="text-sm font-medium">{t.notes.content}</label>
          <textarea id="note-content" name="content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={100000} rows={14} className={inputClass} />
        </div>
        {selected.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-sm font-medium">{t.notes.tasks}</h2>
            {tasks.filter((task) => selected.includes(task.id)).map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block break-words text-sm text-primary underline">{task.title}</Link>
            ))}
          </div>
        )}
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm">{t.notes.linkTasks} ({selected.length})</summary>
          <input type="search" aria-label={t.notes.searchTasks} placeholder={t.notes.searchTasks} value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
          <div className="max-h-64 overflow-y-auto">
            {tasks.filter((task) => task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((task) => (
              <label key={task.id} className="flex items-center gap-2 py-2 text-sm break-words">
                <input type="checkbox" checked={selected.includes(task.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, task.id] : selected.filter((value) => value !== task.id))} className="size-4 shrink-0" />
                {task.title}
              </label>
            ))}
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">{t.notes.noTasks}</p>}
          </div>
        </details>
      </fieldset>
      {state === "error" && <p role="alert" className="text-sm text-destructive">{t.notes.error}</p>}
      {state === "saved" && <p role="status" className="text-sm text-green-700">{t.notes.saved}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={state === "saving"} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{state === "saving" ? t.notes.saving : t.common.save}</button>
        <Link href="/notes" className="text-sm underline">{t.common.back}</Link>
        {id && <button type="button" disabled={state === "saving"} onClick={async () => {
          if (!window.confirm(t.notes.deleteConfirm)) return;
          setState("saving");
          try { await deleteNote(id); router.push("/notes"); router.refresh(); }
          catch { setState("error"); }
        }} className="ml-auto text-sm text-destructive underline disabled:opacity-50">{t.common.delete}</button>}
      </div>
    </form>
  );
}
