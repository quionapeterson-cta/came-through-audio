import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PatientFileCard, patientFileReady } from "@/components/PatientFileCard";

describe("PatientFileCard", () => {
  it("needs a legal name and a publisher answer before the desk can check you in", () => {
    expect(patientFileReady(null)).toBe(false);
    expect(patientFileReady({ legalName: "Ann Lee", pro: "", ipi: "", publishing: "", publisher: "" })).toBe(false);
    expect(patientFileReady({ legalName: "Ann Lee", pro: "", ipi: "", publishing: "publisher", publisher: "" })).toBe(false);
    expect(patientFileReady({ legalName: "Ann Lee", pro: "", ipi: "", publishing: "publisher", publisher: "Lee Songs" })).toBe(true);
    expect(patientFileReady({ legalName: "Ann Lee", pro: "BMI", ipi: "", publishing: "self", publisher: "" })).toBe(true);
  });

  it("saves the details and shows them back as the file at the desk", () => {
    const onSaved = vi.fn();
    render(<PatientFileCard userId="u1" defaultName="Ann Lee" onSaved={onSaved} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Legal name" }), { target: { value: "Ann Lee" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Publisher status" }), { target: { value: "self" } });
    fireEvent.click(screen.getByRole("button", { name: /Save my details/ }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ legalName: "Ann Lee", publishing: "self" }));
    expect(screen.getByText("Your details at the desk")).toBeTruthy();
    expect(screen.getByText(/I'm self-published/)).toBeTruthy();
  });
});
