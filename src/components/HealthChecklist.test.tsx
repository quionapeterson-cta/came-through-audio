import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HealthChecklist } from "@/components/HealthChecklist";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { countryByCode } from "@/lib/repertoires";

const us = countryByCode("US")!;
const t = (id: string, title: string, extra = {}) => ({ id, title, artist: "Q Peterson", updatedAt: "", metadata: { ...emptyMetadata(), title, artist: "Q Peterson", isrc: "USCTA2600001",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro: "BMI", ipi: "00123456789", percentage: "100" }],
  publishers: [{ name: "Lee Songs", pro: "BMI", ipi: "00987654321", percentage: "100" }], ...extra } });

describe("HealthChecklist", () => {
  it("shows lists, steps and the not-showing-up help, and saves ticks", () => {
    const rows = [trackReport(t("c1", "Night Drive"), us, [{ trackId: "c1", society: "bmi", status: "not_listed", source: "self", checkedAt: "x" }]), trackReport(t("h:1", "Inspector Song", { isrc: "" }), us, [])];
    const onStatus = vi.fn(), onMark = vi.fn();
    const actions = { onCountry: vi.fn(), onRunAll: vi.fn(), onRunOne: vi.fn(), onMark, onClear: vi.fn(), onFixField: vi.fn(), onExpert: vi.fn() };
    render(<HealthChecklist rows={rows} country={us} statuses={[]} onStatus={onStatus} actions={actions} canCatalog={false} onUpgrade={vi.fn()} onEditInspector={vi.fn()} onDeleteInspector={vi.fn()} />);
    expect(screen.getByText("Song Health Checklist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Needs attention · 2/ })).toBeTruthy();
    expect(screen.getByText(/On a paid plan this runs itself/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tick: Register with BMI/ }));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ songRef: "c1", steps: expect.objectContaining({ "registered:bmi": expect.any(String) }) }));
    fireEvent.click(screen.getByText(/Confirm it shows up in BMI/));
    expect(screen.getByText(/Relax, this is common/)).toBeTruthy();
    expect(screen.getAllByText(/Not reconciled yet/).length).toBeGreaterThan(0);
  });
});
