import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaitingArea } from "@/components/WaitingArea";

const TITLES = ["Heart", "Lungs", "Kidneys", "Brain", "Spine", "ISRC", "Distributor", "Unclaimed"];

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
    expect(screen.getByText(/What the Music Royalty Doctor looks for/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-heart.svg"]')).toBeTruthy();

    // The ISRC leaflet says a recording code is never a precondition for registering the song.
    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open the ISRC pamphlet/ }));
    expect(screen.getByRole("heading", { name: "Registering with your PRO, with or without an ISRC" })).toBeTruthy();
    expect(screen.getByText(/BMI doesn't require it/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-isrc.svg"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));

    // The two money leaflets (founder, 2026-11-11): the distributor's part, and where unclaimed money goes.
    fireEvent.click(screen.getByRole("button", { name: /Open the Distributor pamphlet/ }));
    expect(screen.getByRole("heading", { name: "What your distributor collects (and what it doesn't)" })).toBeTruthy();
    expect(screen.getByText(/pays you the master side/)).toBeTruthy();
    expect(screen.getByText(/registers nothing with any of them/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-distributor.svg"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open the Unclaimed pamphlet/ }));
    expect(screen.getByRole("heading", { name: "Unclaimed royalties and the black box" })).toBeTruthy();
    expect(screen.getByText(/held for at least three years/)).toBeTruthy();
    expect(document.querySelector('img[src="/art/clinic/pamphlet-unclaimed.svg"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    expect(screen.queryByRole("heading", { name: "Performance royalties (your PRO)" })).toBeNull();
    expect(screen.getByRole("button", { name: /Open the Lungs pamphlet/ })).toBeTruthy();
  });

  it("opens every pamphlet from the rack, each with paragraphs and its own reading", () => {
    render(<WaitingArea />);
    for (const title of TITLES) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Open the ${title} pamphlet`) }));
      expect(screen.getByText(/In your report/)).toBeTruthy();
      expect(screen.getByText(/What the Music Royalty Doctor looks for/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Back to the rack/ }));
    }
  });
});
