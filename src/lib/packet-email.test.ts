import { describe, expect, it } from "vitest";
import { packetEmailHtml, packetEmailSubject } from "./packet-email";

const link = "https://pixel-perfect-studio-382.lovable.app/sign/packet/abc-123";

describe("packetEmail", () => {
  it("names the packet in the subject", () => {
    expect(packetEmailSubject("CTA Internship Onboarding Packet")).toBe(
      "Signature needed: CTA Internship Onboarding Packet",
    );
  });

  it("carries the signing link the server built, in the button and as text", () => {
    const html = packetEmailHtml({ title: "Packet", recipientName: "Sam Rivera", link });
    expect(html).toContain(`href="${link}"`);
    expect(html.split(link).length - 1).toBe(2);
  });

  it("greets by first name and escapes what the admin typed", () => {
    const html = packetEmailHtml({
      title: "Packet <script>",
      recipientName: "A&B Rivera",
      link,
    });
    expect(html).toContain("Hi A&amp;B,");
    expect(html).not.toContain("<script>");
  });
});
