import { describe, expect, it } from "vitest";
import { registeredName } from "@/lib/writer-names";

/**
 * The name a member has to paste into a repertoire search (founder, 2026-11-15): the catalog's own spelling and order,
 * with the words only the registration carries. The founder searched "Qui-Ona Peterson" at BMI and found nothing;
 * "Qui-Ona LaShay Peterson" found her works.
 */
describe("the full registered writer name", () => {
  it("keeps the catalog's order and adds the name the registration carries, without the honourifics", () => {
    expect(registeredName("Qui-Ona Peterson", "PETERSON QUI ONA LASHAY")).toBe("Qui-Ona Lashay Peterson");
    expect(registeredName("Calvin Stephens", "STEPHENS CALVIN ANDRE JR (MR)")).toBe("Calvin Andre Stephens");
  });

  it("leaves a name that already matches exactly as the member wrote it", () => {
    expect(registeredName("Qui-Ona Lashay Peterson", "PETERSON QUI ONA LASHAY")).toBe("Qui-Ona Lashay Peterson");
    expect(registeredName("Ann Lee", "LEE ANN")).toBe("Ann Lee");
  });

  it("never merges two different names into a third", () => {
    expect(registeredName("Karma Came", "PETERSON QUI ONA LASHAY")).toBe("Karma Came");
    expect(registeredName("", "ANN LEE")).toBe("");
  });
});
