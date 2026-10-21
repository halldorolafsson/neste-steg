import { vi } from "vitest";

// Mock Prisma client
export const mockDb = {
  user: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "new-user-id" }),
  },
  task: {
    create: vi.fn().mockResolvedValue({ id: "new-task-id" }),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  area: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue({ id: "area-admin", slug: "admin" }),
  },
  location: {
    findUnique: vi.fn().mockResolvedValue({
      id: "location-anywhere",
      name: "Hvor som helst",
      slug: "ANYWHERE",
    }),
  },
  asset: {
    create: vi.fn().mockResolvedValue({ id: "new-asset-id" }),
    findMany: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue({}),
  },
  focusSession: {
    create: vi.fn().mockResolvedValue({ id: "new-session-id" }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
  userInvitation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  passwordReset: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  note: {
    create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
  },
  taskNote: { upsert: vi.fn(), deleteMany: vi.fn() },
  taskFormPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

// Auto-mock db module
vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

// Mock auth
export const mockSession = {
  user: { id: "user-1", email: "test@test.no", name: "Test" },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "user-1", email: "test@test.no", name: "Test" },
  }),
  getSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", email: "test@test.no", name: "Test" },
  }),
}));

// Mock Next.js cache revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
