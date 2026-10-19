import { describe, it, expect } from "vitest";
import { passwordStrength, passwordValid } from "./password";

describe("password rules", () => {
  it("rejects under 8 characters", () => expect(passwordValid("Ab!cdef")).toBe(false));
  it("requires a lowercase letter", () => expect(passwordValid("ABCDEFG!")).toBe(false));
  it("requires a capital letter", () => expect(passwordValid("abcdefg!")).toBe(false));
  it("requires a symbol", () => expect(passwordValid("Abcdefg1")).toBe(false));
  it("requires a number", () => expect(passwordValid("Abcdefg!")).toBe(false));
  it("rejects easy-to-guess words", () => expect(passwordValid("Password1!")).toBe(false));
  it("accepts a valid password", () => expect(passwordValid("Abcdef1!")).toBe(true));
  it("rates longer passwords stronger", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Abcdef1!")).toBeLessThan(passwordStrength("Abcdef1!ghijklmnop"));
  });
});
