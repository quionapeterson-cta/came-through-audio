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
    expect(await screen.findByText("Who wrote what?")).toBeTruthy();
    // Nothing is preselected: the list never said, so the member answers.
    expect(screen.getByRole("button", { name: "Author" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Composer" }));
    fireEvent.click(screen.getByRole("button", { name: /Add 1 song/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveTrack).mock.calls[0]![0].writers[0]!.role).toBe("Composer");
  });

  it("files the new songs into the release the member picks", async () => {
    vi.mocked(saveTrack).mockClear();
    render(<AgencyLists userId="u1" societies={[ascap]} songsFor={() => []} summaries={{}} onApply={vi.fn().mockResolvedValue(undefined)} />);
    const file = new File(["Work Title,Writer Name,Share\nGold Teeth,RAY BO,100\nAmber,RAY BO,100\n"], "ascap.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Upload your ASCAP list"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Fill my catalog/ }));
    expect(await screen.findByText("2 of 2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /They all belong to one release/ }));
    fireEvent.change(screen.getByLabelText("Release type"), { target: { value: "EP" } });
    fireEvent.change(screen.getByLabelText("Release title"), { target: { value: "Bloom" } });
    fireEvent.click(screen.getByRole("button", { name: /Add 2 songs/ }));
    await waitFor(() => expect(vi.mocked(saveTrack)).toHaveBeenCalledTimes(2));
    for (const call of vi.mocked(saveTrack).mock.calls) {
      expect(call[0].releaseType).toBe("EP");
      expect(call[0].album).toBe("Bloom");
    }
  });
});
