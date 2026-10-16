import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "./mocks";

// Import actions after mocks are set up
import {
  createTask,
  createInboxTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  snoozeTask,
  archiveTask,
  moveInboxTask,
} from "@/app/actions/task-actions";

describe("task-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTask", () => {
    it("oppretter en oppgave med gyldige data", async () => {
      const form = new FormData();
      form.set("title", "Ny oppgave");
      form.set("areaId", "area-1");
      form.set("priority", "HIGH");
      form.set("energyLevel", "MEDIUM");
      form.set("locationType", "HOME");

      await createTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Ny oppgave",
          areaId: "area-1",
          priority: "HIGH",
          status: "TODO",
          userId: "user-1",
        }),
      });
    });

    it("setter standard energi/sted/prioritet hvis ikke angitt", async () => {
      const form = new FormData();
      form.set("title", "Enkel oppgave");
      form.set("areaId", "area-1");

      await createTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          energyLevel: "MEDIUM",
          locationType: "ANYWHERE",
          priority: "MEDIUM",
        }),
      });
    });

    it("parser dueDate til Date-objekt", async () => {
      const form = new FormData();
      form.set("title", "Med frist");
      form.set("areaId", "area-1");
      form.set("dueDate", "2026-06-15");

      await createTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dueDate: expect.any(Date),
        }),
      });
    });

    it("kaster feil for ugyldig input", async () => {
      const form = new FormData();
      // Mangler title og areaId
      await expect(createTask(form)).rejects.toThrow();
    });

    it("avviser et sted som ikke finnes", async () => {
      mockDb.location.findUnique.mockResolvedValueOnce(null);
      const form = new FormData();
      form.set("title", "Oppgave på ukjent sted");
      form.set("areaId", "area-1");
      form.set("locationType", "UKJENT");

      await expect(createTask(form)).rejects.toThrow("Ugyldig sted");
      expect(mockDb.task.create).not.toHaveBeenCalled();
    });

    it("parser estimatedMinutes til tall", async () => {
      const form = new FormData();
      form.set("title", "Tidsoppgave");
      form.set("areaId", "area-1");
      form.set("estimatedMinutes", "30");

      await createTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estimatedMinutes: 30,
        }),
      });
    });
  });

  describe("createInboxTask", () => {
    it("oppretter oppgave med status INBOX", async () => {
      const form = new FormData();
      form.set("title", "Innboks-oppgave");

      await createInboxTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Innboks-oppgave",
          status: "INBOX",
          userId: "user-1",
        }),
      });
    });

    it("bruker angitt areaId", async () => {
      const form = new FormData();
      form.set("title", "Med område");
      form.set("areaId", "area-helse");

      await createInboxTask(form);

      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          areaId: "area-helse",
        }),
      });
    });

    it("bruker default area når areaId mangler", async () => {
      const form = new FormData();
      form.set("title", "Uten område");

      await createInboxTask(form);

      expect(mockDb.area.findFirst).toHaveBeenCalledWith({
        where: { slug: "admin" },
      });
      expect(mockDb.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          areaId: "area-admin",
        }),
      });
    });
  });

  describe("completeTask", () => {
    it("setter status DONE og completedAt", async () => {
      await completeTask("task-1");

      expect(mockDb.task.update).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
        data: {
          status: "DONE",
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe("uncompleteTask", () => {
    it("setter status TODO og nullstiller completedAt", async () => {
      await uncompleteTask("task-1");

      expect(mockDb.task.update).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
        data: { status: "TODO", completedAt: null },
      });
    });
  });

  describe("deleteTask", () => {
    it("sletter oppgave for riktig bruker", async () => {
      await deleteTask("task-1");

      expect(mockDb.task.delete).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
      });
    });
  });

  describe("snoozeTask", () => {
    it("setter snoozedUntil og inkrementerer snoozeCount", async () => {
      await snoozeTask("task-1", "2026-06-01");

      expect(mockDb.task.update).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
        data: {
          snoozedUntil: expect.any(Date),
          snoozeCount: { increment: 1 },
        },
      });
    });
  });

  describe("archiveTask", () => {
    it("setter status ARCHIVED og archivedAt", async () => {
      await archiveTask("task-1");

      expect(mockDb.task.update).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
        data: {
          status: "ARCHIVED",
          archivedAt: expect.any(Date),
        },
      });
    });
  });

  describe("moveInboxTask", () => {
    it("setter areaId og endrer status til TODO", async () => {
      await moveInboxTask("task-1", "area-jobb");

      expect(mockDb.task.update).toHaveBeenCalledWith({
        where: { id: "task-1", userId: "user-1" },
        data: { areaId: "area-jobb", status: "TODO" },
      });
    });
  });
});
