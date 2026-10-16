import { describe, it, expect } from "vitest";
import { scoreTask, getRecommendations } from "@/lib/recommendation-engine";
import type { Task } from "@prisma/client";
import type { UserContext } from "@/types";

// Helper to create a mock task with defaults
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test oppgave",
    description: null,
    areaId: "area-1",
    assetId: null,
    userId: "user-1",
    estimatedMinutes: null,
    energyLevel: "MEDIUM",
    locationType: "ANYWHERE",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: null,
    recurrenceRule: null,
    snoozedUntil: null,
    snoozeCount: 0,
    completedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const defaultContext: UserContext = {
  availableMinutes: 30,
  energyLevel: "MEDIUM",
  locationType: "HOME",
};

describe("scoreTask", () => {
  it("gir positiv score for oppgave som passer i tilgjengelig tid", () => {
    const task = createMockTask({ estimatedMinutes: 20 });
    const result = scoreTask(task, { ...defaultContext, availableMinutes: 30 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain("Passer i tilgjengelig tid");
  });

  it("gir negativ score for oppgave som tar mye lengre tid", () => {
    const task = createMockTask({ estimatedMinutes: 60 });
    const result = scoreTask(task, { ...defaultContext, availableMinutes: 20 });
    expect(result.reasons).toContain("Tar mye lengre tid enn tilgjengelig");
  });

  it("gir liten boost for ukjent varighet", () => {
    const task = createMockTask({ estimatedMinutes: null });
    const result = scoreTask(task, defaultContext);
    // Score should include the +5 for unknown duration
    expect(result.score).toBeGreaterThanOrEqual(5);
  });

  it("gir bonus for matchende energinivå", () => {
    const task = createMockTask({ energyLevel: "HIGH" });
    const result = scoreTask(task, { ...defaultContext, energyLevel: "HIGH" });
    expect(result.reasons).toContain("Matcher energinivå");
  });

  it("gir negativ score for mismatch på energi (HIGH vs LOW)", () => {
    const task = createMockTask({ energyLevel: "HIGH" });
    const result = scoreTask(task, { ...defaultContext, energyLevel: "LOW" });
    expect(result.reasons).toContain("Mismatch på energi");
  });

  it("gir bonus for matchende sted", () => {
    const task = createMockTask({ locationType: "HOME" });
    const result = scoreTask(task, { ...defaultContext, locationType: "HOME" });
    expect(result.reasons).toContain("Matcher sted");
  });

  it("ANYWHERE matcher alltid sted", () => {
    const task = createMockTask({ locationType: "ANYWHERE" });
    const result = scoreTask(task, { ...defaultContext, locationType: "WORK" });
    expect(result.reasons).toContain("Matcher sted");
  });

  it("gir negativ score for feil sted", () => {
    const task = createMockTask({ locationType: "CABIN" });
    const result = scoreTask(task, { ...defaultContext, locationType: "WORK" });
    expect(result.reasons).toContain("Feil sted for oppgaven");
  });

  it("gir høyest prioritetsscore for HIGH", () => {
    const highTask = createMockTask({ priority: "HIGH" });
    const medTask = createMockTask({ priority: "MEDIUM" });
    const lowTask = createMockTask({ priority: "LOW" });

    const highScore = scoreTask(highTask, defaultContext);
    const medScore = scoreTask(medTask, defaultContext);
    const lowScore = scoreTask(lowTask, defaultContext);

    expect(highScore.score).toBeGreaterThan(medScore.score);
    expect(medScore.score).toBeGreaterThanOrEqual(lowScore.score);
    expect(highScore.reasons).toContain("Høy prioritet");
  });

  it("gir bonus for frist i dag/i morgen", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const task = createMockTask({ dueDate: tomorrow });
    const result = scoreTask(task, defaultContext);
    expect(result.reasons).toContain("Frist i dag/i morgen");
  });

  it("gir bonus for frist innen 3 dager", () => {
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const task = createMockTask({ dueDate: inTwoDays });
    const result = scoreTask(task, defaultContext);
    expect(result.reasons).toContain("Frist snart");
  });

  it("gir bonus for oppgave som har ligget lenge (>14 dager)", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 20);
    const task = createMockTask({ createdAt: oldDate });
    const result = scoreTask(task, defaultContext);
    expect(result.reasons).toContain("Har ligget lenge");
  });

  it("gir bonus for mange snoozes", () => {
    const task = createMockTask({ snoozeCount: 3 });
    const result = scoreTask(task, defaultContext);
    expect(result.reasons).toContain("Utsatt flere ganger");
  });

  it("gir quick win bonus for korte oppgaver", () => {
    const task = createMockTask({ estimatedMinutes: 10 });
    const result = scoreTask(task, defaultContext);
    expect(result.reasons).toContain("Rask oppgave");
  });

  it("returnerer riktig taskId", () => {
    const task = createMockTask({ id: "my-task-id" });
    const result = scoreTask(task, defaultContext);
    expect(result.taskId).toBe("my-task-id");
  });
});

