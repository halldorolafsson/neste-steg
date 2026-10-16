import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "./mocks";

import {
  startFocusSession,
  completeFocusSession,
} from "@/app/actions/focus-actions";

describe("focus-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.focusSession.create.mockResolvedValue({ id: "session-abc" });
  });

  describe("startFocusSession", () => {
    it("oppretter en fokusøkt med varighet", async () => {
      const form = new FormData();
      form.set("durationMin", "25");

      const id = await startFocusSession(form);

      expect(id).toBe("session-abc");
      expect(mockDb.focusSession.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          taskId: null,
          durationMin: 25,
        },
      });
    });

    it("kobler oppgave til økten", async () => {
      const form = new FormData();
      form.set("durationMin", "10");
      form.set("taskId", "task-42");

      await startFocusSession(form);

      expect(mockDb.focusSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-42",
        }),
      });
    });

    it("setter taskId null når tom streng", async () => {
      const form = new FormData();
      form.set("durationMin", "25");
      form.set("taskId", "");

      await startFocusSession(form);

      expect(mockDb.focusSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: null,
        }),
      });
    });
  });

  describe("completeFocusSession", () => {
    it("fullfører økt med distraksjoner og notater", async () => {
      await completeFocusSession("session-1", 3, "Bra økt!");

      expect(mockDb.focusSession.update).toHaveBeenCalledWith({
        where: { id: "session-1", userId: "user-1" },
        data: {
          completedAt: expect.any(Date),
          distractions: 3,
          notes: "Bra økt!",
        },
      });
    });

    it("setter notes til null uten notater", async () => {
      await completeFocusSession("session-1", 0);

      expect(mockDb.focusSession.update).toHaveBeenCalledWith({
        where: { id: "session-1", userId: "user-1" },
        data: expect.objectContaining({
          notes: null,
        }),
      });
    });
  });
});
