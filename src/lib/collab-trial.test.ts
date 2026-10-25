import { describe, expect, it } from "vitest";
import { hashEmail, normalizeEmail } from "@/lib/collab-trial.server";

describe("one trial per email", () => {
  it("treats Gmail dots, +tags and case as the same inbox", () => {
    expect(normalizeEmail("Karma.Came+trial@GMail.com")).toBe("karmacame@gmail.com");
    expect(normalizeEmail("karma.came@googlemail.com")).toBe("karmacame@gmail.com");
    expect(hashEmail("K.a.r.m.a.came@gmail.com")).toBe(hashEmail("karmacame+2@gmail.com"));
  });
  it("keeps dots outside Gmail, where they can be different inboxes", () => {
    expect(normalizeEmail("ann.lee+x@label.com")).toBe("ann.lee@label.com");
    expect(hashEmail("ann.lee@label.com")).not.toBe(hashEmail("annlee@label.com"));
  });
  it("never stores the address itself", () => {
    expect(hashEmail("ann@label.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
