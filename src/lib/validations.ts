import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd").max(200),
  description: z.string().max(2000).optional(),
  areaId: z.string().min(1, "Område er påkrevd"),
  assetId: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  energyLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  locationType: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/)
    .default("ANYWHERE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  recurrenceRule: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string(),
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  snoozedUntil: z.string().optional(),
});

export const createAssetSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd").max(100),
  areaId: z.string().min(1, "Område er påkrevd"),
});

export const inboxTaskSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd").max(200),
  areaId: z.string().optional(),
});
