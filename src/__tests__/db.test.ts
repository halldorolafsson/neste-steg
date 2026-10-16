import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { adapterConstructor, clientConstructor, mockClient } = vi.hoisted(() => {
  const mockClient = {
    user: { findMany: vi.fn() },
    $disconnect: vi.fn(function (this: unknown) { return this; }),
  };
  return {
    mockClient,
    adapterConstructor: vi.fn(function () { return {}; }),
    clientConstructor: vi.fn(function () { return mockClient; }),
  };
});

vi.mock("@prisma/client", () => ({ PrismaClient: clientConstructor }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: adapterConstructor }));

const testGlobal = globalThis as unknown as { prisma?: unknown };
const originalClient = testGlobal.prisma;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete testGlobal.prisma;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalClient === undefined) delete testGlobal.prisma;
  else testGlobal.prisma = originalClient;
});

describe("lazy database client", () => {
  it("imports without database credentials but rejects first use", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const { db } = await import("@/lib/db");
    expect(clientConstructor).not.toHaveBeenCalled();
    expect(() => db.user).toThrow("DATABASE_URL must be a PostgreSQL connection URL.");
  });

  it("creates one client on first use and binds client methods", async () => {
    const { db } = await import("@/lib/db");
    expect(adapterConstructor).not.toHaveBeenCalled();
    expect(db.user).toBe(mockClient.user);
    expect(adapterConstructor).toHaveBeenCalledWith({ connectionString: "postgresql://test:test@localhost/test" });
    expect(db.$disconnect()).toBe(mockClient);
    expect(clientConstructor).toHaveBeenCalledTimes(1);
  });

  it("continues to reject SQLite URLs", async () => {
    vi.stubEnv("DATABASE_URL", "file:./dev.db");
    const { db } = await import("@/lib/db");
    expect(() => db.user).toThrow("DATABASE_URL must be a PostgreSQL connection URL.");
    expect(clientConstructor).not.toHaveBeenCalled();
  });

  it("reuses the development client across module reloads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const firstModule = await import("@/lib/db");
    expect(firstModule.db.user).toBe(mockClient.user);
    vi.resetModules();
    const secondModule = await import("@/lib/db");
    expect(secondModule.db.user).toBe(mockClient.user);
    expect(clientConstructor).toHaveBeenCalledTimes(1);
  });
});