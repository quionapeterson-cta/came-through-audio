import { describe, expect, it } from "vitest";
import { groupReleaseStatus, releaseDraft, releasePatch, releaseStatus, statusWords, writeRelease, type ReleaseDraft, type SongRelease } from "@/lib/release-panel";

const ON = "2026-11-09";
const song = (patch: Partial<SongRelease> = {}): SongRelease => ({ releaseType: "Single", album: "", releaseDate: "", unreleased: false, ...patch });
const patched = (d: ReleaseDraft) => { const r = releasePatch(d, ON); if ("error" in r) throw new Error(r.error); return r.patch; };
const refused = (d: ReleaseDraft) => { const r = releasePatch(d, ON); return "error" in r ? r.error : ""; };

describe("release status", () => {
  it("reads a past date as out, a future date as scheduled and the box as not out yet", () => {
    expect(releaseStatus(song({ releaseDate: "2026-11-01" }), ON)).toBe("released");
    expect(releaseStatus(song({ releaseDate: "2027-03-01" }), ON)).toBe("scheduled");
    expect(releaseStatus(song({ unreleased: true }), ON)).toBe("unreleased");
    // A blank date with an unticked box has always meant released, and still does.
    expect(releaseStatus(song(), ON)).toBe("released");
    expect(statusWords(song({ releaseDate: "2027-03-01" }), ON)).toBe("Scheduled for 2027-03-01");
  });
  it("says N of M out while a release is coming out, and the date only when they all share it", () => {
    expect(groupReleaseStatus([song({ releaseDate: "2026-11-01" }), song({ unreleased: true })], ON).label).toBe("1 of 2 out");
    expect(groupReleaseStatus([song({ releaseDate: "2027-03-01" })]).label).toBe("Scheduled for 2027-03-01");
    expect(groupReleaseStatus([song({ releaseDate: "2026-11-01" })]).label).toBe("Released");
    expect(groupReleaseStatus([song({ unreleased: true })]).label).toBe("Not released yet");
  });
  it("won't guess a status for a release that is part out", () => {
    const draft = releaseDraft([song({ releaseDate: "2026-11-01" }), song({ unreleased: true })]);
    expect(draft.status).toBe("");
    // The one real date is shown, never a blank that would erase it on Save.
    expect(draft.releaseDate).toBe("2026-11-01");
    expect(refused({ ...draft, releaseType: "Single", album: "" })).toBe("Choose the release's status.");
  });
  it("opens the dialog on the group's own fields", () => {
    expect(releaseDraft([song({ releaseType: "EP", album: "Bloom", releaseDate: "2027-03-01" })]))
      .toEqual({ releaseType: "EP", album: "Bloom", releaseDate: "2027-03-01", releaseVersion: "", catalogNumber: "", status: "scheduled" });
  });
});

describe("the Release panel's answer", () => {
  it("sets the date and the box together, so the status can't contradict the fields", () => {
    expect(patched({ releaseType: "EP", album: "Bloom", releaseDate: "2027-03-01", status: "scheduled" }))
      .toEqual({ releaseType: "EP", album: "Bloom", releaseDate: "2027-03-01", unreleased: false, releaseVersion: "", catalogNumber: "" });
    expect(patched({ releaseType: "Single", album: "", releaseDate: "", status: "unreleased" }))
      .toEqual({ releaseType: "Single", album: "", releaseDate: "", unreleased: true, releaseVersion: "", catalogNumber: "" });
    expect(patched({ releaseType: "Single", album: "", releaseDate: "2026-10-01", status: "released" }))
      .toEqual({ releaseType: "Single", album: "", releaseDate: "2026-10-01", unreleased: false, releaseVersion: "", catalogNumber: "" });
  });
  it("carries the release's own version and catalog number to every song", () => {
    const draft = releaseDraft([song({ releaseVersion: "Deluxe", catalogNumber: "CTA-004" })]);
    expect(draft.releaseVersion).toBe("Deluxe");
    const patch = patched({ ...draft, status: "released" });
    expect(patch.releaseVersion).toBe("Deluxe");
    expect(patch.catalogNumber).toBe("CTA-004");
    // The dialog opens on the group's own values, so Save can never blank them by accident.
    expect(releaseDraft([song()])).toMatchObject({ releaseVersion: "", catalogNumber: "" });
  });
  it("refuses an answer the fields would contradict, in plain words", () => {
    expect(refused({ releaseType: "Single", album: "", releaseDate: "", status: "scheduled" })).toBe("Pick the release date, or choose Not released yet.");
    expect(refused({ releaseType: "Single", album: "", releaseDate: "2026-11-09", status: "scheduled" })).toBeTruthy();
    expect(refused({ releaseType: "Single", album: "", releaseDate: "2027-01-01", status: "released" })).toBeTruthy();
    expect(refused({ releaseType: "EP", album: "", releaseDate: "", status: "unreleased" })).toBe("An EP needs a release title.");
  });
});

describe("writing a release", () => {
  const songs = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }];

  it("writes every song when nothing fails", async () => {
    const written: string[] = [];
    await expect(writeRelease(songs, async (s) => { written.push(s.id); })).resolves.toEqual({ saved: songs });
    expect(written).toEqual(["a", "b", "c"]);
  });
  it("stops at the song that failed and says exactly how far it got", async () => {
    const written: string[] = [];
    const result = await writeRelease(songs, async (s) => { if (s.id === "b") throw new Error("network down"); written.push(s.id); });
    expect(written).toEqual(["a"]);
    expect(result.saved.map((s) => s.id)).toEqual(["a"]);
    expect(result.error).toBe("Saved 1 of 3 songs. B didn't save: network down. Press Save again to finish.");
  });
  it("names the song when the very first write fails", async () => {
    const result = await writeRelease(songs, async () => { throw new Error("permission denied."); });
    expect(result.saved).toEqual([]);
    expect(result.error).toBe("A didn't save: permission denied.");
  });
});
