import { describe, expect, it } from "vitest";
import {
  COMPANY_MAILBOXES,
  companyFrom,
  companyMailboxesFor,
  companyMailReadScope,
  companyReplyTo,
  mailBodyHtml,
} from "./company-email";
import { resolveAccess } from "./departments";
import { PDF_MAILBOXES } from "./pdf-tools";

const lead = (departments: string[]) => resolveAccess([{ role: "department_lead", departments }]);

describe("company email", () => {
  it("sends as the mailbox it was given, with replies back to the same one", () => {
    expect(companyFrom("admin")).toBe("Came Through Audio <admin@camethroughaudio.com>");
    expect(companyReplyTo("admin")).toBe("admin@camethroughaudio.com");
    expect(companyFrom("billing")).toContain(COMPANY_MAILBOXES.billing);
  });

  it("refuses an address that is not one of ours", () => {
    expect(companyFrom("founder" as never)).toBeUndefined();
    expect(companyReplyTo("founder" as never)).toBeUndefined();
  });

  it("keeps paragraphs, joins single newlines, and escapes markup", () => {
    const html = mailBodyHtml("Hello,\n\n<b>bold</b> & fine\nsecond line");
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("fine<br>second line");
  });
});

describe("who may send company mail", () => {
  it("lets a super admin write from every mailbox", () => {
    const superAdmin = resolveAccess([{ role: "super_admin" }]);
    expect(companyMailboxesFor(superAdmin)).toEqual(Object.keys(COMPANY_MAILBOXES));
    expect(companyMailReadScope(superAdmin)).toBe("all");
  });

  it("gives a department lead only the boxes their department owns", () => {
    expect(companyMailboxesFor(lead(["support"]))).toEqual(["info", "support"]);
    expect(companyMailboxesFor(lead(["finance"]))).toEqual(["billing"]);
    // Marketing runs the public inbox, so info@ is theirs as well as Support's.
    expect(companyMailboxesFor(lead(["marketing"]))).toEqual([
      "marketing",
      "partners",
      "info",
      "collaborate",
      "partnerships",
    ]);
    // Legal sits with Security, and only a super admin writes as admin@ or contracts@.
    expect(companyMailboxesFor(lead(["security"]))).toEqual(["legal"]);
    expect(companyMailboxesFor(lead(["support", "marketing"]))).not.toContain("admin");
    expect(companyMailboxesFor(lead(["support", "marketing"]))).not.toContain("contracts");
  });

  it("stops general staff sending outbound company correspondence", () => {
    expect(
      companyMailboxesFor(resolveAccess([{ role: "employee", departments: ["support"] }])),
    ).toEqual([]);
    expect(
      companyMailboxesFor(resolveAccess([{ role: "employee", departments: ["marketing"] }])),
    ).toEqual([]);
    expect(companyMailboxesFor(resolveAccess([{ role: "project_manager" }]))).toEqual([]);
    expect(companyMailboxesFor(null)).toEqual([]);
  });

  it("narrows what the sent log shows to the same departments", () => {
    expect(companyMailReadScope(lead(["support"]))).toEqual(["info", "support"]);
    // A lead whose department owns no mailbox, and every employee, sees only what they sent themselves.
    expect(companyMailReadScope(lead(["hr"]))).toBe("own");
    expect(
      companyMailReadScope(resolveAccess([{ role: "employee", departments: ["marketing"] }])),
    ).toBe("own");
    expect(companyMailReadScope(null)).toBe("own");
  });

  it("covers every mailbox a PDF can be sent from", () => {
    // A PDF mailbox the company mapping has never heard of would be one nobody could ever send from.
    for (const mailbox of PDF_MAILBOXES) expect(COMPANY_MAILBOXES[mailbox]).toBeTruthy();
  });
});
