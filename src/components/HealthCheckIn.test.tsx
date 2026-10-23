import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { HealthCheckIn } from "@/components/HealthCheckIn";
import { emptyMetadata } from "@/lib/metadata";
import { trackReport } from "@/lib/health";
import { songChecklist } from "@/lib/health-checklist";
import { songScope } from "@/lib/health-reports";
import { countryByCode } from "@/lib/repertoires";

const us = countryByCode("US")!;
const t = (pro: string) => ({ id: "a", title: "Midnight", artist: "Q", updatedAt: "", metadata: { ...emptyMetadata(), title: "Midnight", artist: "Q", isrc: "USCTA2600001",
  writers: [{ name: "", legalName: "Ann Lee", role: "Author/Composer", pro, ipi: "00123456789", percentage: "100" }], composers: [], publishers: [] } });
const setup = (pro = "ASCAP") => {
  const track = t(pro), r = trackReport(track, us, []);
  const onAnswer = vi.fn(), onSelfPublished = vi.fn(), onRun = vi.fn();
  render(<HealthCheckIn scope={songScope(track)} options={[songScope(track)]} onScope={vi.fn()} rows={[{ r, c: songChecklist(r, us) }]} countryPicker={null}
    onAnswer={onAnswer} onSelfPublished={onSelfPublished} onFixField={vi.fn()} onRun={onRun} onBack={vi.fn()} />);
  return { onAnswer, onSelfPublished, onRun };
};

describe("HealthCheckIn", () => {
  it("saves registration answers as the checklist's own ticks and runs the check", () => {
    const { onAnswer, onRun } = setup();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: /Registered with your PRO \(ASCAP\)/ })).getByRole("radio", { name: "Yes" }));
    expect(onAnswer).toHaveBeenCalledWith([{ id: "a", steps: expect.objectContaining({ "registered:ascap": expect.any(String), "checkin:ascap": null }) }]);
    fireEvent.click(within(screen.getByRole("radiogroup", { name: /The MLC/ })).getByRole("radio", { name: "Not sure" }));
    expect(onAnswer).toHaveBeenLastCalledWith([{ id: "a", steps: expect.objectContaining({ "registered:mlc": null, "checkin:mlc": "unsure" }) }]);
    fireEvent.click(screen.getByRole("button", { name: /Run my Royalty Health Check/ }));
    expect(onRun).toHaveBeenCalled();
  });

  it("asks about a publisher, and tells BMI writers their writer share still pays", () => {
    const bmi = setup("BMI");
    expect(screen.getByText(/BMI still pays your writer share/)).toBeTruthy();
    // All-BMI writers need no Self-published, so "No" is only recorded.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Do you have a publisher?" })).getByRole("radio", { name: "No, I'm self-published" }));
    expect(bmi.onSelfPublished).not.toHaveBeenCalled();
    expect(bmi.onAnswer).toHaveBeenCalledWith([{ id: "a", steps: { "checkin:publisher": "no" } }]);
  });
  it("ticks Self-published for writers at other PROs", () => {
    const { onSelfPublished } = setup("ASCAP");
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Do you have a publisher?" })).getByRole("radio", { name: "No, I'm self-published" }));
    expect(onSelfPublished).toHaveBeenCalledWith(["a"]);
  });
});
