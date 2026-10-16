import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FocusTimer } from "@/components/focus-timer";
import { I18nProvider } from "@/components/i18n-provider";
import { type ReactElement } from "react";

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

// Mock server actions
vi.mock("@/app/actions/focus-actions", () => ({
  startFocusSession: vi.fn().mockResolvedValue("session-123"),
  completeFocusSession: vi.fn().mockResolvedValue(undefined),
}));

const mockTasks = [
  { id: "task-1", title: "Fiks garasjen" },
  { id: "task-2", title: "Klipp plenen" },
];

describe("FocusTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("viser 25:00 som standard", () => {
    renderWithI18n(<FocusTimer tasks={[]} />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("viser varighetsknapper (10, 25, 45 min)", () => {
    renderWithI18n(<FocusTimer tasks={[]} />);
    expect(screen.getByText("10 min")).toBeInTheDocument();
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
  });

  it("endrer timer ved valg av annen varighet", async () => {
    renderWithI18n(<FocusTimer tasks={[]} />);
    await userEvent.click(screen.getByText("10 min"));
    expect(screen.getByText("10:00")).toBeInTheDocument();
  });

  it("viser Start-knapp i idle-tilstand", () => {
    renderWithI18n(<FocusTimer tasks={[]} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("viser oppgavedropdown når det finnes oppgaver", () => {
    renderWithI18n(<FocusTimer tasks={mockTasks} />);
    expect(screen.getByText("Ingen oppgave (fri økt)")).toBeInTheDocument();
    expect(screen.getByText("Fiks garasjen")).toBeInTheDocument();
    expect(screen.getByText("Klipp plenen")).toBeInTheDocument();
  });

  it("viser ikke oppgavedropdown uten oppgaver", () => {
    renderWithI18n(<FocusTimer tasks={[]} />);
    expect(screen.queryByText("Ingen oppgave (fri økt)")).not.toBeInTheDocument();
  });

  it("viser Pause og Stopp etter start", async () => {
    const { startFocusSession } = await import("@/app/actions/focus-actions");
    renderWithI18n(<FocusTimer tasks={[]} />);

    await act(async () => {
      await userEvent.click(screen.getByText("Start"));
    });

    expect(startFocusSession).toHaveBeenCalled();
    expect(screen.getByText("Pause")).toBeInTheDocument();
    expect(screen.getByText("Stopp")).toBeInTheDocument();
  });

  it("viser distraksjon-teller under kjøring", async () => {
    renderWithI18n(<FocusTimer tasks={[]} />);

    await act(async () => {
      await userEvent.click(screen.getByText("Start"));
    });

    expect(screen.getByText("Distraksjoner:")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("skjuler varighetsvelger under kjøring", async () => {
    renderWithI18n(<FocusTimer tasks={[]} />);

    await act(async () => {
      await userEvent.click(screen.getByText("Start"));
    });

    expect(screen.queryByText("10 min")).not.toBeInTheDocument();
    expect(screen.queryByText("45 min")).not.toBeInTheDocument();
  });
});
