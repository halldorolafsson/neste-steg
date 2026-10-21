import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "./mocks";
import { requireAuth } from "@/lib/auth";
import { saveNote, deleteNote, setTaskNote } from "@/app/actions/note-actions";
import { saveTaskFormPreference } from "@/app/actions/task-form-actions";
import { defaultTaskFields, resolveTaskFields } from "@/lib/task-form-fields";

function form(id?: string, tasks: string[] = []) {
  const data = new FormData();
  data.set("title", " Spring boat "); data.set("content", "Yearly observations");
  if (id) data.set("id", id);
  tasks.forEach((task) => data.append("taskIds", task));
  return data;
}
function link(remove = false) {
  const data = new FormData(); data.set("taskId", "task-1"); data.set("noteId", "note-1");
  if (remove) data.set("remove", "1");
  return data;
}

describe("notes and personal task field preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn) => fn(mockDb));
    mockDb.note.create.mockResolvedValue({ id: "note-1" });
    mockDb.note.update.mockResolvedValue({ id: "note-1" });
    mockDb.note.findUnique.mockResolvedValue({ id: "note-1" });
    mockDb.task.findUnique.mockResolvedValue({ id: "task-1" });
    mockDb.task.count.mockResolvedValue(2);
  });

  it("creates standalone notes owned by the authenticated user", async () => {
    expect(await saveNote(form())).toBe("note-1");
    expect(mockDb.note.create).toHaveBeenCalledWith({ data: {
      title: "Spring boat", content: "Yearly observations", userId: "user-1", taskLinks: { create: [] },
    }, select: { id: true } });
  });

  it("links multiple tasks after verifying that every task belongs to the user", async () => {
    await saveNote(form(undefined, ["task-1", "task-2", "task-1"]));
    expect(mockDb.task.count).toHaveBeenCalledWith({ where: { id: { in: ["task-1", "task-2"] }, userId: "user-1" } });
    expect(mockDb.note.create.mock.calls[0][0].data.taskLinks.create).toEqual([{ taskId: "task-1" }, { taskId: "task-2" }]);
  });

  it("rejects foreign or deleted task selections without saving", async () => {
    mockDb.task.count.mockResolvedValueOnce(1);
    await expect(saveNote(form(undefined, ["task-1", "foreign"]))).rejects.toThrow();
    expect(mockDb.note.create).not.toHaveBeenCalled();
  });

  it("scopes edits and replacements of task links to the owner", async () => {
    await saveNote(form("note-1"));
    expect(mockDb.note.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "note-1", userId: "user-1" },
      data: { title: "Spring boat", content: "Yearly observations", taskLinks: { deleteMany: {}, create: [] } },
    }));
  });

  it("does not fall back to creation if an edit is unauthorized or missing", async () => {
    mockDb.note.update.mockRejectedValueOnce(new Error("Not found"));
    await expect(saveNote(form("foreign"))).rejects.toThrow();
    expect(mockDb.note.create).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(201)])("rejects invalid titles", async (title) => {
    const data = form(); data.set("title", title);
    await expect(saveNote(data)).rejects.toThrow();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("limits note size", async () => {
    const data = form(); data.set("content", "x".repeat(100001));
    await expect(saveNote(data)).rejects.toThrow();
  });

  it("deletes only the owned note, never the associated tasks", async () => {
    await deleteNote("note-1");
    expect(mockDb.note.delete).toHaveBeenCalledWith({ where: { id: "note-1", userId: "user-1" } });
    expect(mockDb.task.delete).not.toHaveBeenCalled();
  });

  it("checks both owners and uses idempotent linking", async () => {
    await setTaskNote(link());
    expect(mockDb.note.findUnique).toHaveBeenCalledWith({ where: { id: "note-1", userId: "user-1" }, select: { id: true } });
    expect(mockDb.task.findUnique).toHaveBeenCalledWith({ where: { id: "task-1", userId: "user-1" }, select: { id: true } });
    expect(mockDb.taskNote.upsert).toHaveBeenCalledWith({ where: { taskId_noteId: { taskId: "task-1", noteId: "note-1" } }, create: { taskId: "task-1", noteId: "note-1" }, update: {} });
  });

  it.each(["note", "task"] as const)("rejects linking or unlinking another user's %s", async (model) => {
    mockDb[model].findUnique.mockResolvedValueOnce(null);
    await expect(setTaskNote(link())).rejects.toThrow();
    expect(mockDb.taskNote.upsert).not.toHaveBeenCalled();
    expect(mockDb.taskNote.deleteMany).not.toHaveBeenCalled();
  });

  it("unlinks without deleting either object", async () => {
    await setTaskNote(link(true));
    expect(mockDb.taskNote.deleteMany).toHaveBeenCalledWith({ where: { taskId: "task-1", noteId: "note-1" } });
    expect(mockDb.note.delete).not.toHaveBeenCalled();
    expect(mockDb.task.delete).not.toHaveBeenCalled();
  });

  it("requires authentication for every mutation", async () => {
    for (const call of [() => saveNote(form()), () => deleteNote("n"), () => setTaskNote(link()), () => saveTaskFormPreference(new FormData())]) {
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(call()).rejects.toThrow("Unauthorized");
    }
    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(mockDb.note.delete).not.toHaveBeenCalled();
    expect(mockDb.taskFormPreference.upsert).not.toHaveBeenCalled();
  });

  it("saves per-user fields, including an intentionally empty selection", async () => {
    const data = new FormData(); data.set("userId", "foreign");
    await saveTaskFormPreference(data);
    expect(mockDb.taskFormPreference.upsert).toHaveBeenCalledWith({ where: { userId: "user-1" }, create: { userId: "user-1", visibleFields: "[]" }, update: { visibleFields: "[]" } });
  });

  it("rejects unknown or required fields in visibility settings", async () => {
    const data = new FormData(); data.set("fields", "title");
    await expect(saveTaskFormPreference(data)).rejects.toThrow();
    expect(mockDb.taskFormPreference.upsert).not.toHaveBeenCalled();
  });

  it("uses safe field defaults and ignores stale preference entries", () => {
    expect(resolveTaskFields(undefined)).toEqual(defaultTaskFields);
    expect(resolveTaskFields("bad")).toEqual(defaultTaskFields);
    expect(resolveTaskFields("[]")).toEqual([]);
    expect(resolveTaskFields('["priority","unknown","priority"]')).toEqual(["priority"]);
  });
});
