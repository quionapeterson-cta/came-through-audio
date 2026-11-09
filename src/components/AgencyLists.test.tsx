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
const track = (id: string, title: string) => ({ id, title, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title, artist: "Q", composers: [],
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "ASCAP", ipi: "00123456789", percentage: "100" }], publishers: [] } });

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
    expect(screen.getAllByText(/No ISRC/).length).toBeGreaterThan(0);
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
    expect(screen.getByText("The agency (ASCAP)")).toBeTruthy();
    expect(screen.getAllByText(/isn't on the agency's registration/).length).toBeGreaterThan(0);
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
});
