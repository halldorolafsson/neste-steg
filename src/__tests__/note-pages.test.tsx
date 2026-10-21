import { beforeEach, describe, expect, it, vi } from "vitest";
import NotesPage from "@/app/(app)/notes/page";
import NotePage from "@/app/(app)/notes/[id]/page";
import NewNotePage from "@/app/(app)/notes/new/page";

const mocks = vi.hoisted(() => ({ notes: vi.fn(), note: vi.fn(), tasks: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/db", () => ({ db: { note: { findMany: mocks.notes, findUnique: mocks.note }, task: { findMany: mocks.tasks } } }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/note-form", () => ({ NoteForm: () => null }));
vi.mock("@/components/translated", () => ({ PageTitle: () => null, TranslatedText: () => null }));

beforeEach(() => {
  vi.resetAllMocks(); mocks.notes.mockResolvedValue([]); mocks.tasks.mockResolvedValue([]);
  mocks.notFound.mockImplementation(() => { throw new Error("404"); });
});

describe("private notes pages", () => {
  it("searches title and content only among the current user's notes", async () => {
    await NotesPage({ searchParams: Promise.resolve({ q: " boat " }) });
    expect(mocks.notes.mock.calls[0][0].where).toEqual({ userId: "u1", OR: [{ title: { contains: "boat", mode: "insensitive" } }, { content: { contains: "boat", mode: "insensitive" } }] });
  });
  it("tolerates repeated query parameters", async () => {
    await NotesPage({ searchParams: Promise.resolve({ q: ["a", "b"] }) });
    expect(mocks.notes.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });
  it("returns not found for missing or foreign notes without loading task choices", async () => {
    mocks.note.mockResolvedValue(null);
    await expect(NotePage({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow("404");
    expect(mocks.note.mock.calls[0][0].where).toEqual({ id: "foreign", userId: "u1" });
    expect(mocks.tasks).not.toHaveBeenCalled();
  });
  it("does not expose another user's task through the create-note URL", async () => {
    await expect(NewNotePage({ searchParams: Promise.resolve({ taskId: "foreign" }) })).rejects.toThrow("404");
    expect(mocks.tasks.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });
  it("preselects the task when creating a note from its page", async () => {
    mocks.tasks.mockResolvedValue([{ id: "t1", title: "Boat" }]);
    const page = await NewNotePage({ searchParams: Promise.resolve({ taskId: "t1" }) });
    expect(page.props.children[1].props.selectedTaskIds).toEqual(["t1"]);
  });
});
