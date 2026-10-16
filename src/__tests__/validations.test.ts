import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
  createAssetSchema,
  inboxTaskSchema,
} from "@/lib/validations";

describe("createTaskSchema", () => {
  it("godtar gyldig oppgave med alle felt", () => {
    const result = createTaskSchema.safeParse({
      title: "Fiks garasjedøra",
      description: "Hengslet er løst",
      areaId: "area-hus",
      assetId: "asset-1",
      estimatedMinutes: 30,
      energyLevel: "HIGH",
      locationType: "HOME",
      priority: "HIGH",
      dueDate: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("godtar oppgave med kun påkrevde felt", () => {
    const result = createTaskSchema.safeParse({
      title: "Kjøp melk",
      areaId: "area-admin",
    });
    expect(result.success).toBe(true);
  });

  it("setter standardverdier for energi, sted og prioritet", () => {
    const result = createTaskSchema.parse({
      title: "Test",
      areaId: "area-1",
    });
    expect(result.energyLevel).toBe("MEDIUM");
    expect(result.locationType).toBe("ANYWHERE");
    expect(result.priority).toBe("MEDIUM");
  });

  it("feiler uten tittel", () => {
    const result = createTaskSchema.safeParse({
      areaId: "area-1",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med tom tittel", () => {
    const result = createTaskSchema.safeParse({
      title: "",
      areaId: "area-1",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med tittel over 200 tegn", () => {
    const result = createTaskSchema.safeParse({
      title: "a".repeat(201),
      areaId: "area-1",
    });
    expect(result.success).toBe(false);
  });

  it("feiler uten areaId", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med tom areaId", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med ugyldig energyLevel", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      energyLevel: "SUPER_HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med ugyldig format for locationType", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      locationType: "hjemme hos noen",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med ugyldig prioritet", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      priority: "URGENT",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med negativt estimatedMinutes", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      estimatedMinutes: -5,
    });
    expect(result.success).toBe(false);
  });

  it("feiler med 0 estimatedMinutes", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      estimatedMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("feiler med description over 2000 tegn", () => {
    const result = createTaskSchema.safeParse({
      title: "Test",
      areaId: "area-1",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("godtar alle gyldige energyLevel-verdier", () => {
    for (const level of ["LOW", "MEDIUM", "HIGH"]) {
      const result = createTaskSchema.safeParse({
        title: "Test",
        areaId: "area-1",
        energyLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it("godtar standardverdier og konfigurerbare locationType-verdier", () => {
    for (const loc of ["HOME", "WORK", "ANYWHERE", "KONTORET"]) {
      const result = createTaskSchema.safeParse({
        title: "Test",
        areaId: "area-1",
        locationType: loc,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("updateTaskSchema", () => {
  it("krever id", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("godtar bare id (alle andre felt er valgfrie)", () => {
    const result = updateTaskSchema.safeParse({ id: "task-1" });
    expect(result.success).toBe(true);
  });

  it("godtar status-felt", () => {
    const result = updateTaskSchema.safeParse({
      id: "task-1",
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("feiler med ugyldig status", () => {
    const result = updateTaskSchema.safeParse({
      id: "task-1",
      status: "DELETED",
    });
    expect(result.success).toBe(false);
  });

  it("godtar alle gyldige statusverdier", () => {
    for (const status of ["INBOX", "TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]) {
      const result = updateTaskSchema.safeParse({
        id: "task-1",
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("createAssetSchema", () => {
  it("godtar gyldig eiendel", () => {
    const result = createAssetSchema.safeParse({
      name: "Gressklipper",
      areaId: "area-hage",
    });
    expect(result.success).toBe(true);
  });

  it("feiler uten navn", () => {
    const result = createAssetSchema.safeParse({
      areaId: "area-hage",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med tomt navn", () => {
    const result = createAssetSchema.safeParse({
      name: "",
      areaId: "area-hage",
    });
    expect(result.success).toBe(false);
  });

  it("feiler med navn over 100 tegn", () => {
    const result = createAssetSchema.safeParse({
      name: "a".repeat(101),
      areaId: "area-1",
    });
    expect(result.success).toBe(false);
  });

  it("feiler uten areaId", () => {
    const result = createAssetSchema.safeParse({
      name: "Gressklipper",
    });
    expect(result.success).toBe(false);
  });
});

describe("inboxTaskSchema", () => {
  it("godtar tittel uten areaId", () => {
    const result = inboxTaskSchema.safeParse({
      title: "Husk å ringe tannlegen",
    });
    expect(result.success).toBe(true);
  });

  it("godtar tittel med areaId", () => {
    const result = inboxTaskSchema.safeParse({
      title: "Bestill time",
      areaId: "area-helse",
    });
    expect(result.success).toBe(true);
  });

  it("feiler uten tittel", () => {
    const result = inboxTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("feiler med tom tittel", () => {
    const result = inboxTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("feiler med tittel over 200 tegn", () => {
    const result = inboxTaskSchema.safeParse({
      title: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});
