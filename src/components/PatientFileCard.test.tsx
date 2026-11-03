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
    // First visit: nothing on file yet, so the desk asks you to hand it over.
    fireEvent.click(screen.getByRole("button", { name: /Submit to Front Desk/ }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ legalName: "Ann Lee", publishing: "self" }));
    expect(screen.getByText("Your details at the desk")).toBeTruthy();
    expect(screen.getByText(/I'm self-published/)).toBeTruthy();
    // The form is a first-visit thing; afterwards it only comes back when you edit the file.
    expect(screen.queryByRole("textbox", { name: "Legal name" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByRole("button", { name: /Save my details/ })).toBeTruthy();
  });

  it("shows the file the account kept instead of asking for it again", () => {
    render(<PatientFileCard userId="u2" defaultName="Ann Lee" patient={{ legalName: "Ann Lee", pro: "BMI", ipi: "123456789", publishing: "self", publisher: "" }} />);
    expect(screen.getByText("Your details at the desk")).toBeTruthy();
    expect(screen.getByText(/BMI · IPI 123456789 · I'm self-published/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Legal name" })).toBeNull();
  });
});
