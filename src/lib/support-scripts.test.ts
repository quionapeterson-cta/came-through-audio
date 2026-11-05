import { describe, expect, it } from "vitest";
import { ASSIGNABLE_DEPARTMENTS, DEPARTMENTS } from "./departments";
import {
  SUPPORT_SCRIPTS, fillScript, isBillingTicket, scriptDepartments, scriptVariables, scriptsFor, scriptsForTicket,
  searchScripts, ticketOwnerDepartment, ticketScriptValues,
} from "./support-scripts";

describe("the script catalog", () => {
  it("has unique ids and a real department on every script", () => {
    const ids = SUPPORT_SCRIPTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SUPPORT_SCRIPTS) {
      expect(DEPARTMENTS).toContain(s.department);
      expect(s.title.trim().length).toBeGreaterThan(3);
      expect(s.when.trim().length).toBeGreaterThan(10);
      expect(s.body.trim().length).toBeGreaterThan(30);
    }
  });

  it("covers every department staff can be placed in", () => {
    for (const d of ASSIGNABLE_DEPARTMENTS) {
      expect(SUPPORT_SCRIPTS.some((s) => s.department === d), `no script for ${d}`).toBe(true);
    }
  });

  it("marks internal-only scripts, and only the internal departments use them", () => {
    const internal = SUPPORT_SCRIPTS.filter((s) => s.internal);
    expect(internal.length).toBeGreaterThan(0);
    for (const s of internal) {
      // Support's pre-break checklist is staff-only too: it is the one to send yourself, never a member.
      expect(["hr", "research", "support"]).toContain(s.department);
      expect(s.body).toContain("INTERNAL ONLY");
    }
  });
});

describe("scriptsFor and searchScripts", () => {
  it("filters by department", () => {
    expect(scriptsFor("billing").every((s) => s.department === "billing")).toBe(true);
    expect(scriptsFor("billing").length).toBeGreaterThan(0);
    expect(scriptsFor("all").length).toBe(SUPPORT_SCRIPTS.length);
  });

  it("searches the words, not just the title, and respects the department filter", () => {
    expect(searchScripts("authorization").some((s) => s.id === "billing-duplicate-is-a-hold")).toBe(true);
    expect(searchScripts("authorization", "support").some((s) => s.id === "billing-duplicate-is-a-hold")).toBe(false);
    expect(searchScripts("   ").length).toBe(SUPPORT_SCRIPTS.length);
  });

  it("orders the department chips by first appearance and counts each one", () => {
    const depts = scriptDepartments();
    expect(depts[0]?.department).toBe("billing");
    const total = depts.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(SUPPORT_SCRIPTS.length);
  });
});

describe("filling a script", () => {
  it("replaces what it was given and leaves the rest visible", () => {
    const out = fillScript("Hi {{first_name}}, you paid {{amount}} for {{detail}}.", { first_name: "Ada", amount: "" });
    expect(out).toBe("Hi Ada, you paid {{amount}} for {{detail}}.");
  });

  it("lists each placeholder once", () => {
    expect(scriptVariables("{{first_name}} and {{ first_name }} on {{date}}")).toEqual(["first_name", "date"]);
    expect(scriptVariables("no placeholders")).toEqual([]);
  });
});

describe("who answers a ticket", () => {
  it("gives billing tickets to Billing and everything else to Support", () => {
    expect(ticketOwnerDepartment("Account & billing · A charge, invoice or refund")).toBe("billing");
    expect(ticketOwnerDepartment("My Catalog · A song won't save or upload")).toBe("support");
    expect(isBillingTicket("account & BILLING · Seats and artist seats")).toBe(true);
    expect(isBillingTicket("Something else · A technical problem with the site")).toBe(false);
  });
});

describe("scripts one click from a ticket", () => {
  it("offers the queue owner's scripts and nothing from the other queue", () => {
    const billing = scriptsForTicket("Account & billing · A charge, invoice or refund");
    expect(billing.length).toBeGreaterThan(0);
    expect(billing.every((s) => s.department === "billing")).toBe(true);
    const support = scriptsForTicket("My Catalog · A song won't save or upload");
    expect(support.length).toBeGreaterThan(0);
    expect(support.every((s) => s.department === "support")).toBe(true);
  });

  it("fills the first name and the subject, and leaves the rest for staff", () => {
    expect(ticketScriptValues({ name: "Ada Lovelace", subject: "Refund please" })).toEqual({ first_name: "Ada", detail: "Refund please" });
    expect(ticketScriptValues({ name: "   ", subject: "" })).toEqual({});
  });
});
