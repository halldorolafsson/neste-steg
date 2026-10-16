"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const areaSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd").max(50),
  slug: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).default(0),
});

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createArea(formData: FormData) {
  await requireAuth();

  const name = formData.get("name") as string;
  const slug = slugify(name);
  const maxOrder = await db.area.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  const parsed = areaSchema.parse({ name, slug, sortOrder });

  await db.area.create({
    data: {
      name: parsed.name,
      slug: parsed.slug,
      sortOrder: parsed.sortOrder,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/areas");
}

export async function updateArea(formData: FormData) {
  await requireAuth();

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const sortOrder = Number(formData.get("sortOrder") || 0);

  await db.area.update({
    where: { id },
    data: { name, sortOrder },
  });

  revalidatePath("/settings");
  revalidatePath("/areas");
}

export async function deleteArea(id: string) {
  await requireAuth();

  const taskCount = await db.task.count({
    where: { areaId: id },
  });

  if (taskCount > 0) {
    throw new Error("Kan ikke slette område med oppgaver. Flytt oppgavene først.");
  }

  const assetCount = await db.asset.count({
    where: { areaId: id },
  });

  if (assetCount > 0) {
    throw new Error("Kan ikke slette område med eiendeler. Flytt eiendelene først.");
  }

  await db.area.delete({ where: { id } });

  revalidatePath("/settings");
  revalidatePath("/areas");
}
