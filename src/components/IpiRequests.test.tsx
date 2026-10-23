import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("@/lib/ipi-request.functions", () => ({ sendIpiRequest: vi.fn() }));
import { IpiRequestList } from "@/components/IpiRequests";
import type { IpiRequest } from "@/lib/ipi-requests";

const base: IpiRequest = { id: "r1", writerName: "Jordan Lee", role: "Author/Composer", email: "jordan@example.com", songs: [{ catalog_id: "a", title: "Midnight" }, { catalog_id: "b", title: "Run It Back" }],
  artistName: "Q", status: "answered", answer: { legal_name: "Jordan Lee", pro: "BMI", ipi: "00123456789", no_pro: false }, sentAt: null, expiresAt: "", createdAt: "" };

describe("IpiRequestList", () => {
  it("shows answers to approve and pending requests, and approves into the songs", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(<IpiRequestList requests={[base, { ...base, id: "r2", writerName: "Bo Ray", status: "pending", answer: null }]} onApply={onApply} onDismiss={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText("Jordan Lee sent their details")).toBeTruthy();
    expect(screen.getByText("BMI · IPI 00123456789")).toBeTruthy();
    expect(screen.getByText(/Nothing you already entered is changed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to 2 songs" }));
    expect(onApply).toHaveBeenCalledWith(base);
    expect(screen.getByText("Bo Ray")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Email again/ })).toBeTruthy();
  });
});
