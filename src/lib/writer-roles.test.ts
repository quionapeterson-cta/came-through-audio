import { describe, expect, it } from "vitest";
import { MLC_ROLE, writerRole } from "@/lib/metadata";

describe("writer roles", () => {
  it("maps Author to MLC A", () => expect(MLC_ROLE.Author).toBe("A"));
  it("maps Composer to MLC C", () => expect(MLC_ROLE.Composer).toBe("C"));
  it("maps Author/Composer to MLC CA", () => expect(MLC_ROLE["Author/Composer"]).toBe("CA"));
  it("defaults missing roles to Author/Composer", () => expect(writerRole(undefined)).toBe("Author/Composer"));
});
