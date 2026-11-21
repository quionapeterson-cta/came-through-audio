import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// The rows the screen saves, kept outside the mock factory so the test can read them back.
const writes = vi.hoisted(() => ({ inserted: [] as Record<string, unknown>[] }));

vi.mock("@/integrations/supabase/client", () => {
  const today = new Date();
  const at = (h: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).toISOString();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Local 23:00 yesterday: a date picker would have stored it as an instant on the day before the picked one.
  const lastNight = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23);
  const rows: Record<string, unknown[]> = {
    calendar_events: [
      {
        id: "e1",
        owner_id: "me",
        department: null,
        title: "Lawyer call",
        notes: "",
        starts_at: at(14),
        ends_at: null,
        all_day: false,
      },
      {
        id: "e2",
        owner_id: "x",
        department: "support",
        title: "Support standup",
        notes: "",
        starts_at: at(10),
        ends_at: null,
        all_day: false,
      },
      {
        id: "e3",
        owner_id: "me",
        department: null,
        title: "Release day",
        notes: "",
        starts_at: lastNight.toISOString(),
        ends_at: null,
        all_day: true,
        all_day_on: ymd(today),
      },
    ],
    department_tasks: [
      {
        id: "t1",
        department: "launch",
        title: "Move hosting to Cloudflare",
        due_at: at(17),
        status: "planned",
      },
    ],
  };
  const q = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lte", "order", "not", "neq", "eq", "maybeSingle"])
      b[m] = () => b;
    b["insert"] = (row: Record<string, unknown>) => {
      writes.inserted.push(row);
      return b;
    };
    b["then"] = (r: (v: unknown) => void) => r({ data: rows[table], error: null });
    return b;
  };
  return { supabase: { from: (t: string) => q(t) } };
});

import { AdminCalendar } from "./AdminCalendar";

describe("Admin calendar", () => {
  beforeEach(() => {
    writes.inserted.length = 0;
  });

  it("writes the picked date for an all-day entry and null for a timed one", async () => {
    render(
      <AdminCalendar
        me="me"
        access={{
          role: "super_admin",
          departments: ["support", "launch"],
          canManageStaff: true,
          allTeams: true,
        }}
      />,
    );
    await waitFor(() => expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Release day" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-24" } });
    fireEvent.click(screen.getByLabelText("All day"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes.inserted).toHaveLength(1));
    expect(writes.inserted[0]).toMatchObject({ all_day: true, all_day_on: "2026-12-24" });

    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Mix session" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes.inserted).toHaveLength(2));
    expect(writes.inserted[1]).toMatchObject({ all_day: false, all_day_on: null });
  });

  it("shows private entries, department entries and task deadlines", async () => {
    render(
      <AdminCalendar
        me="me"
        access={{
          role: "super_admin",
          departments: ["support", "launch"],
          canManageStaff: true,
          allTeams: true,
        }}
      />,
    );
    await waitFor(() => expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Support standup/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Move hosting to Cloudflare/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Private/ }).length).toBeGreaterThan(0);
  });

  it("draws an all-day entry on its stored date, not on the instant's day", async () => {
    render(
      <AdminCalendar
        me="me"
        access={{
          role: "super_admin",
          departments: ["support", "launch"],
          canManageStaff: true,
          allTeams: true,
        }}
      />,
    );
    await waitFor(() => expect(screen.getAllByText(/Release day/).length).toBeGreaterThan(0));

    // The entry was saved at 23:00 the day before; the date the member picked is what every viewer sees.
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getAllByText(/Release day/).length).toBeGreaterThan(0);

    // The day before is empty: the entry is not drawn there even though its instant falls on that day.
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    await waitFor(() => expect(screen.getByText("Nothing on this day.")).toBeInTheDocument());
  });

  it("switches through Week, Day and Agenda and comes back to Month", async () => {
    render(
      <AdminCalendar
        me="me"
        access={{
          role: "super_admin",
          departments: ["support", "launch"],
          canManageStaff: true,
          allTeams: true,
        }}
      />,
    );
    await waitFor(() => expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0));

    // Month is the view the screen opens on, with its own grid and Coming up list.
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Coming up")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Sun").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Support standup/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add to this day" })).toBeInTheDocument();
    expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Move hosting to Cloudflare/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute("aria-pressed", "true");
    // Agenda is the longer list, so the separate Coming up section is not repeated under it.
    expect(screen.queryByText("Coming up")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByText("Coming up")).toBeInTheDocument());
    expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0);
  });
});
