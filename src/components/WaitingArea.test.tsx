import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaitingArea } from "@/components/WaitingArea";

const TITLES = ["Heart", "Lungs", "Kidneys", "Brain", "Spine"];

describe("WaitingArea", () => {
  it("prints every pamphlet's title on the rack, and opens one from its title", () => {
    render(<WaitingArea />);
    // All five titles are on the rack before anything is clicked.
    for (const title of TITLES) {
      expect(screen.getByRole("button", { name: new RegExp(`Open the ${title} pamphlet`) })).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: /Open the Heart pamphlet/ }));
    expect(screen.getByRole("heading", { name: "Performance royalties (your PRO)" })).toBeTruthy();
    // A pamphlet is more than its headline: it has its own paragraphs and its own picture.
    expect(screen.getByText(/ASCAP, BMI, SESAC and GMR/)).toBeTruthy();
    expect(screen.getByText(/The money has two halves/)).toBeTruthy();
    expect(screen.getByText(/What the Doctor looks for/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-heart.svg"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    expect(screen.queryByRole("heading", { name: "Performance royalties (your PRO)" })).toBeNull();
    expect(screen.getByRole("button", { name: /Open the Lungs pamphlet/ })).toBeTruthy();
  });

  it("opens every pamphlet from the rack, each with paragraphs and its own reading", () => {
    render(<WaitingArea />);
    for (const title of TITLES) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Open the ${title} pamphlet`) }));
      expect(screen.getByText(/In your report/)).toBeTruthy();
      expect(screen.getByText(/What the Doctor looks for/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    }
  });
});
