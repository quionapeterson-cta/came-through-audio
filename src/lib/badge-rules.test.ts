import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_BADGES, BADGES, withArtist } from "@/lib/badges";
import { badgeMetrics, evaluateBadges, instrumentOf, localTime, type BadgeData } from "@/lib/badge-rules";
import { emptyMetadata, type Contributor, type Metadata } from "@/lib/metadata";

const writer = (legalName: string, role: string, percentage: string): Contributor => ({ name: legalName, legalName, role, pro: "", ipi: "", percentage });
let n = 0;
const track = (patch: Partial<Metadata> = {}, createdAt = "2026-10-20T15:00:00Z") => {
  const metadata = { ...emptyMetadata(), title: `Song ${++n}`, artist: "CTAudio", writers: [], composers: [], ...patch };
  return { id: `t${n}`, title: metadata.title, artist: metadata.artist, updatedAt: createdAt, createdAt, metadata };
};
const ready = (patch: Partial<Metadata> = {}, createdAt?: string) =>
  track({ writers: [writer("Ava Writer", "Author", "50"), writer("Ben Beats", "Composer", "50")], ...patch }, createdAt);
const data = (patch: Partial<BadgeData> = {}): BadgeData => ({
  tracks: [], splits: [], contracts: [], checks: [], certificates: [], events: { agency_export: 0, master_download: 0, blueprint_read: 0 },
  welcomed: false, names: [], accountCreatedAt: "2026-10-01T00:00:00Z", timeZone: "America/New_York", now: new Date("2026-10-21T00:00:00Z"), ...patch,
});

describe("badge catalog", () => {
  it("has unique ids", () => {
    expect(new Set(ALL_BADGES.map((b) => b.id)).size).toBe(ALL_BADGES.length);
  });
  it("only offers badges whose art is in the repo", () => {
    const missing = BADGES.filter((b) => !existsSync(`public${b.src}`)).map((b) => b.src);
    expect(missing).toEqual([]);
  });
  it("keeps badges waiting on art out of play", () => {
    expect(BADGES.some((b) => b.collection === "lyrics")).toBe(false);
    expect(ALL_BADGES.filter((b) => b.collection === "lyrics")).toHaveLength(8);
  });
  it("fills or drops the artist name in pop-ups", () => {
    expect(withArtist("This is huge, {artist}.", "Karma Came")).toBe("This is huge, Karma Came.");
    expect(withArtist("crown on, {artist}. You made history.", "")).toBe("crown on. You made history.");
  });
});

describe("instrument matching", () => {
  it.each([
    [{ role: "Backup vocalist" }, "vocals"],
    [{ role: "Session musician", instrument: "Electric guitar" }, "electric_guitar"],
    [{ role: "Session musician", instrument: "Guitar" }, "acoustic_guitar"],
    [{ role: "Session musician", instrument: "Ukulele" }, "ukulele"],
    [{ role: "Session musician", instrument: "Violoncello" }, "cello"],
    [{ role: "Session musician", instrument: "Violin" }, "violin"],
    [{ role: "Session musician", instrument: "Keys" }, "piano"],
    [{ role: "Session musician", instrument: "Steel drum" }, "steel_pan"],
    [{ role: "Session musician", instrument: "Drums" }, "drums"],
    [{ role: "Session musician", instrument: "Bass" }, undefined],
    [{ role: "Session musician", instrument: "" }, undefined],
  ])("%o → %s", (credit, id) => expect(instrumentOf(credit)).toBe(id));
});

