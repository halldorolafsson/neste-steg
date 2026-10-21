import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageTitle, TranslatedText } from "@/components/translated";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const session = await requireAuth();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const notes = await db.note.findMany({
    where: { userId: session.user.id, ...(query ? { OR: [ { title: { contains: query, mode: "insensitive" as const } }, { content: { contains: query, mode: "insensitive" as const } } ] } : {}) },
    select: { id: true, title: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle page="notes.title" />
        <Link href="/notes/new" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><TranslatedText path="notes.new" /></Link>
      </div>
      <form action="/notes" className="flex gap-2">
        <label className="min-w-0 flex-1">
          <TranslatedText path="notes.search" className="sr-only" />
          <input type="search" name="q" defaultValue={query} maxLength={200} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </label>
        <button className="rounded-md border px-3 py-2 text-sm"><TranslatedText path="notes.search" /></button>
      </form>
      <div className="divide-y">
        {notes.map((note) => (
          <Link key={note.id} href={`/notes/${note.id}`} className="block break-words py-3 text-sm font-medium text-primary hover:underline">{note.title}</Link>
        ))}
        {notes.length === 0 && <TranslatedText path="notes.empty" as="p" className="py-4 text-sm text-muted-foreground" />}
      </div>
    </div>
  );
}
