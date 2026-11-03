import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaitingArea } from "@/components/WaitingArea";

describe("WaitingArea", () => {
  it("opens the pamphlet rack from the waiting area photo, then opens a pamphlet to read", () => {
    render(<WaitingArea />);
    // Shut until the photo is clicked: nothing to read yet.
    expect(screen.getByText(/The rack is shut/)).toBeTruthy();
    expect(screen.queryByText(/Performance royalties \(your PRO\)/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Tap the rack to take a pamphlet/ }));
    expect(screen.getByRole("button", { name: /Close the rack/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Heart/ }));
    expect(screen.getByRole("heading", { name: "Performance royalties (your PRO)" })).toBeTruthy();
    // A pamphlet is more than its headline: it has its own paragraphs and its own picture.
    expect(screen.getByText(/ASCAP, BMI, SESAC and GMR/)).toBeTruthy();
    expect(screen.getByText(/The money has two halves/)).toBeTruthy();
    expect(screen.getByText(/What the Doctor looks for/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-heart.svg"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    expect(screen.queryByRole("heading", { name: "Performance royalties (your PRO)" })).toBeNull();
    expect(screen.getByRole("button", { name: /Lungs/ })).toBeTruthy();
  });

  it("gives every pamphlet paragraphs and its own reading", () => {
    render(<WaitingArea />);
    fireEvent.click(screen.getByRole("button", { name: /Tap the rack to take a pamphlet/ }));
    for (const organ of ["Heart", "Lungs", "Kidneys", "Brain", "Spine"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(organ) }));
      expect(screen.getByText(/In your report/)).toBeTruthy();
      expect(screen.getByText(/What the Doctor looks for/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    }
  });
});
