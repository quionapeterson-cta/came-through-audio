import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RoyaltyReport } from "@/components/RoyaltyReport";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { songChecklist } from "@/lib/health-checklist";
import { countryByCode } from "@/lib/repertoires";
import { royaltyCheckup } from "@/lib/royalty-checkup";

const us = countryByCode("US")!;
const t = (id: string, extra = {}) => ({ id, title: id, artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: id, artist: "Q", isrc: "USCTA2600001", upc: "123456789012",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "ASCAP", ipi: "", percentage: "100" }], composers: [],
  publishers: [], ...extra } });

describe("RoyaltyReport", () => {
  it("leads with the main finding, opens organ reports from the body and the cards, and runs treatment steps", () => {
    const rows = [t("Midnight"), t("Run It Back", { isrc: "USCTA2600002" })].map((x) => { const r = trackReport(x, us, []); return { r, c: songChecklist(r, us) }; });
    const checkup = royaltyCheckup({ rows });
    const onAction = vi.fn(), onRun = vi.fn();
    render(<RoyaltyReport checkup={checkup} since={null} date="Oct 23, 2026" country="United States" canExport={false} onRunCheckup={onRun} onAction={onAction} onExpert={vi.fn()} onReminder={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Royalty Health Report" })).toBeTruthy();
    expect(screen.getAllByText("Your heart is broken in two.").length).toBeGreaterThan(0);
    // The body's organs are buttons that open their report.
    fireEvent.click(screen.getByRole("button", { name: /^Brain: .*Open its report/ }));
    expect(screen.getByRole("heading", { name: /A little foggy|Healthy and strong/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Heart/, pressed: false }));
    const report = screen.getByRole("article");
    expect(within(report).getAllByText(/Treatment plan/).length).toBeGreaterThan(0);
    // One-click files stay on Catalog & Collaborate.
    expect(within(report).getAllByRole("button", { name: /Get the 1-click file/ }).length).toBeGreaterThan(0);
    fireEvent.click(within(report).getAllByRole("button", { name: "Open the field" })[0]!);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ kind: "field" }));
    fireEvent.click(screen.getByRole("button", { name: /Run a new checkup/ }));
    expect(onRun).toHaveBeenCalled();
  });
});
