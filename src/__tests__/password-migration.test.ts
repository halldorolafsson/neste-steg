// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("preserves an existing account and enforces single-use reset claims in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync("prisma/migrations/20261006120000_init/migration.sql", "utf8"));
    await db.exec(readFileSync("prisma/migrations/20261006134000_user_invitations/migration.sql", "utf8"));
    await db.query('INSERT INTO "User" (id,email,"hashedPassword","updatedAt") VALUES ($1,$2,$3,NOW())', ["user-1", "test@example.invalid", "old-hash"]);
    await db.exec(readFileSync("prisma/migrations/20261009120000_password_recovery/migration.sql", "utf8"));
    expect((await db.query('SELECT "hashedPassword", "sessionVersion" FROM "User"')).rows).toEqual([{ hashedPassword: "old-hash", sessionVersion: 0 }]);
    await db.query('INSERT INTO "PasswordReset" (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,NOW() + INTERVAL \'30 minutes\')', ["reset-1", "user-1", "token-hash"]);
    const claim = 'UPDATE "PasswordReset" SET "usedAt"=NOW() WHERE id=$1 AND "usedAt" IS NULL AND "expiresAt">NOW() RETURNING id';
    expect((await db.query(claim, ["reset-1"])).rows).toHaveLength(1);
    expect((await db.query(claim, ["reset-1"])).rows).toHaveLength(0);
    await db.query('DELETE FROM "User" WHERE id=$1', ["user-1"]);
    expect((await db.query('SELECT id FROM "PasswordReset"')).rows).toHaveLength(0);
  } finally { await db.close(); }
}, 60_000);
