import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgencyLists } from "@/components/AgencyLists";
// jsdom's File has no text(); browsers do.
if (!File.prototype.text) File.prototype.text = function (this: File) { return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(this); }); };
import { emptyMetadata } from "@/lib/metadata";
import { saveTrack } from "@/lib/catalog";

vi.mock("@/lib/catalog", () => ({ saveTrack: vi.fn().mockResolvedValue(undefined) }));
import { countryByCode } from "@/lib/repertoires";

const ascap = countryByCode("US")!.societies.performance![0]!;
const track = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, title, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title, artist: "Q", composers: [],
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "ASCAP", ipi: "00123456789", percentage: "100" }], publishers: [], ...extra } });

describe("AgencyLists", () => {
  it("reads an uploaded list in the browser and hands back the comparison", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(<AgencyLists societies={[ascap]} songsFor={() => [track("a", "Midnight"), track("b", "Gold Teeth")]} summaries={{}} onApply={onApply} />);
    const file = new File(["Work Title,Writer Name,IPI,Share\nMidnight,LEE ANN,123456789,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    await waitFor(() => expect(onApply).toHaveBeenCalled(), { timeout: 3000 });
    const [, result, name] = onApply.mock.calls[0]!;
    expect(name).toBe("ascap.csv");
    expect(result.matched.map((m: { trackId: string }) => m.trackId)).toEqual(["a"]);
    expect(result.notListed.map((m: { trackId: string }) => m.trackId)).toEqual(["b"]);
    expect(await screen.findByText(/Confirmed · 1/)).toBeTruthy();
  });

  it("shows a free member what their list is missing, and offers the catalog instead of a dead end", async () => {
    const onUpgrade = vi.fn();
    render(<AgencyLists userId="u1" canCatalog={false} onUpgrade={onUpgrade} societies={[ascap]} songsFor={() => [track("a", "Midnight")]} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,IPI,Share\nGold Teeth,LEE ANN,,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    expect(await screen.findByText("What the list itself shows")).toBeTruthy();
    // ASCAP registers the composition, so its list is never told a recording code is missing (founder, 2026-11-05).
    expect(screen.queryAllByText(/No ISRC/)).toHaveLength(0);
    expect(screen.getAllByText(/no IPI number/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Save to my catalog/ }));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("shows the differences beside both versions, and fixes the catalog from the agency's", async () => {
    const onExpert = vi.fn();
    render(<AgencyLists userId="u1" onExpert={onExpert} societies={[ascap]} songsFor={() => [track("a", "Midnight")]} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nMidnight,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("Your catalog")).toBeTruthy();
    // The agency's name is a tag on its own header, so the two value columns line up (founder, 2026-11-15).
    expect(screen.getByText("The agency")).toBeTruthy();
    expect(screen.getAllByText("ASCAP").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/isn't on the agency's registration/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check that it's correct/)).toBeTruthy();
    // Keeping the catalog version is the default, and it offers the expert route instead of leaving the difference silent.
    fireEvent.click(screen.getByRole("button", { name: /Get expert help/ }));
    expect(onExpert).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Use the agency's version/ }));
    fireEvent.click(screen.getByRole("button", { name: /Update songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalled());
    const [meta, uid, id] = vi.mocked(saveTrack).mock.calls[0]!;
    expect((meta as { writers: { legalName: string }[] }).writers[0]!.legalName).toBe("RAY BO");
    expect(uid).toBe("u1");
    expect(id).toBe("a");
  });

  it("adds only the songs the member ticks, and says the file needs re-embedding", async () => {
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => [track("a", "Midnight", { audioPath: "u/a/master.mp3" })]} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nMidnight,RAY BO,100\nGold Teeth,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("1 of 1 selected")).toBeTruthy();
    // The one song without a master in the example is unticked before anything is written.
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("0 of 1 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Use the agency's version/ }));
    expect(screen.getByText(/Re-embed this song in My Catalog/)).toBeTruthy();
    vi.mocked(saveTrack).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Update songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveTrack).mock.calls[0]![2]).toBe("a");
  });

  it("asks for each writer's role while filling, and writes it into the songs", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("Who wrote what, and where does each song belong?")).toBeTruthy();
    // Nothing is preselected: the list never said, so the member answers — and the answer names the song it is about,
    // because the same person can be the author of one song and the composer of another (founder, 2026-11-15).
    expect(screen.getByRole("button", { name: "RAY BO on Gold Teeth: Author" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "RAY BO on Gold Teeth: Composer" }));
    fireEvent.click(screen.getByRole("button", { name: /Add 1 song/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveTrack).mock.calls[0]![0].writers[0]!.role).toBe("Composer");
  });

  it("asks the role song by song, so one writer can be the author of one and the composer of another", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,100\nSilver Teeth,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("Who wrote what, and where does each song belong?")).toBeTruthy();
    // Both songs are open to begin with, and each gets its own answer.
    fireEvent.click(screen.getByRole("button", { name: "RAY BO on Gold Teeth: Composer" }));
    fireEvent.click(screen.getByRole("button", { name: "RAY BO on Silver Teeth: Author" }));
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
    const roles = vi.mocked(saveTrack).mock.calls.map((c) => c[0].writers[0]!.role).sort();
    expect(roles).toEqual(["Author", "Composer"]);
  });

  it("files each new song where its own dropdown puts it, Unreleased by default", async () => {
    vi.mocked(saveTrack).mockClear();
    const album = track("album1", "One", { album: "BAM", releaseType: "Album" });
    const ep = track("ep1", "Two", { album: "Tape", releaseType: "EP" });
    const single = track("single1", "Loose", {});
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} allTracks={[album, ep, single]} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,100\nAmber,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("2 of 2 selected")).toBeTruthy();
    // The dropdown holds the catalog's own releases — singles, EPs and albums — then Unreleased and Instrumental.
    const gold = screen.getByLabelText("Release for Gold Teeth") as HTMLSelectElement;
    expect(gold.value).toBe("unreleased");
    expect([...gold.options].map((o) => o.textContent)).toEqual(["Loose", "Tape", "BAM", "Unreleased", "Instrumental", "Add a release…"]);
    expect([...gold.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Singles", "EPs", "Albums", "Not in my catalog"]);
    // One song to an album, one marked instrumental: each keeps its own answer.
    fireEvent.change(gold, { target: { value: "rel:BAM" } });
    fireEvent.change(screen.getByLabelText("Release for Amber"), { target: { value: "instrumental" } });
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
    const saved = vi.mocked(saveTrack).mock.calls.map((c) => c[0]);
    expect(saved.find((m) => m.title === "Gold Teeth")).toMatchObject({ album: "BAM", releaseType: "Album" });
    expect(saved.find((m) => m.title === "Amber")).toMatchObject({ instrumental: true });
    expect(saved.find((m) => m.title === "Amber")!.album).toBe("");
  });

  it("asks the release in the same card as the writers, and remembers a release typed by hand for the next song", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,100\nAmber,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("Who wrote what, and where does each song belong?")).toBeTruthy();
    // The release sits in the same card as the song's writers, so one card answers both questions.
    const card = screen.getByLabelText("Release for Gold Teeth").closest("li")!;
    expect(card.textContent).toContain("RAY BO");
    // A release that isn't in the catalog yet: pick it, name it, and it is remembered for the next song.
    fireEvent.change(screen.getByLabelText("Release for Gold Teeth"), { target: { value: "new" } });
    fireEvent.change(screen.getByLabelText("Release type for Gold Teeth"), { target: { value: "EP" } });
    fireEvent.change(screen.getByLabelText("Release name for Gold Teeth"), { target: { value: "Afterglow" } });
    const amber = screen.getByLabelText("Release for Amber") as HTMLSelectElement;
    expect([...amber.options].map((o) => o.textContent)).toContain("Afterglow · EP");
    // The other song takes it in one pick instead of typing it again.
    fireEvent.change(amber, { target: { value: [...amber.options].find((o) => o.textContent === "Afterglow · EP")!.value } });
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
    for (const call of vi.mocked(saveTrack).mock.calls) {
      expect(call[0].album).toBe("Afterglow");
      expect(call[0].releaseType).toBe("EP");
    }
  });

  it("gives a writer on two songs their own open box, and shows every writer of each song in it", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,50\nGold Teeth,KAY LEE,50\nSilver Teeth,RAY BO,50\nSilver Teeth,ANN MAY,50\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    // The repeat writer is a box of their own, open with both of their songs in it.
    const box = await screen.findByRole("button", { name: "Hide the songs RAY BO is on" });
    expect(box.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("Gold Teeth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Silver Teeth").length).toBeGreaterThan(0);
    // The other writer on each song is there too, even one who is on nothing else in the list.
    expect(screen.getByRole("button", { name: "ANN MAY on Silver Teeth: Author" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "RAY BO on Silver Teeth: Author" })).toBeTruthy();
    // Each song shows all of its writers, so a co-writer is answered without leaving the song.
    fireEvent.click(screen.getByRole("button", { name: "KAY LEE on Gold Teeth: Composer" }));
    // And every song answers where it belongs, from its own dropdown, before anything is chosen.
    expect(screen.getByLabelText("Release for Gold Teeth")).toBeTruthy();
    expect(screen.getByLabelText("Release for Silver Teeth")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
    const gold = vi.mocked(saveTrack).mock.calls.map((c) => c[0]).find((m) => m.title === "Gold Teeth")!;
    expect(gold.writers.find((w) => w.legalName === "KAY LEE")?.role).toBe("Composer");
    expect(gold.writers.find((w) => w.legalName === "RAY BO")?.role).toBe("");
  });

  it("answers every duplicate at once when the member takes the agency's version for all", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => [track("a", "Midnight"), track("b", "Gold Teeth")]} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nMidnight,RAY BO,100\nGold Teeth,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Use the agency's version for all 2/ }));
    expect((screen.getAllByRole("radio", { name: /Use the agency's version/ })[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByRole("radio", { name: /Use the agency's version/ })[1] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Update songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
  });
});