describe("badge metrics", () => {
  it("counts songs, lyrics, stored masters and Registration Ready songs", () => {
    const m = badgeMetrics(data({ tracks: [ready({ lyrics: "la la" }), track({ lyrics: "  " }), track({ audioPath: "u/t/master.mp3" })] }));
    expect(m).toMatchObject({ songs: 3, lyrics: 1, masters: 1, ready: 1 });
  });

  it("counts night-shift saves in the user's own time zone", () => {
    // 02:30 UTC is 10:30 PM the evening before in New York.
    const evening = Array.from({ length: 5 }, (_, i) => track({}, `2026-10-21T02:${10 + i}:00Z`));
    const m = badgeMetrics(data({ tracks: [...evening, track({}, "2026-10-21T05:30:00Z"), track({}, "2026-10-21T09:00:00Z")] }));
    expect(m).toMatchObject({ marathonNights: 1, midnightEntries: 1, quietEntries: 1 });
    expect(localTime("2026-10-21T02:30:00Z", "Not/AZone")).toEqual({ date: "2026-10-21", hour: 2 });
  });

  it("counts fully signed split sheets on the user's own songs only", () => {
    const a = ready(), b = ready();
    const row = (catalogId: string, signedAt: string | null, isOwner = false, role = "Writer") => ({ catalogId, isOwner, role, signedAt });
    const m = badgeMetrics(data({
      tracks: [a, b],
      splits: [row(a.id, "x", true), row(a.id, "x"), row(a.id, "x"), row(a.id, "x", false, "Publisher"),
        row(b.id, "x", true), row(b.id, null), row("someone-else", "x"), row("someone-else", "x")],
    }));
    expect(m).toMatchObject({ splitsCreated: 2, splitsSigned: 1, signedSplits3: 1, signedSplits4: 0, collaboratorSigned: 1 });
  });

  it("adds signed split sheets and contracts together for Deal Maker", () => {
    const a = ready();
    const m = badgeMetrics(data({
      tracks: [a], splits: [{ catalogId: a.id, isOwner: true, role: "Writer", signedAt: "x" }],
      contracts: [{ status: "signed", parties: [] }, { status: "sent", parties: [] }, { status: "draft", parties: [] }],
    }));
    expect(m).toMatchObject({ contractsDrafted: 3, contractsSent: 2, contractsSigned: 1, deals: 2 });
  });

  it("finds Chain of Title songs: ready, splits at 100%, signed sheet and a timestamp", () => {
    const a = ready(), b = ready();
    const m = badgeMetrics(data({
      tracks: [a, b],
      splits: [a, b].map((t) => ({ catalogId: t.id, isOwner: true, role: "Writer", signedAt: "x" })),
      certificates: [{ catalogId: a.id, trackTitle: a.title, timestamped: true }],
    }));
    expect(m).toMatchObject({ chainOfTitle: 1, timestamped: 1, protected: 1 });
  });

  it("counts releases of 3+ tracks where every track is ready", () => {
    const album = [ready({ album: "Came Through" }), ready({ album: "came through " }), ready({ album: "Came Through" })];
    expect(badgeMetrics(data({ tracks: album }))["readyReleases"]).toBe(1);
    expect(badgeMetrics(data({ tracks: [...album, track({ album: "Came Through" })] }))["readyReleases"]).toBe(0);
  });

  it("matches the user's names in Produced by, and genres for the genre collections", () => {
    const m = badgeMetrics(data({
      names: ["Karma Came"],
      tracks: [
        track({ producers: [{ name: "karma came", pro: "", ipi: "", percentage: "" }], primaryGenre: "Hip-Hop/Rap" }),
        track({ producers: [{ name: "Someone Else", pro: "", ipi: "", percentage: "" }], secondaryGenre: "Spiritual Hip-Hop" }),
      ],
    }));
    expect(m).toMatchObject({ produced: 1, hiphop: 1, spiritual: 1 });
  });

  it("counts performer credits by instrument", () => {
    const m = badgeMetrics(data({ tracks: [track({ credits: [
      { role: "Session musician", name: "P1", instrument: "Piano" }, { role: "Session musician", name: "P2", instrument: "Keys" },
      { role: "Backup vocalist", name: "V", instrument: "" }, { role: "Mixing engineer", name: "E", instrument: "" },
    ] })] }));
    expect(m).toMatchObject({ "instrument:piano": 2, "instrument:vocals": 1, performerCredits: 3, vocalSongs: 1, fullBandSongs: 1 });
  });

  it("counts whole member years", () => {
    expect(badgeMetrics(data({ accountCreatedAt: "2024-10-01T00:00:00Z" }))["memberYears"]).toBe(2);
  });
});

describe("evaluateBadges", () => {
  it("earns a badge at its goal and repeats repeatable ones", () => {
    const s = evaluateBadges({ songs: 1, marathonNights: 3, memberYears: 0 });
    expect(s.find((x) => x.badge.id === "first_note")).toMatchObject({ earned: true, times: 1 });
    expect(s.find((x) => x.badge.id === "marathon")).toMatchObject({ earned: true, times: 3 });
    expect(s.find((x) => x.badge.id === "unbreakable")).toMatchObject({ earned: false, times: 0 });
  });
  it("skips badges staff switched off", () => {
    expect(evaluateBadges({ songs: 1 }, new Set(["first_note"])).some((x) => x.badge.id === "first_note")).toBe(false);
  });
});