describe("getRecommendations", () => {
  it("returnerer top 3 oppgaver sortert etter score", () => {
    const tasks = [
      createMockTask({ id: "1", priority: "LOW", locationType: "CABIN" }),
      createMockTask({ id: "2", priority: "HIGH", locationType: "HOME" }),
      createMockTask({ id: "3", priority: "MEDIUM", locationType: "HOME" }),
      createMockTask({ id: "4", priority: "HIGH", locationType: "HOME", estimatedMinutes: 10 }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    expect(result.top3).toHaveLength(3);
    // Highest scoring tasks should come first
    expect(result.top3[0].score).toBeGreaterThanOrEqual(result.top3[1].score);
    expect(result.top3[1].score).toBeGreaterThanOrEqual(result.top3[2].score);
  });

  it("filtrerer bort DONE og ARCHIVED oppgaver", () => {
    const tasks = [
      createMockTask({ id: "1", status: "TODO" }),
      createMockTask({ id: "2", status: "DONE" }),
      createMockTask({ id: "3", status: "ARCHIVED" }),
      createMockTask({ id: "4", status: "IN_PROGRESS" }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    const taskIds = result.top3.map((s) => s.task.id);
    expect(taskIds).toContain("1");
    expect(taskIds).toContain("4");
    expect(taskIds).not.toContain("2");
    expect(taskIds).not.toContain("3");
  });

  it("filtrerer bort snoozede oppgaver med fremtidig dato", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);

    const tasks = [
      createMockTask({ id: "1", status: "TODO" }),
      createMockTask({ id: "2", status: "TODO", snoozedUntil: future }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    const taskIds = result.top3.map((s) => s.task.id);
    expect(taskIds).toContain("1");
    expect(taskIds).not.toContain("2");
  });

  it("inkluderer snoozede oppgaver med passert dato", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);

    const tasks = [
      createMockTask({ id: "1", status: "TODO", snoozedUntil: past }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    expect(result.top3).toHaveLength(1);
    expect(result.top3[0].task.id).toBe("1");
  });

  it("returnerer quickTasks for oppgaver ≤15 min", () => {
    const tasks = [
      createMockTask({ id: "1", estimatedMinutes: 10 }),
      createMockTask({ id: "2", estimatedMinutes: 5 }),
      createMockTask({ id: "3", estimatedMinutes: 60 }),
      createMockTask({ id: "4", estimatedMinutes: null }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    const quickIds = result.quickTasks.map((s) => s.task.id);
    expect(quickIds).toContain("1");
    expect(quickIds).toContain("2");
    expect(quickIds).not.toContain("3");
    expect(quickIds).not.toContain("4");
  });

  it("returnerer neglected for oppgaver eldre enn 14 dager", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const tasks = [
      createMockTask({ id: "old", createdAt: oldDate }),
      createMockTask({ id: "new" }),
    ];

    const result = getRecommendations(tasks, defaultContext);
    expect(result.neglected).toBeDefined();
    expect(result.neglected?.task.id).toBe("old");
  });

  it("returnerer undefined neglected når ingen oppgaver er gamle", () => {
    const tasks = [createMockTask({ id: "1" })];
    const result = getRecommendations(tasks, defaultContext);
    expect(result.neglected).toBeUndefined();
  });

  it("håndterer tom oppgaveliste", () => {
    const result = getRecommendations([], defaultContext);
    expect(result.top3).toHaveLength(0);
    expect(result.quickTasks).toHaveLength(0);
    expect(result.neglected).toBeUndefined();
  });

  it("bevarer ekstra felter via generisk type", () => {
    const tasks = [
      { ...createMockTask({ id: "1" }), area: { name: "Jobb" } },
    ];

    const result = getRecommendations(tasks, defaultContext);
    expect(result.top3[0].task.area).toEqual({ name: "Jobb" });
  });
});
