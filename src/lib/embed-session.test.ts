import { describe, expect, it } from "vitest";
import { fileNumber, orderFiles } from "@/lib/embed-session";

const f = (name: string, tag = Infinity) => ({ name, tag });

describe("album file order", () => {
  it("reads the first number in a file name", () => {
    expect(fileNumber("03 - Bloodline.mp3")).toBe(3);
    expect(fileNumber("Track 12 BAM.mp3")).toBe(12);
    expect(fileNumber("Therapy.mp3")).toBe(Infinity);
    expect(fileNumber("Song.mp3")).toBe(Infinity);
  });

  it("puts tag track numbers first, then file-name numbers, then names", () => {
    const files = [f("Zeta.mp3"), f("10 Outro.mp3"), f("2 Intro.mp3"), f("Alpha.mp3"), f("Hit.mp3", 1), f("Deep cut.mp3", 3)];
    expect(orderFiles(files, (x) => x.tag).map((x) => x.name)).toEqual(["Hit.mp3", "Deep cut.mp3", "2 Intro.mp3", "10 Outro.mp3", "Alpha.mp3", "Zeta.mp3"]);
  });

  it("sorts 2 before 10 even without tags", () => {
    expect(orderFiles([f("10.mp3"), f("2.mp3"), f("1.mp3")], (x) => x.tag).map((x) => x.name)).toEqual(["1.mp3", "2.mp3", "10.mp3"]);
  });
});
