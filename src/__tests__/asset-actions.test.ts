import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "./mocks";

import { createAsset, deleteAsset } from "@/app/actions/asset-actions";

describe("asset-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAsset", () => {
    it("oppretter en eiendel med gyldige data", async () => {
      const form = new FormData();
      form.set("name", "Gressklipper");
      form.set("areaId", "area-hage");

      await createAsset(form);

      expect(mockDb.asset.create).toHaveBeenCalledWith({
        data: {
          name: "Gressklipper",
          areaId: "area-hage",
          userId: "user-1",
        },
      });
    });

    it("kaster feil med tomt navn", async () => {
      const form = new FormData();
      form.set("name", "");
      form.set("areaId", "area-hage");

      await expect(createAsset(form)).rejects.toThrow();
    });

    it("kaster feil uten areaId", async () => {
      const form = new FormData();
      form.set("name", "Gressklipper");

      await expect(createAsset(form)).rejects.toThrow();
    });
  });

  describe("deleteAsset", () => {
    it("sletter eiendel for riktig bruker", async () => {
      await deleteAsset("asset-1");

      expect(mockDb.asset.delete).toHaveBeenCalledWith({
        where: { id: "asset-1", userId: "user-1" },
      });
    });
  });
});
