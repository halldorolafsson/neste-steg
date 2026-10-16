"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createAssetSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function createAsset(formData: FormData) {
  const session = await requireAuth();

  const parsed = createAssetSchema.parse({
    name: formData.get("name") as string,
    areaId: formData.get("areaId") as string,
  });

  await db.asset.create({
    data: {
      name: parsed.name,
      areaId: parsed.areaId,
      userId: session.user.id,
    },
  });

  revalidatePath("/assets");
}

export async function deleteAsset(id: string) {
  const session = await requireAuth();

  await db.asset.delete({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/assets");
}
