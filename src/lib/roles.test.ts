import { describe, expect, it } from "vitest";
import { emptyMetadata } from "@/lib/metadata";
import { ACCOUNT_ROLES, SITUATIONS, isExternal, roleDefaults, sellsBeats, withRoleDefaults, writerOnly } from "@/lib/roles";

describe("roles", () => {
  it("lists the six confirmed roles and the three situations", () => {
    expect([...ACCOUNT_ROLES]).toEqual(["Songwriter", "Recording artist", "Producer", "Label", "Artist manager", "Session musician"]);
    expect([...SITUATIONS]).toEqual(["released", "planning", "writer"]);
  });
  it("leaves an account with no answers exactly as it was", () => {
    expect(roleDefaults({})).toEqual({ recordingSide: "", unreleased: false });
  });
  it("keeps the artist's path when Recording artist is picked alongside anything else", () => {
    expect(roleDefaults({ roles: ["Recording artist", "Producer", "Session musician"] })).toEqual({ recordingSide: "", unreleased: false });
    expect(writerOnly({ roles: ["Recording artist", "Songwriter"] })).toBe(false);
  });
  it("gives a songwriter who does not perform the writer's side", () => {
    expect(roleDefaults({ roles: ["Songwriter"] })).toEqual({ recordingSide: "external", unreleased: false });
    expect(roleDefaults({ roles: ["Songwriter"], situations: ["writer"] }).recordingSide).toBe("external");
    expect(isExternal({ recordingSide: "external" })).toBe(true);
    expect(isExternal({ recordingSide: "" })).toBe(false);
  });
  it("starts a planner's new songs unreleased, and a released artist's as usual", () => {
    expect(roleDefaults({ situations: ["planning"] }).unreleased).toBe(true);
    expect(roleDefaults({ situations: ["released", "planning"] }).unreleased).toBe(false);
    expect(roleDefaults({ situations: ["writer"], roles: ["Songwriter"] }).unreleased).toBe(false);
  });
  it("asks about beats only of a producer who says they sell them", () => {
    expect(sellsBeats({ roles: ["Producer"], sellBeats: true })).toBe(true);
    expect(sellsBeats({ roles: ["Producer"] })).toBe(false);
    expect(sellsBeats({ roles: ["Recording artist"], sellBeats: true })).toBe(false);
  });
  it("applies the defaults to blanks only", () => {
    const m = emptyMetadata();
    expect(withRoleDefaults(m, { roles: ["Songwriter"] }).recordingSide).toBe("external");
    expect(withRoleDefaults({ ...m, recordingSide: "own" }, { roles: ["Songwriter"] }).recordingSide).toBe("own");
    expect(withRoleDefaults({ ...m, unreleased: false }, { situations: ["planning"] }).unreleased).toBe(true);
  });
});
