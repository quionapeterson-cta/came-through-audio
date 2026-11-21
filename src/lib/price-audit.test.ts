import { describe, expect, it } from "vitest";
import { auditLivePrices, type StripePriceLike } from "./price-audit";
import { PUBLISHED_AMOUNTS } from "./price-check";
import { soldPrices } from "./price-list";
import { resolveAccess, canAuditPayments } from "./departments";

/** What live Stripe would return when every price is exactly right. */
function healthy(): StripePriceLike[] {
  return soldPrices().map((row) => ({
    lookup_key: row.lookupKey,
    unit_amount: PUBLISHED_AMOUNTS[row.lookupKey],
    currency: "usd",
    active: true,
    type: row.billing === "one-time" ? "one_time" : "recurring",
    recurring:
      row.billing === "one-time"
        ? null
        : { interval: row.billing === "recurring-monthly" ? "month" : "year" },
  }));
}

const byKey = (rows: StripePriceLike[], key: string) => rows.find((r) => r.lookup_key === key)!;

describe("the live price check", () => {
  it("passes when every sold key exists at the published amount and type", () => {
    const audit = auditLivePrices(healthy());
    expect(audit.problems).toEqual([]);
    expect(audit.ok).toBe(true);
    expect(audit.rows).toHaveLength(soldPrices().length);
    expect(audit.rows.every((r) => r.problem === null)).toBe(true);
  });

  it("catches a live price that was never created, naming the key and the amount to create", () => {
    const audit = auditLivePrices(
      healthy().filter((p) => p.lookup_key !== "catalog_management_yearly"),
    );
    expect(audit.ok).toBe(false);
    expect(audit.problems[0]).toContain("catalog_management_yearly");
    expect(audit.problems[0]).toContain("$89.99");
    expect(audit.rows.find((r) => r.lookupKey === "catalog_management_yearly")?.problem).toContain(
      "no price",
    );
  });

  it("catches an amount that drifted from the published price", () => {
    const rows = healthy();
    byKey(rows, "contract_generator").unit_amount = 1499;
    const audit = auditLivePrices(rows);
    expect(audit.ok).toBe(false);
    expect(audit.problems[0]).toContain("$14.99");
    expect(audit.problems[0]).toContain("$3.99");
  });

  it("catches a yearly plan held as a one-time price", () => {
    const rows = healthy();
    const plan = byKey(rows, "catalog_plus_yearly");
    plan.type = "one_time";
    plan.recurring = null;
    expect(auditLivePrices(rows).problems.join(" ")).toContain("must be a yearly subscription");
  });

  it("catches a monthly price held as a yearly one, which would bill the pause once a year", () => {
    const rows = healthy();
    const vault = byKey(rows, "vault_month");
    vault.recurring = { interval: "year" };
    const problem = auditLivePrices(rows).problems.join(" ");
    expect(problem).toContain("must be a monthly subscription");
    expect(problem).toContain("yearly");
  });

  it("catches a monthly price held as a one-time charge, the old shape of the pause fee", () => {
    const rows = healthy();
    const vault = byKey(rows, "vault_month");
    vault.type = "one_time";
    vault.recurring = null;
    expect(auditLivePrices(rows).problems.join(" ")).toContain("must be a monthly subscription");
  });

  it("catches a one-time add-on held as a subscription", () => {
    const rows = healthy();
    byKey(rows, "contract_generator").type = "recurring";
    byKey(rows, "contract_generator").recurring = { interval: "month" };
    expect(auditLivePrices(rows).problems.join(" ")).toContain("must be a one-time price");
  });

  it("catches an archived price, which checkout cannot use", () => {
    const rows = healthy();
    byKey(rows, "branding_yearly").active = false;
    expect(auditLivePrices(rows).problems.join(" ")).toContain("archived");
  });

  it("catches a price held in another currency", () => {
    const rows = healthy();
    byKey(rows, "vault_month").currency = "eur";
    expect(auditLivePrices(rows).problems.join(" ")).toContain("EUR");
  });

  it("reports one row for every key the price list sells, so nothing on sale is skipped", () => {
    const audit = auditLivePrices([]);
    expect(audit.rows.map((r) => r.lookupKey).sort()).toEqual(
      soldPrices()
        .map((r) => r.lookupKey)
        .sort(),
    );
    expect(audit.problems).toHaveLength(soldPrices().length);
  });
});

describe("who may run the payments check", () => {
  it("lets a super admin in, whatever the stored departments say", () => {
    expect(canAuditPayments(resolveAccess([{ role: "super_admin", departments: [] }]))).toBe(true);
  });

  it("lets Billing, Support and Software in", () => {
    for (const department of ["billing", "support", "software"]) {
      expect(
        canAuditPayments(resolveAccess([{ role: "employee", departments: [department] }])),
        department,
      ).toBe(true);
    }
  });

  it("refuses Finance, Registration, HR and anyone with no staff role", () => {
    expect(canAuditPayments(resolveAccess([{ role: "employee", departments: ["finance"] }]))).toBe(
      false,
    );
    expect(
      canAuditPayments(resolveAccess([{ role: "employee", departments: ["registration"] }])),
    ).toBe(false);
    expect(canAuditPayments(resolveAccess([{ role: "hr_admin" }]))).toBe(false);
    expect(canAuditPayments(null)).toBe(false);
  });
});
