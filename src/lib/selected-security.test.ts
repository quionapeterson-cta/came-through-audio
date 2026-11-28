import { beforeEach, describe, expect, it, vi } from "vitest";

// Keep the actual handlers and validation; replace only transport and external database operations.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: { data: unknown; context: unknown }) => unknown) =>
        (args: { data?: unknown; context: unknown }) =>
          fn({ data: validate(args.data), context: args.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./payments-env", () => ({ getPaymentsEnvironment: () => "sandbox" }));

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), download: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: db.from,
    rpc: db.rpc,
    storage: { from: () => ({ download: db.download }) },
  },
}));

import {
  escalateTicket,
  listTicketEscalations,
  listTicketViewers,
  markTicketViewing,
} from "./support-escalation.functions";
import { requestStepChange } from "./queue.functions";
import { getMyBrand } from "./brand-kit.functions";

const userId = "11111111-1111-4111-8111-111111111111";
const ticketId = "22222222-2222-4222-8222-222222222222";
type TestRow = Record<string, unknown>;

function query(rows: TestRow[] = [], error: unknown = null) {
  const result = { data: rows, error };
  const filters = {
    select: vi.fn(() => filters),
    eq: vi.fn(() => filters),
    in: vi.fn(() => filters),
    gte: vi.fn(() => filters),
    order: vi.fn(() => filters),
    limit: vi.fn(() => filters),
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error })),
    insert: vi.fn(async () => ({ error: null })),
    upsert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => filters),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return filters;
}

function context(role = "department_lead", departments = ["marketing"]) {
  return { userId, claims: {}, supabase: { from: () => query([{ role, departments }]) } };
}

type Handler = (args: { data: unknown; context: ReturnType<typeof context> }) => Promise<unknown>;
function call(fn: unknown, data: unknown, ctx = context()) {
  return (fn as Handler)({ data, context: ctx });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.rpc.mockResolvedValue({ data: "management", error: null });
  db.download.mockResolvedValue({ data: null, error: null });
});

describe("selected ticket protections", () => {
  it("refuses handoff notes on a ticket not assigned to the lead", async () => {
    const escalations = query();
    db.from.mockReturnValue(escalations);
    await expect(call(listTicketEscalations, { ticketId })).rejects.toThrow("yours");
    expect(escalations.in).toHaveBeenCalledWith("tag", ["marketing"]);
  });

  it("refuses viewer identities on another team's ticket", async () => {
    db.from.mockReturnValue(query());
    expect(await call(listTicketViewers, { ticketId })).toEqual([]);
    expect(db.from).not.toHaveBeenCalledWith("support_ticket_viewers");
  });

  it("never writes a viewing marker on another team's ticket", async () => {
    const escalations = query();
    db.from.mockReturnValue(escalations);
    expect(await call(markTicketViewing, { ticketId })).toEqual({ ok: false });
    expect(escalations.upsert).not.toHaveBeenCalled();
  });

  it("never inserts a handoff or internal message on another team's ticket", async () => {
    const escalations = query();
    db.from.mockReturnValue(escalations);
    await expect(
      call(escalateTicket, {
        ticketId,
        marketing: true,
        founder: false,
        note: "Please review this.",
      }),
    ).rejects.toThrow("yours");
    expect(escalations.insert).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalledWith("support_ticket_messages");
  });

  it("fails closed when the lead's assignment lookup fails", async () => {
    db.from.mockReturnValue(query([{ id: "assignment" }], new Error("offline")));
    expect(await call(markTicketViewing, { ticketId })).toEqual({ ok: false });
  });

  it("keeps a lead's assigned ticket available and filters its notes by department", async () => {
    const assignment = query([{ id: "assignment" }]);
    const notes = query([
      {
        id: "note",
        tag: "marketing",
        note: "Review",
        by_name: "Support",
        created_at: "2026-11-28",
        read_at: null,
      },
    ]);
    db.from.mockReturnValueOnce(assignment).mockReturnValueOnce(notes);
    const result = await call(listTicketEscalations, { ticketId });
    expect(result).toEqual([
      {
        id: "note",
        tag: "marketing",
        note: "Review",
        byName: "Support",
        createdAt: "2026-11-28",
        readAt: null,
      },
    ]);
    expect(notes.in).toHaveBeenCalledWith("tag", ["marketing"]);
  });

  it("allows the assigned lead to record their own viewing marker", async () => {
    const viewers = query();
    db.from.mockReturnValueOnce(query([{ id: "assignment" }])).mockReturnValueOnce(viewers);
    expect(await call(markTicketViewing, { ticketId })).toEqual({ ok: true });
    expect(viewers.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ticket_id: ticketId, user_id: userId }),
      expect.anything(),
    );
  });

  it.each([
    { role: "employee", departments: ["support"] },
    { role: "super_admin", departments: [] },
  ])("keeps $role access to ticket activity", async ({ role, departments }) => {
    const viewers = query();
    db.from.mockReturnValue(viewers);
    expect(await call(markTicketViewing, { ticketId }, context(role, departments))).toEqual({
      ok: true,
    });
    expect(viewers.upsert).toHaveBeenCalled();
  });
});

describe("checklist request ownership", () => {
  it("refuses a request targeting another teammate's locked step", async () => {
    const steps = query([{ id: ticketId, title: "Review", lock_mode: "locked", user_id: "other" }]);
    db.from.mockReturnValue(steps);
    await expect(call(requestStepChange, { id: ticketId, reason: "Clarify this" })).rejects.toThrow(
      "yours",
    );
    expect(db.from).not.toHaveBeenCalledWith("step_change_requests");
  });

  it("keeps the owner's request available", async () => {
    const requests = query();
    db.from
      .mockReturnValueOnce(
        query([{ id: ticketId, title: "Review", lock_mode: "locked", user_id: userId }]),
      )
      .mockReturnValueOnce(requests);
    expect(await call(requestStepChange, { id: ticketId, reason: "Clarify this" })).toEqual({
      ok: true,
    });
    expect(requests.insert).toHaveBeenCalledWith(
      expect.objectContaining({ step_id: ticketId, requested_by: userId }),
    );
  });
});

describe("private logo ownership", () => {
  function kit(logoPath: string) {
    db.from.mockImplementation((table: string) =>
      query(table === "brand_kits" ? [{ id: ticketId, name: "Artist", logo_path: logoPath }] : []),
    );
  }

  it("never downloads a saved path naming another member's logo", async () => {
    kit("other-user/logo.png");
    const result = await call(getMyBrand, { use: "catalog" });
    expect(result).toMatchObject({ name: "Artist", logo: null });
    expect(db.download).not.toHaveBeenCalled();
  });

  it.each(["../other/logo.png", "%2e%2e/other/logo.png", "..\\other/logo.png"])(
    "rejects traversal %s but still returns a usable brand",
    async (path) => {
      kit(`${userId}/${path}`);
      expect(await call(getMyBrand, { use: "catalog" })).toMatchObject({
        name: "Artist",
        logo: null,
      });
      expect(db.download).not.toHaveBeenCalled();
    },
  );

  it("continues downloading the member's own logo", async () => {
    kit(`${userId}/logo.png`);
    await call(getMyBrand, { use: "catalog" });
    expect(db.download).toHaveBeenCalledWith(`${userId}/logo.png`);
  });
});
