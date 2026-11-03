import { describe, expect, it } from "vitest";
import {
  compositionCounts,
  matchCompositions,
  NO_LOOKUP,
  UNREGISTERED_DIAGNOSIS,
  type WorkLookup,
} from "./composition";
import { parseSearch } from "./composition.server";

const track = { isrc: "USAT22503785", title: "No Panic", artist: "Burna Boy" };

const lookup = (over: Partial<WorkLookup> & { find: WorkLookup["find"] }): WorkLookup => ({
  name: "The MLC",
  available: true,
  ...over,
});

describe("matchCompositions", () => {
  it("marks every work unverified when no composition source is configured, and asks nobody", async () => {
    let asked = 0;
    const inert: WorkLookup = {
      ...NO_LOOKUP,
      find: async () => {
        asked++;
        return null;
      },
    };
    const matches = await matchCompositions([track], inert);
    expect(matches[0]!.status).toBe("unverified");
    expect(matches[0]!.source).toBe("none");
    expect(matches[0]!.note).toMatch(/isn't active yet|MLC/i);
    expect(asked).toBe(0);
    expect(matches[0]!.work).toBeUndefined();
  });

  it("carries the registered writers when the work is on file", async () => {
    const work = {
      workId: "W-1",
      iswc: "T1234567890",
      writers: [{ name: "Burna Boy", ipi: "00123456789", pro: "ASCAP" }],
      publishers: [{ name: "Spaceship", ipi: "00987654321" }],
    };
    const matches = await matchCompositions([track], lookup({ find: async () => work }));
    expect(matches[0]).toMatchObject({ status: "matched", source: "mlc", isrc: "USAT22503785" });
    expect(matches[0]!.work?.writers[0]!.pro).toBe("ASCAP");
  });

  it("calls a work unregistered only when the search actually ran and found nothing", async () => {
    const matches = await matchCompositions([track], lookup({ find: async () => null }));
    expect(matches[0]!.status).toBe("unregistered");
    expect(matches[0]!.source).toBe("mlc");
    expect(UNREGISTERED_DIAGNOSIS).toBe(
      "Diagnosis: Unregistered Musical Work : Mechanical and Digital Performance Royalties Uncollected.",
    );
  });

  it("treats a failed lookup as unverified, never as a missing work", async () => {
    const matches = await matchCompositions(
      [track],
      lookup({
        find: async () => {
          throw new Error("timeout");
        },
      }),
    );
    expect(matches[0]!.status).toBe("unverified");
    expect(matches[0]!.status).not.toBe("unregistered");
    expect(matches[0]!.note).toMatch(/not missing/i);
  });

  it("counts each status", () => {
    expect(
      compositionCounts([
        { title: "a", artist: "x", status: "matched", source: "mlc", note: "" },
        { title: "b", artist: "x", status: "unregistered", source: "mlc", note: "" },
        { title: "c", artist: "x", status: "unverified", source: "none", note: "" },
      ]),
    ).toEqual({ total: 3, matched: 1, unregistered: 1, unverified: 1 });
  });
});

describe("parseSearch", () => {
  it("reads a work out of the response envelope", () => {
    const parsed = parseSearch({
      data: [
        {
          id: "W-1",
          iswc: "T123",
          writers: [{ name: "Burna Boy", ipi: "001", pro: "ASCAP" }],
          publishers: [{ name: "Spaceship" }],
        },
      ],
    });
    expect(parsed.kind).toBe("work");
    if (parsed.kind !== "work") return;
    expect(parsed.work.workId).toBe("W-1");
    expect(parsed.work.writers[0]!.pro).toBe("ASCAP");
    expect(parsed.work.publishers[0]!.name).toBe("Spaceship");
  });

  it("reports an empty result as empty, which is the only route to 'unregistered'", () => {
    expect(parseSearch({ data: [] }).kind).toBe("empty");
  });

  it("refuses to draw a conclusion from a shape it does not recognise", () => {
    expect(parseSearch({ unexpected: true }).kind).toBe("unknown");
    expect(parseSearch(null).kind).toBe("unknown");
    expect(parseSearch({ data: [{ somethingElse: 1 }] }).kind).toBe("unknown");
  });
});
