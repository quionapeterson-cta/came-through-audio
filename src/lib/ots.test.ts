import { describe, expect, it } from "vitest";
import { buildOtsFile } from "./ots";

describe("buildOtsFile", () => {
  it("prefixes the OpenTimestamps header, version, sha256 op and digest", () => {
    const digest = "ab".repeat(32);
    const f = buildOtsFile(digest, btoa("\xf0\x01"));
    expect(f.length).toBe(31 + 2 + 32 + 2);
    expect(f[31]).toBe(0x01);
    expect(f[32]).toBe(0x08);
    expect(f[33]).toBe(0xab);
    expect(f[f.length - 2]).toBe(0xf0);
  });
});
