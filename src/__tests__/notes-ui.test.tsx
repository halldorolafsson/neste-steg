import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteForm } from "@/components/note-form";
import { TaskForm } from "@/components/task-form";
import { TaskFieldSettings } from "@/components/task-field-settings";
import { I18nProvider } from "@/components/i18n-provider";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), preference: vi.fn(), push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/note-actions", () => ({ saveNote: mocks.save, deleteNote: mocks.remove }));
vi.mock("@/app/actions/task-actions", () => ({ createTask: mocks.createTask, updateTask: mocks.updateTask }));
vi.mock("@/app/actions/task-form-actions", () => ({ saveTaskFormPreference: mocks.preference }));
vi.mock("@/components/realtime-task-agent", () => ({ RealtimeTaskAgent: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh, back: vi.fn() }) }));

const tasks = [{ id: "t1", title: "Boat engine" }, { id: "t2", title: "Hull" }];
const note = { id: "n1", title: "Spring", content: "Oil checked" };
const areas = [{ id: "a", name: "Boat" }];
const locations = [{ slug: "HOME", name: "Home" }, { slug: "ANYWHERE", name: "Anywhere" }];
const existingTask = { id: "t1", title: "Engine", description: "Keep this", areaId: "a", assetId: "boat", energyLevel: "LOW", locationType: "HOME", priority: "HIGH", status: "IN_PROGRESS", estimatedMinutes: 45, dueDate: new Date("2027-04-01T00:00:00Z") };
const wrap = (element: ReactElement) => render(<I18nProvider>{element}</I18nProvider>);

beforeEach(() => { vi.clearAllMocks(); localStorage.setItem("neste-steg-locale", "en"); mocks.save.mockResolvedValue("n1"); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe("simple notes", () => {
  it("creates a standalone note using just title and content", async () => {
    wrap(<NoteForm tasks={tasks} />);
    expect(screen.getByLabelText("Boat engine")).not.toBeVisible();
    await userEvent.type(screen.getByLabelText("Title"), "Trip list");
    await userEvent.type(screen.getByLabelText("Content"), "Snowboard and boots");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const data = mocks.save.mock.calls[0][0] as FormData;
    expect(data.get("title")).toBe("Trip list");
    expect(data.get("content")).toBe("Snowboard and boots");
    expect(data.getAll("taskIds")).toEqual([]);
    expect(mocks.replace).toHaveBeenCalledWith("/notes/n1");
  });

  it("preserves task selections when the task search hides their checkboxes", async () => {
    wrap(<NoteForm note={note} tasks={tasks} selectedTaskIds={["t1"]} />);
    await userEvent.click(screen.getByText("Link tasks (1)"));
    await userEvent.type(screen.getByRole("searchbox"), "Hull");
    await userEvent.click(screen.getByLabelText("Hull"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect((mocks.save.mock.calls[0][0] as FormData).getAll("taskIds")).toEqual(["t1", "t2"]);
    expect(screen.getByRole("link", { name: "Boat engine" })).toHaveAttribute("href", "/tasks/t1");
  });

  it("keeps unsaved note text when saving fails", async () => {
    mocks.save.mockRejectedValueOnce(new Error("offline"));
    wrap(<NoteForm note={note} tasks={tasks} />);
    await userEvent.type(screen.getByLabelText("Content"), ", belt replaced");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Content")).toHaveValue("Oil checked, belt replaced");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("asks before deleting and cancels without mutation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<NoteForm note={note} tasks={tasks} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe("personal task field visibility", () => {
  it("keeps only the common fields visible initially and reveals the rest with one click", async () => {
    wrap(<TaskForm areas={areas} locations={locations} assets={[{ id: "boat", name: "Boat" }]} />);
    expect(screen.getByLabelText("Energy level")).not.toBeVisible();
    expect(screen.getByLabelText("Location")).not.toBeVisible();
    expect(screen.getByLabelText("Priority")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "More fields" }));
    expect(screen.getByLabelText("Energy level")).toBeVisible();
    expect(screen.getByLabelText("Asset")).toBeVisible();
  });

  it("retains all hidden existing values in the edit submission", async () => {
    wrap(<TaskForm task={existingTask} visibleFields={[]} areas={areas} locations={locations} assets={[{ id: "boat", name: "Boat" }]} />);
    expect(screen.getByLabelText("Description")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updateTask).toHaveBeenCalled());
    const data = mocks.updateTask.mock.calls[0][0] as FormData;
    expect(data.get("description")).toBe("Keep this"); expect(data.get("assetId")).toBe("boat");
    expect(data.get("energyLevel")).toBe("LOW"); expect(data.get("locationType")).toBe("HOME");
    expect(data.get("priority")).toBe("HIGH"); expect(data.get("estimatedMinutes")).toBe("45");
    expect(data.get("dueDate")).toBe("2027-04-01");
  });

  it("keeps typed values when extra fields are hidden again", async () => {
    wrap(<TaskForm areas={areas} locations={locations} />);
    await userEvent.click(screen.getByRole("button", { name: "More fields" }));
    await userEvent.type(screen.getByLabelText("Estimated time (min)"), "25");
    await userEvent.click(screen.getByRole("button", { name: "Fewer fields" }));
    await userEvent.click(screen.getByRole("button", { name: "More fields" }));
    expect(screen.getByLabelText("Estimated time (min)")).toHaveValue(25);
  });

  it("retains the chosen preferences when saving fails", async () => {
    mocks.preference.mockRejectedValueOnce(new Error("offline"));
    wrap(<TaskFieldSettings visibleFields={[]} />);
    await userEvent.click(screen.getByLabelText("Asset"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Asset")).toBeChecked();
  });
});
