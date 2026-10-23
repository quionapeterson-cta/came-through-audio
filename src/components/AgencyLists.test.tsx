import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgencyLists } from "@/components/AgencyLists";
// jsdom's File has no text(); browsers do.
if (!File.prototype.text) File.prototype.text = function (this: File) { return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(this); }); };
import { emptyMetadata } from "@/lib/metadata";
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
});
