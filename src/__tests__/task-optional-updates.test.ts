import { beforeEach, expect, it, vi } from "vitest";
import { mockDb } from "./mocks";
import { updateTask } from "@/app/actions/task-actions";

beforeEach(() => vi.clearAllMocks());

it("does not modify optional fields omitted by a client", async () => {
  const data = new FormData(); data.set("id", "t1"); data.set("title", "New title");
  await updateTask(data);
  expect(mockDb.task.update).toHaveBeenCalledWith({ where: { id: "t1", userId: "user-1" }, data: { title: "New title" } });
});

it("can explicitly clear optional values without silently keeping old values", async () => {
  const data = new FormData(); data.set("id", "t1");
  for (const field of ["description", "assetId", "estimatedMinutes", "dueDate"]) data.set(field, "");
  await updateTask(data);
  expect(mockDb.task.update).toHaveBeenCalledWith({ where: { id: "t1", userId: "user-1" }, data: { description: "", assetId: null, estimatedMinutes: null, dueDate: null } });
});
