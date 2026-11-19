import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const today = new Date();
  const at = (h: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h).toISOString();
  const rows: Record<string, unknown[]> = {
    calendar_events: [
      { id: "e1", owner_id: "me", department: null, title: "Lawyer call", notes: "", starts_at: at(14), ends_at: null, all_day: false },
      { id: "e2", owner_id: "x", department: "support", title: "Support standup", notes: "", starts_at: at(10), ends_at: null, all_day: false },
    ],
    department_tasks: [{ id: "t1", department: "launch", title: "Move hosting to Cloudflare", due_at: at(17), status: "planned" }],
  };
  const q = (table: string) => { const b: Record<string, unknown> = {}; for (const m of ["select", "gte", "lte", "order", "not", "neq", "eq", "maybeSingle"]) b[m] = () => b; b["then"] = (r: (v: unknown) => void) => r({ data: rows[table], error: null }); return b; };
  return { supabase: { from: (t: string) => q(t) } };
});

import { AdminCalendar } from "./AdminCalendar";

describe("Admin calendar", () => {
  it("shows private entries, department entries and task deadlines", async () => {
    render(<AdminCalendar me="me" access={{ role: "super_admin", departments: ["support", "launch"], canManageStaff: true, allTeams: true }} />);
    await waitFor(() => expect(screen.getAllByText(/Lawyer call/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Support standup/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Move hosting to Cloudflare/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Private/ }).length).toBeGreaterThan(0);
  });

  it("switches through Week, Day and Agenda and comes back to Month", async () => {
    render(<AdminCalendar me="me" access={{ role: "super_admin", departments: ["support", "launch"], canManageStaff: true, allTeams: true }} />);
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
