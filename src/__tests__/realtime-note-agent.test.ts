import { describe, expect, it } from "vitest";
import { toNoteDraft } from "@/components/realtime-note-agent";

const tasks = [{ id: "t1", title: "Boat engine" }, { id: "t2", title: "Hull" }];

describe("toNoteDraft", () => {
  it("links tasks by case-insensitive title and ignores unknown titles", () => {
    expect(toNoteDraft({ title: "Trip", content: "Pack", taskTitles: ["  boat ENGINE ", "Missing"] }, tasks)).toEqual({ title: "Trip", content: "Pack", taskIds: ["t1"] });
  });

  it("returns no linked tasks when the agent mentions none", () => {
    expect(toNoteDraft({ title: "Trip", content: "Pack", taskTitles: [] }, tasks).taskIds).toEqual([]);
  });
});
