// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds notes without altering tasks and cascades only links when either side is deleted", async () => {
  const db = new PGlite();
  try {
    const migrations = readdirSync("prisma/migrations").filter((name) => name !== "migration_lock.toml").sort();
    for (const migration of migrations.slice(0, -1)) await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    await db.exec(`INSERT INTO "User" (id,email,"hashedPassword","updatedAt") VALUES ('u','u@example.invalid','hash',NOW());
      INSERT INTO "Area" (id,name,slug) VALUES ('a','Boat','boat');
      INSERT INTO "Task" (id,title,"areaId","userId","updatedAt") VALUES ('t','Inspect engine','a','u',NOW());`);
    await db.exec(readFileSync(`prisma/migrations/${migrations.at(-1)}/migration.sql`, "utf8"));
    expect((await db.query(`SELECT title,"energyLevel","locationType" FROM "Task"`)).rows).toEqual([{ title: "Inspect engine", energyLevel: "MEDIUM", locationType: "ANYWHERE" }]);
    expect((await db.query(`SELECT "hashedPassword" FROM "User"`)).rows).toEqual([{ hashedPassword: "hash" }]);
    await db.exec(`INSERT INTO "Note" (id,"userId",title,content,"updatedAt") VALUES ('n','u','Spring','Observations',NOW());
      INSERT INTO "TaskNote" ("taskId","noteId") VALUES ('t','n');
      INSERT INTO "TaskFormPreference" ("userId","visibleFields") VALUES ('u','[]');`);
    await expect(db.exec(`INSERT INTO "TaskNote" ("taskId","noteId") VALUES ('t','n')`)).rejects.toThrow();
    await db.exec(`DELETE FROM "Task" WHERE id='t'`);
    expect((await db.query(`SELECT content FROM "Note"`)).rows).toEqual([{ content: "Observations" }]);
    expect((await db.query(`SELECT * FROM "TaskNote"`)).rows).toHaveLength(0);
    await db.exec(`INSERT INTO "Task" (id,title,"areaId","userId","updatedAt") VALUES ('t2','Inspect engine','a','u',NOW());
      INSERT INTO "TaskNote" ("taskId","noteId") VALUES ('t2','n');
      DELETE FROM "Note" WHERE id='n';`);
    expect((await db.query(`SELECT title FROM "Task"`)).rows).toEqual([{ title: "Inspect engine" }]);
    expect((await db.query(`SELECT * FROM "TaskNote"`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT "visibleFields" FROM "TaskFormPreference"`)).rows).toEqual([{ visibleFields: "[]" }]);
  } finally { await db.close(); }
}, 60000);
