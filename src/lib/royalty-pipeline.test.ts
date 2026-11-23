import { describe, expect, it } from "vitest";
import type { MissingItem } from "@/lib/readiness";
import {
  PIPELINE_SHARES,
  pipelineBuckets,
  pipelineState,
  recoupmentTargets,
  soundExchangeMath,
} from "./royalty-pipeline";

const ipiGap: MissingItem = {
  code: "ipi",
  message: "Add the IPI name number for Ann Lee.",
  field: "writers-0-ipi",
};

describe("royalty pipeline", () => {
  it("splits the stream pool 80 / 10 / 10 and keeps each side's catalogue share", () => {
    expect(PIPELINE_SHARES.master).toBeCloseTo(0.8, 9);
    expect(PIPELINE_SHARES.pro).toBeCloseTo(0.1, 9);
    expect(PIPELINE_SHARES.mlc).toBeCloseTo(0.1, 9);
    const [master, pro, mlc] = pipelineBuckets({ pool: 400, masterShare: 100, songShare: 100 });
    expect(master!.pool).toBeCloseTo(320, 6);
    expect(master!.yours).toBeCloseTo(320, 6);
    expect(pro!.yours).toBeCloseTo(40, 6);
    expect(mlc!.yours).toBeCloseTo(40, 6);
  });

  it("follows the member's own master and song shares", () => {
    const [master, pro, mlc] = pipelineBuckets({ pool: 400, masterShare: 50, songShare: 25 });
    expect(master!.yours).toBeCloseTo(160, 6);
    expect(pro!.yours).toBeCloseTo(10, 6);
    expect(mlc!.yours).toBeCloseTo(10, 6);
  });

  it("clamps a share outside 0-100 and an empty pool", () => {
    const buckets = pipelineBuckets({ pool: -50, masterShare: 140, songShare: -10 });
    expect(buckets.every((bucket) => bucket.yours === 0)).toBe(true);
    const [master] = pipelineBuckets({ pool: 100, masterShare: 250, songShare: 0 });
    expect(master!.yours).toBeCloseTo(80, 6);
  });
});

describe("SoundExchange", () => {
  it("uses the published per-performance rate and the statutory 45/50 split", () => {
    const sx = soundExchangeMath({ plays: 1000, rate: 0.0025, masterShare: 100 });
    expect(sx.gross).toBeCloseTo(2.5, 9);
    expect(sx.share).toBeCloseTo(0.95, 9);
    expect(sx.yours).toBeCloseTo(2.375, 9);
  });

  it("pays only the share of the master the member owns", () => {
    const sx = soundExchangeMath({ plays: 1000, rate: 0.0025, masterShare: 50 });
    expect(sx.yours).toBeCloseTo(1.1875, 9);
  });

  it("counts nothing twice and survives an empty entry", () => {
    const sx = soundExchangeMath({ plays: Number.NaN, rate: 0.0025, masterShare: 100 });
    expect(sx.plays).toBe(0);
    expect(sx.yours).toBe(0);
  });
});

describe("pipeline registration state", () => {
  it("keeps an empty bucket quiet", () => {
    expect(pipelineState({ agency: "The MLC", pool: 0, registered: false, gaps: [] }).kind).toBe(
      "empty",
    );
  });

  it("calls unregistered money black box", () => {
    const stage = pipelineState({ agency: "The MLC", pool: 40, registered: false, gaps: [] });
    expect(stage.kind).toBe("waiting");
    expect(stage.note).toContain("The MLC");
  });

  it("flags a registered bucket whose catalog no longer matches", () => {
    const stage = pipelineState({
      agency: "ASCAP",
      pool: 40,
      registered: true,
      gaps: [ipiGap],
    });
    expect(stage.kind).toBe("mismatch");
    expect(stage.note).toContain("Add the IPI name number for Ann Lee.");
  });

  it("only calls money collected once both halves are true", () => {
    expect(pipelineState({ agency: "ASCAP", pool: 40, registered: true, gaps: [] }).kind).toBe(
      "collected",
    );
  });
});

describe("recoupment targets", () => {
  it("turns a project cost into streams and shirts at the member's own numbers", () => {
    const targets = recoupmentTargets({
      cost: 500,
      streamCut: 80,
      spotifyRate: 0.004,
      appleRate: 0.0085,
      merchProfit: 21,
    });
    expect(targets.spotify).toBe(156250);
    expect(targets.apple).toBe(73530);
    expect(targets.merch).toBe(24);
  });

  it("never divides by a cut or a margin that is not there", () => {
    const targets = recoupmentTargets({
      cost: 500,
      streamCut: 0,
      spotifyRate: 0.004,
      appleRate: 0.0085,
      merchProfit: 0,
    });
    expect(targets).toEqual({ spotify: null, apple: null, merch: null });
  });

  it("asks for no streams when there is nothing to recoup", () => {
    const targets = recoupmentTargets({
      cost: 0,
      streamCut: 80,
      spotifyRate: 0.004,
      appleRate: 0.0085,
      merchProfit: 21,
    });
    expect(targets.spotify).toBe(0);
    expect(targets.merch).toBe(0);
  });
});
