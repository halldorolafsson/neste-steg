import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

const db = createClient();

const areas = [
  { name: "Jobb", slug: "jobb", sortOrder: 1 },
  { name: "Familie", slug: "familie", sortOrder: 2 },
  { name: "Hus", slug: "hus", sortOrder: 3 },
  { name: "Hage", slug: "hage", sortOrder: 4 },
  { name: "Hytte", slug: "hytte", sortOrder: 5 },
  { name: "Bil", slug: "bil", sortOrder: 6 },
  { name: "Båt", slug: "bat", sortOrder: 7 },
  { name: "Hund", slug: "hund", sortOrder: 8 },
  { name: "Helse/Trening", slug: "helse", sortOrder: 9 },
  { name: "Sosialt", slug: "sosialt", sortOrder: 10 },
  { name: "Hobby", slug: "hobby", sortOrder: 11 },
  { name: "Admin/ærend", slug: "admin", sortOrder: 12 },
];

const locations = [
  { name: "Hvor som helst", slug: "ANYWHERE", sortOrder: 0 },
  { name: "Hjemme", slug: "HOME", sortOrder: 1 },
  { name: "Jobb", slug: "WORK", sortOrder: 2 },
  { name: "Hytte", slug: "CABIN", sortOrder: 3 },
  { name: "Utendørs", slug: "OUTDOOR", sortOrder: 4 },
  { name: "Telefon", slug: "PHONE", sortOrder: 5 },
  { name: "Datamaskin", slug: "COMPUTER", sortOrder: 6 },
];

const navigationSettings = [
  { key: "dashboard", isVisible: true },
  { key: "inbox", isVisible: false },
  { key: "tasks", isVisible: true },
  { key: "areas", isVisible: true },
  { key: "assets", isVisible: true },
  { key: "focus", isVisible: true },
  { key: "weekly", isVisible: true },
  { key: "settings", isVisible: true },
];

async function seed() {
  console.log("Seeding areas...");

  for (const area of areas) {
    await db.area.upsert({
      where: { slug: area.slug },
      update: {},
      create: area,
    });
  }

  console.log("Seeding locations and navigation settings...");

  for (const location of locations) {
    await db.location.upsert({
      where: { slug: location.slug },
      update: {},
      create: location,
    });
  }

  for (const setting of navigationSettings) {
    await db.navigationSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("Seed complete.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
