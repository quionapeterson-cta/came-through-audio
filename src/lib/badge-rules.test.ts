import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_BADGES, BADGES, badgeById, nextGoal, timesEarned, withArtist } from "@/lib/badges";
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
    expect(BADGES.filter((b) => b.collection === "lyrics")).toHaveLength(8);
    expect(ALL_BADGES.filter((b) => b.artPending).map((b) => b.id).sort())
      .toEqual(["full_album", "full_ep", "unbreakable_2", "unbreakable_3", "unbreakable_4", "unbreakable_5"]);
  });
  it("only offers art choices that exist", () => {
    for (const b of ALL_BADGES) for (const c of b.choices ?? []) expect(existsSync(`public${c}`)).toBe(true);
  });
  it("places live-musician art at its step: cobalt at 1 (again every 5), medallion at 10, star-studded at 25", () => {
    expect(badgeById("live_vocals_1")).toMatchObject({ goal: 1, every: 5 });
    expect(badgeById("live_steel_pan_1")).toBeUndefined();
    expect(badgeById("live_steel_pan_10")?.src).toContain("medallion");
    expect(badgeById("live_steel_pan_25")?.src).toContain("star_studded");
    expect(badgeById("live_cello_25")?.src).toContain("star_studded_cello");
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
    expect(m).toMatchObject({ marathonNights: 1, midnightNights: 1, quietMornings: 1 });
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
    expect(m).toMatchObject({ splitsCreated: 2, splitsSigned: 1, signedSplits3: 1, signedSplits4: 0, collaboratorSigned: 1, signaturesReceived: 3 });
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

  it("counts every signature from someone else on the user's split sheets and contracts", () => {
    const a = ready();
    const m = badgeMetrics(data({
      tracks: [a],
      splits: [{ catalogId: a.id, isOwner: true, role: "Writer", signedAt: "x" }, { catalogId: a.id, isOwner: false, role: "Writer", signedAt: "x" }],
      contracts: [{ status: "signed", parties: [{ isOwner: true, signedAt: "x" }, { isOwner: false, signedAt: "x" }, { isOwner: false, signedAt: null }] }],
    }));
    expect(m["signaturesReceived"]).toBe(2);
  });

  it("counts full EPs (4 to 6 songs) and albums (8+), using the track totals when entered", () => {
    const project = (name: string, n: number, total = "", ext = "mp3") => Array.from({ length: n }, (_, i) => track({ album: name, trackTotal: total, audioPath: `u/${name}/${i}.${ext}` }));
    const m = badgeMetrics(data({ tracks: [...project("EP", 5), ...project("Half", 4, "10"), ...project("LP", 8, "", "wav"), ...project("Seven", 7)] }));
    expect(m).toMatchObject({ fullEps: 1, fullAlbums: 1, masterCrowns: 1 });
    expect(badgeMetrics(data({ events: { agency_export: 0, master_download: 2, blueprint_read: 0 } }))["masterCrowns"]).toBe(1);
  });

  it("counts self-produced Ready songs: the track's artist is also in Produced by", () => {
    const m = badgeMetrics(data({ tracks: [
      ready({ artist: "Karma Came", producers: [{ name: "karma came", pro: "", ipi: "", percentage: "" }] }),
      track({ artist: "Karma Came", producers: [{ name: "Karma Came", pro: "", ipi: "", percentage: "" }] }),
      ready({ artist: "Karma Came", producers: [{ name: "Someone Else", pro: "", ipi: "", percentage: "" }] }),
    ] }));
    expect(m["selfProduced"]).toBe(1);
  });

  it("counts health-check months, not checks", () => {
    const check = (checkedAt: string) => ({ trackId: "t", society: "BMI", status: "found" as const, source: "self" as const, checkedAt });
    const m = badgeMetrics(data({ checks: [check("2026-09-02T12:00:00Z"), check("2026-09-20T12:00:00Z"), check("2026-10-01T12:00:00Z")] }));
    expect(m["healthCheckMonths"]).toBe(2);
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
  it("repeats from the goal by each step", () => {
    expect([0, 1, 4, 5, 10].map((c) => timesEarned({ goal: 1, every: 5 }, c))).toEqual([0, 1, 1, 2, 3]);
    expect([99, 100, 199, 200].map((c) => timesEarned({ goal: 100, every: 100 }, c))).toEqual([0, 1, 1, 2]);
    expect([4, 5, 10].map((c) => timesEarned({ goal: 5, every: 5 }, c))).toEqual([0, 1, 2]);
    expect(timesEarned({ goal: 10 }, 50)).toBe(1);
    expect(nextGoal({ goal: 100, every: 100 }, 130)).toBe(200);
    expect(nextGoal({ goal: 1, every: 5 }, 3)).toBe(5);
  });
  it("gives Positive Vibes for every spiritual track and Encourager every 5", () => {
    const s = evaluateBadges({ spiritual: 11 });
    expect(s.find((x) => x.badge.id === "positive_vibes")?.times).toBe(11);
    expect(s.find((x) => x.badge.id === "encourager")?.times).toBe(2);
  });
  it("skips badges staff switched off", () => {
    expect(evaluateBadges({ songs: 1 }, new Set(["first_note"])).some((x) => x.badge.id === "first_note")).toBe(false);
  });
});
