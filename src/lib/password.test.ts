import { describe, it, expect } from "vitest";
import { passwordStrength, passwordValid } from "./password";

describe("password rules", () => {
  it("rejects under 12 characters", () => expect(passwordValid("Abcdefgh1!x")).toBe(false));
  it("requires a lowercase letter", () => expect(passwordValid("ABCDEFGHIJ1!")).toBe(false));
  it("requires a capital letter", () => expect(passwordValid("abcdefghij1!")).toBe(false));
  it("requires a symbol", () => expect(passwordValid("Abcdefghij12")).toBe(false));
  it("requires a number", () => expect(passwordValid("Abcdefghij!!")).toBe(false));
  it("rejects easy-to-guess words", () => expect(passwordValid("MyPassword12!")).toBe(false));
  it("accepts a valid password", () => expect(passwordValid("Abcdefgh1!xy")).toBe(true));
  it("rates longer passwords stronger", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Abcdefgh1!xy")).toBeLessThan(passwordStrength("Abcdefgh1!xyzwvutsrq"));
  });
});
