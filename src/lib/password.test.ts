import { describe, it, expect } from "vitest";
import { passwordValid } from "./password";

describe("password rules", () => {
  it("rejects under 8 characters", () => expect(passwordValid("Ab!cdef")).toBe(false));
  it("requires a lowercase letter", () => expect(passwordValid("ABCDEFG!")).toBe(false));
  it("requires a capital letter", () => expect(passwordValid("abcdefg!")).toBe(false));
  it("requires a symbol", () => expect(passwordValid("Abcdefgh")).toBe(false));
  it("accepts a valid password", () => expect(passwordValid("Abcdefg!")).toBe(true));
});
