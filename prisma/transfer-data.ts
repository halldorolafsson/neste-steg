import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";
import { Prisma, $Enums } from "@prisma/client";
import { Client, types } from "pg";

const tables = ["User", "Area", "Location", "NavigationSetting", "Asset", "Task", "FocusSession", "WeeklyReview"] as const;
type Table = typeof tables[number];
type Row = Record<string, unknown>;
type Snapshot = { version: 1; tables: Record<Table, Row[]> };
const relations: Partial<Record<Table, Record<string, Table>>> = {
  Asset: { areaId: "Area", userId: "User" },
  Task: { areaId: "Area", assetId: "Asset", userId: "User" },
  FocusSession: { userId: "User", taskId: "Task" },
  WeeklyReview: { userId: "User" },
};

function fieldsFor(table: Table) {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === table);
  if (!model) throw new Error(`Missing model: ${table}`);
  return model.fields.filter((field) => field.kind !== "object");
}

function normalize(table: Table, row: Row, sqlite = false): Row {
  const fields = fieldsFor(table);
  assert.deepEqual(Object.keys(row).sort(), fields.map((field) => field.name).sort());
  return Object.fromEntries(fields.map((field) => {
    let value = row[field.name];
    if (value === null) {
      if (field.isRequired) throw new Error(`Required field: ${table}.${field.name}`);
    } else if (field.type === "DateTime") {
      if (sqlite && typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
        value = value.replace(" ", "T") + "Z";
      }
      if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
        throw new Error(`Invalid date: ${table}.${field.name}`);
      }
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${table}.${field.name}`);
      value = date.toISOString();
    } else if (field.type === "Boolean") {
      if (sqlite && (value === 0 || value === 1)) value = value === 1;
      if (typeof value !== "boolean") throw new Error(`Invalid boolean: ${table}.${field.name}`);
    } else if (field.type === "Int") {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Invalid integer: ${table}.${field.name}`);
    } else {
      if (typeof value !== "string") throw new Error(`Invalid text: ${table}.${field.name}`);
      if (field.kind === "enum") {
        const enumeration = $Enums[field.type as keyof typeof $Enums];
        if (!enumeration || !Object.values(enumeration).some((entry) => entry === value)) throw new Error(`Invalid enum: ${table}.${field.name}`);
      }
    }
    return [field.name, value];
  }));
}

function checkRelations(snapshot: Snapshot) {
  for (const table of tables) {
    const key = table === "NavigationSetting" ? "key" : "id";
    const keys = snapshot.tables[table].map((row) => row[key]);
    if (new Set(keys).size !== keys.length) throw new Error(`Duplicate keys: ${table}`);
    for (const [from, parent] of Object.entries(relations[table] ?? {}) as [string, Table][]) {
      const parentKeys = new Set(snapshot.tables[parent].map((row) => row.id));
      if (snapshot.tables[table].some((row) => row[from] !== null && !parentKeys.has(row[from]))) {
        throw new Error(`Broken relation: ${table}.${from}`);
      }
    }
  }
}

function exportSnapshot(source: string): Snapshot {
  const database = new Database(source, { readonly: true, fileMustExist: true });
  try {
    database.exec("BEGIN");
    const violations = database.pragma("foreign_key_check");
    if (database.pragma("integrity_check", { simple: true }) !== "ok" || !Array.isArray(violations) || violations.length) {
      throw new Error("SQLite integrity check failed.");
    }
    const snapshot = { version: 1, tables: {} } as Snapshot;
    for (const table of tables) {
      snapshot.tables[table] = (database.prepare(`SELECT * FROM "${table}"`).all() as Row[]).map((row) => normalize(table, row, true));
      console.log(`${table}: exported=${snapshot.tables[table].length}`);
    }
    checkRelations(snapshot);
    return snapshot;
  } finally {
    database.close();
  }
}

function readSnapshot(input: string): Snapshot {
  const parsed = JSON.parse(readFileSync(input, "utf8")) as Snapshot;
  if (parsed.version !== 1 || !parsed.tables) throw new Error("Invalid export format.");
  assert.deepEqual(Object.keys(parsed.tables).sort(), [...tables].sort());
  for (const table of tables) {
    if (!Array.isArray(parsed.tables[table])) throw new Error(`Missing table: ${table}`);
    parsed.tables[table] = parsed.tables[table].map((row) => normalize(table, row));
  }
  checkRelations(parsed);
  return parsed;
}

async function importSnapshot(snapshot: Snapshot, commit: boolean) {
  const connectionString = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(connectionString)) throw new Error("PostgreSQL DATABASE_URL required.");
  types.setTypeParser(1114, (value) => new Date(value.replace(" ", "T") + "Z"));
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`LOCK TABLE ${tables.map((table) => `"${table}"`).join(", ")} IN EXCLUSIVE MODE`);
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::int AS total FROM "${table}"`);
      if (result.rows[0].total !== 0) throw new Error(`Target table is not empty: ${table}`);
    }
    for (const table of tables) {
      const fields = fieldsFor(table).map((field) => field.name);
      const sql = `INSERT INTO "${table}" (${fields.map((field) => `"${field}"`).join(", ")}) VALUES (${fields.map((_, index) => `$${index + 1}`).join(", ")})`;
      for (const row of snapshot.tables[table]) await client.query(sql, fields.map((field) => row[field]));
      const key = table === "NavigationSetting" ? "key" : "id";
      const result = await client.query(`SELECT * FROM "${table}" ORDER BY "${key}" COLLATE "C"`);
      const expected = [...snapshot.tables[table]].sort((first, second) => Buffer.compare(Buffer.from(first[key] as string), Buffer.from(second[key] as string)));
      assert.deepEqual(result.rows.map((row: Row) => normalize(table, row)), expected);
      console.log(`${table}: exported=${expected.length}, imported=${result.rows.length}, verified=all-fields`);
    }
    await client.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(commit ? "Import committed." : "Dry run passed; all writes rolled back.");
  } catch {
    await client.query("ROLLBACK");
    throw new Error("Import failed; transaction rolled back. Check schema, empty target and source data.");
  } finally {
    await client.end();
  }
}

async function main() {
  const { values, positionals } = parseArgs({ options: {
    source: { type: "string" }, output: { type: "string" }, input: { type: "string" },
    commit: { type: "boolean", default: false }, "dry-run": { type: "boolean", default: false },
  }, allowPositionals: true });
  if (positionals.length !== 1 || (values.commit && values["dry-run"])) throw new Error("Invalid arguments.");
  if (positionals[0] === "export" && values.source && values.output && !values.input && !values.commit) {
    const snapshot = exportSnapshot(values.source);
    writeFileSync(values.output, JSON.stringify(snapshot), { flag: "wx", mode: 0o600 });
    console.log("Export saved. Contains private data and password hashes; keep outside Git.");
  } else if (positionals[0] === "import" && values.input && !values.source && !values.output) {
    await importSnapshot(readSnapshot(values.input), values.commit);
  } else {
    throw new Error("Use export --source COPY.db --output PRIVATE.json, or import --input PRIVATE.json [--dry-run|--commit].");
  }
}

main().catch(() => {
  console.error("Data transfer failed. No record contents or credentials are logged. Check arguments, files, schema and database availability.");
  process.exitCode = 1;
});