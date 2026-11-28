import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelpChat } from "./HelpChat";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { href: string } }) => unknown }) =>
    select({ location: { href: "/workspace?tab=splits" } }),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Help Desk", () => {
  it("is a small chat bubble at the foot of the page, not a floating badge", () => {
    render(<HelpChat />);
    const badge = screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ });
    // In the page's own flow: nothing pinned to the viewport, nothing anchored to a corner.
    expect(badge.className).not.toContain("fixed");
    expect(badge.className).not.toContain("bottom-20");
    expect(badge.className).not.toContain("right-3");
    // A bubble only: no words on it, and a name for a reader that needs one.
    expect(badge.textContent).toBe("");
    expect(badge).toHaveAttribute("title", "Open the Came Through Audio Help Desk");
    // Bottom-right of the page's own column, not the middle of it.
    expect(badge.parentElement?.className).toContain("justify-end");
    // Never cobalt directly on black: the bubble turns white with cobalt lettering in the dark theme.
    expect(badge.className).toContain("dark:bg-white");
    expect(badge.className).toContain("dark:text-[#004AAD]");
  });

  it("opens the named help desk with this tab's questions and action pills", () => {
    render(<HelpChat />);
    fireEvent.click(screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ }));
    const panel = screen.getByRole("dialog", { name: "Came Through Audio Help Desk" });
    expect(panel.className).toContain("h-[440px]");
    expect(panel.className).toContain("max-w-[92vw]");
    expect(panel.className).toContain("max-h-[65vh]");
    expect(screen.getByRole("button", { name: /Minimize the Help Desk/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close the Help Desk/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /How do I send a split sheet to sign\?/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Jump to Split Sheets/ })).toHaveAttribute(
      "href",
      "/workspace?tab=splits",
    );
    expect(screen.getByRole("link", { name: /Let Us Do It For You/ })).toBeInTheDocument();
  });

  it("answers a quick question from the local knowledge base when no worker is configured", async () => {
    render(<HelpChat />);
    fireEvent.click(screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ }));
    fireEvent.click(screen.getByRole("button", { name: /How do I send a split sheet to sign\?/ }));
    await waitFor(() => expect(screen.queryByText("Looking that up…")).not.toBeInTheDocument());
    expect(screen.getByText(/How do I send a split sheet to sign\?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, helpful" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /How do I send a split sheet to sign\?/ }),
    ).not.toBeInTheDocument();
  });

  it("minimizes back to the badge and closes empty", async () => {
    render(<HelpChat />);
    fireEvent.click(screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ }));
    fireEvent.click(screen.getByRole("button", { name: /Minimize the Help Desk/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ }));
    fireEvent.click(screen.getByRole("button", { name: /Close the Help Desk/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open the Came Through Audio Help Desk/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText(/Was this helpful\?/)).not.toBeInTheDocument();
  });
});
