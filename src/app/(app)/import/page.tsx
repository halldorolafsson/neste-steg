"use client";

import { useState } from "react";
import { importTasksFromJson } from "@/app/actions/task-actions";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const [json, setJson] = useState("");
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleImport() {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await importTasksFromJson(json);
      setResult(res);
      if (res.created > 0) {
        setTimeout(() => router.push("/tasks"), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importer oppgaver (JSON)</h1>

      <p className="text-sm text-muted-foreground">
        Lim inn en JSON-array med oppgaver. Hver oppgave må ha <code>title</code> og <code>area</code> (slug).
      </p>

      <div className="rounded-md border bg-muted/50 p-3">
        <p className="text-xs font-medium mb-1">Gyldige area-slugs:</p>
        <code className="text-xs">
          jobb, familie, hus, hage, hytte, bil, bat, hund, helse, sosialt, hobby, admin
        </code>
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={12}
        placeholder={`[\n  { "title": "Min oppgave", "area": "hus" },\n  { "title": "Annen oppgave", "area": "jobb" }\n]`}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        onClick={handleImport}
        disabled={loading || !json.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Importerer..." : "Importer"}
      </button>

      {result && (
        <div className="rounded-md border p-4 space-y-2">
          <p className="text-sm font-medium text-green-600">
            {result.created} oppgave(r) importert
          </p>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Feil:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
