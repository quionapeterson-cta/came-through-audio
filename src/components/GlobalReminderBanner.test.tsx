import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) } },
}));

import { GlobalReminderBanner } from "./GlobalReminderBanner";
import { WorkspaceRemindersProvider } from "@/hooks/useWorkspaceReminders";
import { makeReminder, saveReminders, type NewReminder } from "@/lib/workspace-reminders";

const USER = "staff-1";

/** This environment has no localStorage of its own, so the browser's copy is stood in for here. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
  };
}

function seed(input: NewReminder) {
  saveReminders(USER, [{ ...makeReminder(input), id: "r1" }]);
}

function renderBanner() {
  return render(
    <WorkspaceRemindersProvider userId={USER}>
      <GlobalReminderBanner />
    </WorkspaceRemindersProvider>,
  );
}

const dueSoon: NewReminder = {
  title: "Approve Legal's redlines",
  dueAt: new Date(Date.now() - 3_600_000).toISOString(),
  priority: "urgent",
};

describe("Global reminder banner", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a due reminder with both actions", () => {
    seed(dueSoon);
    renderBanner();
    expect(screen.getByText("Approve Legal's redlines")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snooze 1 Day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Done" })).toBeInTheDocument();
  });

  it("leaves the screen once marked done", async () => {
    seed(dueSoon);
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Mark Done" }));
    await waitFor(() => expect(screen.queryByText("Approve Legal's redlines")).not.toBeInTheDocument());
  });

  it("leaves the screen once snoozed and comes back tomorrow", async () => {
    seed(dueSoon);
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Snooze 1 Day" }));
    await waitFor(() => expect(screen.queryByText("Approve Legal's redlines")).not.toBeInTheDocument());

    const shownAt = Date.now();
    const tomorrow = vi.spyOn(Date, "now").mockReturnValue(shownAt + 25 * 3_600_000);
    renderBanner();
    expect(await screen.findByText("Approve Legal's redlines")).toBeInTheDocument();
    tomorrow.mockRestore();
  });

  it("stays quiet when nothing is due", () => {
    seed({ title: "Next week's review", dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    renderBanner();
    expect(screen.queryByText("Next week's review")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Admin reminders due" })).not.toBeInTheDocument();
  });
});
