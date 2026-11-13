import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DifferencesChart } from "@/components/DifferencesChart";
import { buildDifferenceRows, type DifferenceRow } from "@/lib/discrepancy-treatments";
import { emptyMetadata, type Metadata } from "@/lib/metadata";

/**
 * The card's Zone 2 (founder, 2026-11-14): Title, Version, Artist and ISRC on both sides, so a card whose title and
 * code match still shows the field that actually disagrees — and a card whose sides are identical is never drawn.
 */
const catTrack = (title: string, extra: Partial<Metadata>) => ({
  id: "a", title, artist: "Karma Came", updatedAt: "",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", writers: [], composers: [], publishers: [], ...extra },
});
const work = (extra: Record<string, unknown>) => ({ title: "", iswc: "", isrc: "", workId: "", writers: [], ...extra });
const stored = (differences: unknown[]) => ({
  byId: { soundexchange: { file: "sx.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: differences.length, differences } } },
}) as never;

const versionRow = () => buildDifferenceRows({
  tracks: [catTrack("Bloodline", { isrc: "US-CTA-26-00111", version: "Radio edit", releaseDate: "2026-01-01" })],
  stored: stored([{
    trackId: "a", title: "Bloodline",
    work: work({ title: "Bloodline (Clean Version)", coreTitle: "Bloodline", version: "Clean Version", artist: "KARMA CAME", isrc: "US-CTA-26-00111" }),
    issues: ['The agency has version "Clean Version", your catalog has "Radio edit" — same title, two versions of the recording'],
  }]),
});

describe("DifferencesChart", () => {
  const renderRow = (row: DifferenceRow) => render(
    <DifferencesChart rows={[row]} onFixCatalog={vi.fn()} onAdopt={vi.fn()} onKeepBoth={vi.fn()} onSaveAlternate={() => {}} />,
  );

  it("shows the version that disagrees, beside the title, artist and ISRC each side holds", () => {
    const row = versionRow()[0]!;
    renderRow(row);
    // Both sides carry the four fields, so nothing has to be guessed from a tag.
    expect(screen.getAllByText("Title")).toHaveLength(2);
    expect(screen.getAllByText("Version")).toHaveLength(2);
    expect(screen.getAllByText("Artist")).toHaveLength(2);
    expect(screen.getAllByText("ISRC")).toHaveLength(2);
    // The version the agency names, and the one the catalog keeps: read, not invented.
    // Codes and versions are drawn in segments, so the card is read as its whole text.
    const text = () => document.body.textContent ?? "";
    expect(text()).toContain("Clean Version");
    expect(text()).toContain("Radio edit");
    expect(text()).toContain("KARMA CAME");
    expect(text()).toContain("Karma Came");
    expect(screen.getByText("Version difference")).toBeTruthy();
    expect(screen.getByText("Add the version")).toBeTruthy();
  });

  it("draws no card at all when the two sides read the same recording", () => {
    const rows = buildDifferenceRows({
      tracks: [catTrack("AM PM", { isrc: "QT6HX2656773", releaseDate: "2026-01-01" })],
      stored: stored([{
        trackId: "a", title: "AM PM",
        work: work({ title: "AM PM", isrc: "QT6HX2656773" }),
        issues: ['The agency calls it "AM PM", your catalog has "AM PM" — same recording, different name'],
      }]),
    });
    expect(rows).toHaveLength(0);
  });

  it("lists a second code under one title as another version to add, never a details mismatch", () => {
    const row = buildDifferenceRows({
      tracks: [catTrack("Big Swag", { isrc: "QZNMY2291720", releaseDate: "2026-01-01" })],
      stored: stored([
        { trackId: "a", title: "Big Swag", work: work({ title: "Big Swag", isrc: "QZNMY2291720" }), issues: [] },
        { trackId: "a", title: "Big Swag", work: work({ title: "Big Swag", isrc: "QZNMY2291727" }),
          issues: ['The agency holds a second ISRC for "Big Swag": QZNMY2291727, beside QZNMY2291720 — one title, 2 codes'] },
      ]),
    })[0]!;
    renderRow(row);
    expect(screen.getByText("Same title / different ISRC")).toBeTruthy();
    expect(screen.getByText("+ Add Version to Catalog")).toBeTruthy();
    // Both codes are on the card, so the second recording is visible rather than buried in a tag.
    const text = () => document.body.textContent ?? "";
    expect(text()).toContain("QZNMY2291727");
    expect(text()).toContain("QZNMY2291720");
    expect(screen.queryByText(/The details differ/)).toBeNull();
  });

  it("shows a title holding two codes as two versions, with Add Version and the agency's sign-in page", () => {
    const pairStored = {
      byId: { soundexchange: { file: "sx.csv", result: { differences: [], clashes: [], notListed: [], extra: [], works: 2, matched: [
        { trackId: "a", title: "AM PM", work: { title: "AM PM", iswc: "", isrc: "QT6HX2656773", workId: "", writers: [] }, issues: [] },
        { trackId: "b", title: "AM PM", work: { title: "AM PM", iswc: "", isrc: "QT6HX2656774", workId: "", writers: [] }, issues: [] },
      ] } } },
    } as never;
    const rows = buildDifferenceRows({
      tracks: [catTrack("AM PM", { isrc: "QT6HX2656773", releaseDate: "2026-01-01" }), { ...catTrack("AM PM", { isrc: "QT6HX2656774", releaseDate: "2026-01-01" }), id: "b" }],
      stored: pairStored,
    });
    const row = rows.find((r) => r.kind === "version-pair")!;
    renderRow(row);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Two versions of this title");
    expect(text).toContain("Name each version of this title");
    expect(text).toContain("+ Add Version to Catalog");
    // The sign-in names what the member goes there to do (founder, 2026-11-15).
    expect(text).toContain("Sign in and submit recording");
    expect(text).toContain("QT6HX2656774");
  });

  it("draws Copy ISRC & Check Repertoire once, however many differences list it", () => {
    // Two differences on one recording, both settled by the same check: the card's own button is the only one.
    const rows = buildDifferenceRows({
      tracks: [catTrack("Bloodline", { isrc: "US-CTA-26-00111", releaseDate: "2026-01-01" })],
      stored: stored([
        { trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", isrc: "GBSMU2963386" }), issues: ["The agency has ISRC GBSMU2963386, your catalog has US-CTA-26-00111"] },
        { trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", isrc: "GBSMU2963386" }), issues: ["The agency lists a second ISRC for \"Bloodline\": QZ85M1938225"] },
      ]),
    });
    const row = rows[0]!;
    expect(row.fixes.length).toBeGreaterThan(1);
    renderRow(row);
    const text = () => document.body.textContent ?? "";
    expect(text().split("Copy ISRC & Check Repertoire").length - 1).toBe(1);
  });

  it("draws a BMI card with the work's fields, one writer-name search and no code at all", () => {
    // A PRO registers the composition (founder, 2026-11-14): Title, ISWC and Writers, and no ISRC row to fill in.
    const rows = buildDifferenceRows({
      tracks: [catTrack("Bloodline", { iswc: "T1111111111" })],
      societies: [{ id: "bmi", name: "BMI" }],
      stored: ({
        byId: { bmi: { file: "bmi.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: 1, differences: [
          { trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", iswc: "T1234567890", writers: [{ name: "Ann Lee", share: 100 }] }), issues: ["The agency has ISWC T1234567890, your catalog has T1111111111"] },
          { trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", iswc: "T1234567890", writers: [{ name: "LEE ANN", share: 100 }] }), issues: ["The agency has LEE ANN where your catalog has Ann Lee — same writer, fix the spelling so both records match"] },
          { trackId: "a", title: "Bloodline", work: work({ title: "Bloodline", iswc: "T1234567890", writers: [{ name: "STEPHENS CALVIN", share: 100 }] }), issues: ["The agency has STEPHENS CALVIN where your catalog has Calvin Stephens — same writer, fix the spelling so both records match"] },
        ] } } },
      }) as never,
    });
    renderRow(rows[0]!);
    const text = () => document.body.textContent ?? "";
    expect(screen.getAllByText("Title")).toHaveLength(2);
    expect(screen.getAllByText("ISWC")).toHaveLength(2);
    expect(screen.getAllByText("Writers")).toHaveLength(2);
    expect(screen.queryByText("ISRC")).toBeNull();
    expect(screen.queryByText("Version")).toBeNull();
    expect(text()).not.toContain("Copy ISRC");
    // A PRO's repertoire finds the work by the writer's name, and only one check is offered (founder, 2026-11-15).
    expect(text()).toContain("Copy Writer Name & Check BMI");
    expect(text()).toContain("Ann Lee");
    expect(text()).not.toContain("+ Add Version to Catalog");
    const count = (label: string) => text().split(label).length - 1;
    // The society sits on the agency header, not above the values, so the two sides line up row for row.
    expect(screen.getByText("BMI")).toBeTruthy();
    // Two writers whose names differ from the registration are one rule, written once, with both cases named under it.
    expect(count("Match the writer's full registered name")).toBe(1);
    expect(text()).toContain("The agency has LEE ANN where your catalog has Ann Lee");
    expect(text()).toContain("The agency has STEPHENS CALVIN where your catalog has Calvin Stephens");
    // One check for the agency, however many differences the card lists, and one sign-in (founder, 2026-11-15): a title
    // check and an ISWC check were two BMI searches on one card.
    expect(count("Copy Writer Name & Check BMI")).toBe(1);
    expect(text()).not.toContain("Copy ISWC");
    expect(count("Sign in and register the work")).toBe(1);
    // The one thing members get wrong: the name has to match the registration exactly.
    expect(count("Repertoire search matches the writer's name exactly as it was registered")).toBe(1);
  });

  it("offers to keep the agency's own name as an alternate title, beside the one check", () => {
    const rows = buildDifferenceRows({
      tracks: [{ ...catTrack("24/7 Love", { iswc: "T9187370996" }), metadata: { ...catTrack("24/7 Love", {}).metadata, title: "24/7 Love", iswc: "T9187370996" } }],
      societies: [{ id: "bmi", name: "BMI" }],
      stored: ({
        byId: { bmi: { file: "bmi.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: 1, differences: [
          { trackId: "a", title: "24/7 Love", work: work({ title: "TWENTY FOUR SEVEN" }), issues: ['The agency registers this work as "TWENTY FOUR SEVEN", your catalog says "24/7 Love" — a work is found by its registered title, so the two names have to match or yours has to be saved as an alternate title'] },
        ] } } },
      }) as never,
    });
    const row = rows[0]!;
    expect(row.kind).toBe("alternate-title");
    expect(row.alternateTitle).toBe("TWENTY FOUR SEVEN");
    renderRow(row);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Alternate Title? Fix in Catalog");
    expect(text).toContain("Save as Alternate Title");
    expect(text.split("Copy Writer Name & Check BMI").length - 1).toBe(1);
  });

  it("never lists the agency's check under the differences as well as on the card", () => {
    // Two differences on the alternate-title card: the title, and an ISWC that disagrees. The check is one button,
    // whichever of them is listed first (founder, 2026-11-15).
    const rows = buildDifferenceRows({
      tracks: [catTrack("24/7 Love", { iswc: "T9187370996" })],
      societies: [{ id: "bmi", name: "BMI" }],
      stored: ({
        byId: { bmi: { file: "bmi.csv", result: { matched: [], clashes: [], notListed: [], extra: [], works: 1, differences: [
          { trackId: "a", title: "24/7 Love", work: work({ title: "TWENTY FOUR SEVEN", iswc: "T1234567890" }), issues: ['The agency registers this work as "TWENTY FOUR SEVEN", your catalog says "24/7 Love" — a work is found by its registered title, so the two names have to match or yours has to be saved as an alternate title', "The agency has ISWC T1234567890, your catalog has T9187370996"] },
        ] } } },
      }) as never,
    });
    renderRow(rows[0]!);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Save as Alternate Title");
    expect(text.split("Copy Writer Name & Check BMI").length - 1).toBe(1);
  });

  it("folds a song away to its title, and opens it again", () => {
    renderRow(versionRow()[0]!);
    expect(screen.getAllByText("ISRC")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Hide Bloodline$/ }));
    // Folded: the title and its pills stay, everything that was being compared is put away.
    expect(screen.queryByText("ISRC")).toBeNull();
    expect(screen.getByText("Bloodline")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Show Bloodline$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Show Bloodline$/ }));
    expect(screen.getAllByText("ISRC")).toHaveLength(2);
  });
});
