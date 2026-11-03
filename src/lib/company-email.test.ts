import { describe, expect, it } from "vitest";
import { COMPANY_MAILBOXES, companyFrom, companyReplyTo, mailBodyHtml } from "./company-email";

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
