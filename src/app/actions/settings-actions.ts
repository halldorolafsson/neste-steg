"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization";
import { db } from "@/lib/db";
import { isNavigationKey } from "@/lib/navigation-config";

const locationSchema = z.object({
  name: z.string().trim().min(1, "Navn er påkrevd").max(50),
  sortOrder: z.number().int().min(0).max(999),
});

function locationSlug(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/Æ/g, "AE")
    .replace(/Ø/g, "O")
    .replace(/Å/g, "A")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function createLocation(formData: FormData) {
  await requireAdmin();

  const maxOrder = await db.location.aggregate({ _max: { sortOrder: true } });
  const parsed = locationSchema.parse({
    name: formData.get("name"),
    sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
  });
  const slug = locationSlug(parsed.name);

  if (!slug) throw new Error("Navnet må inneholde bokstaver eller tall.");

  await db.location.create({ data: { ...parsed, slug } });
  revalidateLocationPages();
}

export async function updateLocation(formData: FormData) {
  await requireAdmin();

  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = locationSchema.parse({
    name: formData.get("name"),
    sortOrder: Number(formData.get("sortOrder") || 0),
  });

  await db.location.update({ where: { id }, data: parsed });
  revalidateLocationPages();
}

export async function deleteLocation(id: string) {
  await requireAdmin();

  const location = await db.location.findUnique({ where: { id } });
  if (!location) return;
  if (location.slug === "ANYWHERE") {
    throw new Error("Hvor som helst kan ikke slettes.");
  }

  const taskCount = await db.task.count({
    where: { locationType: location.slug },
  });
  if (taskCount > 0) {
    throw new Error("Stedet er i bruk og kan ikke slettes.");
  }

  await db.location.delete({ where: { id } });
  revalidateLocationPages();
}

export async function updateNavigationVisibility(
  key: string,
  isVisible: boolean
) {
  await requireAdmin();
  if (!isNavigationKey(key)) throw new Error("Ukjent menyvalg.");

  await db.navigationSetting.upsert({
    where: { key },
    update: { isVisible },
    create: { key, isVisible },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

function revalidateLocationPages() {
  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/tasks/new");
  revalidatePath("/");
}
