import { describe, expect, it } from "vitest";
import { coverExtension } from "@/lib/pull-cover";

describe("a pulled cover", () => {
  it("keeps the format the catalog can read back", () => {
    expect(coverExtension("image/png")).toBe("png");
    expect(coverExtension("image/jpeg")).toBe("jpg");
    // Anything else never reaches storage: `coverFileFrom` refuses a type the catalog can't show.
    expect(coverExtension("image/webp")).toBe("jpg");
  });
});
