import { describe, it, expect } from "vitest";
import { toggleAgency } from "@/components/ExpertAssistance";
describe("PRO exclusivity", () => {
  it("choosing BMI removes ASCAP", () => expect(toggleAgency(["ASCAP", "The MLC"], "BMI", true)).toEqual(["The MLC", "BMI"]));
  it("SoundExchange stacks with a PRO", () => expect(toggleAgency(["ASCAP"], "SoundExchange", true)).toEqual(["ASCAP", "SoundExchange"]));
});
