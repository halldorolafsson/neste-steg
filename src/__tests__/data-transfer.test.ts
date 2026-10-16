import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { Prisma, $Enums } from "@prisma/client";

const directories: string[] = [];
const script = path.resolve("prisma/transfer-data.ts");
const cli = require.resolve("tsx/cli");

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "neste-transfer-"));
  directories.push(directory);
  const source = path.join(directory, "source.db");
  const output = path.join(directory, "export.json");
  const database = new Database(source);
  for (const model of Prisma.dmmf.datamodel.models) {
    const fields = model.fields.filter((field) => field.kind !== "object");
    database.exec(`CREATE TABLE "${model.name}" (${fields.map((field) => `"${field.name}" ${field.type === "DateTime" ? "DATETIME" : field.type === "Boolean" ? "BOOLEAN" : field.type === "Int" ? "INTEGER" : "TEXT"}`).join(", ")})`);
    const values = fields.map((field) => {
      if (field.name === "id" || field.name === "key") return `${model.name}-1`;
      const parents: Record<string, string> = { userId: "User", areaId: "Area", assetId: "Asset", taskId: "Task" };
      if (parents[field.name]) return `${parents[field.name]}-1`;
      if (field.type === "DateTime") return 1700000000123;
      if (field.type === "Boolean") return 1;
      if (field.type === "Int") return 2;
      if (field.kind === "enum") return Object.values($Enums[field.type as keyof typeof $Enums])[0];
      return field.name === "hashedPassword" ? "private-test-hash" : `value-${field.name}`;
    });
    database.prepare(`INSERT INTO "${model.name}" VALUES (${fields.map(() => "?").join(", ")})`).run(...values);
  }
  return { source, output, database };
}

describe("data transfer export", () => {
  it("preserves all eight models and normalizes dates and booleans without logging private fields", () => {
    const { source, output, database } = fixture();
    database.close();
    const before = readFileSync(source);
    const log = execFileSync(process.execPath, [cli, script, "export", "--source", source, "--output", output], { encoding: "utf8" });
    const snapshot = JSON.parse(readFileSync(output, "utf8"));
    expect(Object.keys(snapshot.tables)).toHaveLength(8);
    for (const rows of Object.values(snapshot.tables)) expect(rows).toHaveLength(1);
    expect(snapshot.tables.User[0].hashedPassword).toBe("private-test-hash");
    expect(snapshot.tables.User[0].isAdmin).toBe(true);
    expect(snapshot.tables.FocusSession[0].startedAt).toBe(new Date(1700000000123).toISOString());
    expect(snapshot.tables.WeeklyReview[0].weekStart).toBe(new Date(1700000000123).toISOString());
    expect(snapshot.tables.Task[0].userId).toBe("User-1");
    expect(readFileSync(source)).toEqual(before);
    expect(log).not.toContain("private-test-hash");
    const retry = spawnSync(process.execPath, [cli, script, "export", "--source", source, "--output", output]);
    expect(retry.status).toBe(1);
  });

  it.each(["relation", "enum", "boolean", "date"])("rejects invalid %s data without writing an export", (invalid) => {
    const { source, output, database } = fixture();
    if (invalid === "relation") database.exec('UPDATE "Task" SET "userId" = \'missing\'');
    if (invalid === "enum") database.exec('UPDATE "Task" SET "status" = \'INVALID\'');
    if (invalid === "boolean") database.exec('UPDATE "User" SET "isAdmin" = 2');
    if (invalid === "date") database.exec('UPDATE "FocusSession" SET "startedAt" = \'INVALID\'');
    database.close();
    const result = spawnSync(process.execPath, [cli, script, "export", "--source", source, "--output", output], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(() => readFileSync(output)).toThrow();
    expect(result.stderr).not.toContain("private-test-hash");
  });
});