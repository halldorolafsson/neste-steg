import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "@/components/task-filters";
import { I18nProvider } from "@/components/i18n-provider";
import { clearTaskFilters, savedTaskQuery, TASK_FILTER_COOKIE } from "@/lib/task-filters";

const nav = vi.hoisted(() => ({ query: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));

const areas = [{ id: "a", slug: "hus", name: "House" }, { id: "b", slug: "bil", name: "Car" }];
const component = () => <I18nProvider><TaskFilters userId="user-1" areas={areas} /></I18nProvider>;

describe("task filter controls", () => {
  beforeEach(() => {
    nav.query = "status=TODO&status=IN_PROGRESS&priority=HIGH&priority=MEDIUM&area=hus&sort=title";
    nav.push.mockReset();
    localStorage.setItem("neste-steg-locale", "en");
    clearTaskFilters();
  });
  afterEach(() => { cleanup(); localStorage.clear(); clearTaskFilters(); });

  it("renders multiple checked values from the URL", async () => {
    render(component());
    await userEvent.click(screen.getByText("Status: 2"));
    expect(screen.getByLabelText("To do")).toBeChecked();
    expect(screen.getByLabelText("In progress")).toBeChecked();
    expect(screen.getByRole("combobox")).toHaveValue("title");
  });

  it("adds a selection without discarding other groups or sorting", async () => {
    render(component());
    await userEvent.click(screen.getByText("Area: 1"));
    await userEvent.click(screen.getByLabelText("Car"));
    const url = nav.push.mock.calls.at(-1)![0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("area")).toEqual(["hus", "bil"]);
    expect(params.getAll("status")).toEqual(["TODO", "IN_PROGRESS"]);
    expect(params.getAll("priority")).toEqual(["HIGH", "MEDIUM"]);
    expect(params.get("sort")).toBe("title");
  });

  it("removes one selection while keeping the other", async () => {
    render(component());
    await userEvent.click(screen.getByText("Status: 2"));
    await userEvent.click(screen.getByLabelText("In progress"));
    expect(nav.push.mock.calls.at(-1)![0]).toContain("status=TODO&area=hus&priority=HIGH&priority=MEDIUM&sort=title");
    expect(nav.push.mock.calls.at(-1)![0]).not.toContain("status=IN_PROGRESS");
  });

  it("resets all groups and sorting, including saved preferences", async () => {
    render(component());
    await userEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(nav.push).toHaveBeenCalledWith("/tasks?filters=1", { scroll: false });
    expect(savedTaskQuery(document.cookie.split(`${TASK_FILTER_COOKIE}=`)[1], "user-1")).toBe("filters=1");
  });

  it("updates remembered preferences on browser back navigation", () => {
    const view = render(component());
    nav.query = "status=DONE&sort=oldest";
    view.rerender(component());
    expect(savedTaskQuery(document.cookie.split(`${TASK_FILTER_COOKIE}=`)[1], "user-1")).toBe("filters=1&status=DONE&sort=oldest");
  });

  it("closes the menu after a selection and restores focus to its summary", async () => {
    render(component());
    const summary = screen.getByText("Status: 2");
    await userEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    await userEvent.click(screen.getByLabelText("In progress"));
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
    expect(nav.push).toHaveBeenCalled();
  });

  it("closes on outside click without changing the selected filters", async () => {
    render(component());
    const summary = screen.getByText("Status: 2");
    await userEvent.click(summary);
    await userEvent.click(document.body);
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("closes with Escape and returns keyboard focus", async () => {
    render(component());
    const summary = screen.getByText("Status: 2");
    await userEvent.click(summary);
    await userEvent.tab();
    await userEvent.keyboard("{Escape}");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("closes when keyboard focus leaves the menu", async () => {
    render(component());
    const summary = screen.getByText("Status: 2");
    await userEvent.click(summary);
    await userEvent.tab({ shift: true });
    expect(summary.closest("details")).not.toHaveAttribute("open");
  });

  it("still allows adding another value after reopening the menu", async () => {
    nav.query = "status=TODO";
    const view = render(component());
    await userEvent.click(screen.getByText("Status: 1"));
    await userEvent.click(screen.getByLabelText("In progress"));
    nav.query = (nav.push.mock.calls.at(-1)![0] as string).split("?")[1];
    view.rerender(component());
    await userEvent.click(screen.getByText("Status: 2"));
    expect(screen.getByLabelText("To do")).toBeChecked();
    expect(screen.getByLabelText("In progress")).toBeChecked();
    await userEvent.click(screen.getByLabelText("Done"));
    const params = new URLSearchParams((nav.push.mock.calls.at(-1)![0] as string).split("?")[1]);
    expect(params.getAll("status")).toEqual(["TODO", "IN_PROGRESS", "DONE"]);
  });
});
