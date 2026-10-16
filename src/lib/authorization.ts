import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireAdmin() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    throw new Error("Du har ikke tilgang til denne innstillingen.");
  }

  return session;
}
