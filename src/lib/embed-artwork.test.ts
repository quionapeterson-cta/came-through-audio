import { describe, expect, it } from "vitest";
import { artworkChoice, coverFile, FILE_ART_IGNORED } from "@/lib/embed-artwork";

// A real 1×1 png, so the decode is exercised and not just the prefix.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("artworkChoice", () => {
  it("keeps the member's cover when the audio file carries one too", () => {
    expect(artworkChoice(true, true)).toBe("keep-chosen");
  });

  it("takes the file's own picture only when nothing has been chosen", () => {
    expect(artworkChoice(false, true)).toBe("use-file");
  });

  it("has nothing to do when the file carries no picture", () => {
    expect(artworkChoice(false, false)).toBe("none");
    expect(artworkChoice(true, false)).toBe("keep-chosen");
  });

  it("says the file's art was passed over, in words a member reads", () => {
    expect(FILE_ART_IGNORED).toMatch(/ignored/);
    expect(FILE_ART_IGNORED).toMatch(/your cover/i);
  });
});

describe("coverFile", () => {
  it("brings a remembered cover back as the file that goes into the master", () => {
    const file = coverFile(TINY_PNG);
    expect(file).toBeInstanceOf(File);
    expect(file!.type).toBe("image/png");
    expect(file!.name).toBe("cover.png");
    expect(file!.size).toBeGreaterThan(0);
  });

  it("keeps a jpeg named .jpg", () => {
    const file = coverFile("data:image/jpeg;base64,/9j/4AAQ", "cover.jpg");
    expect(file!.name).toBe("cover.jpg");
    expect(file!.type).toBe("image/jpeg");
  });

  it("returns nothing for anything that isn't an image, so a corrupt entry never reaches the form", () => {
    expect(coverFile("not-an-image")).toBeUndefined();
    expect(coverFile("data:text/plain;base64,AAAA")).toBeUndefined();
    expect(coverFile("data:image/png;base64,@@@@")).toBeUndefined();
    expect(coverFile("data:image/png;base64,")).toBeUndefined();
  });
});
