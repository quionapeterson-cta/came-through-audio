import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TaxDrawer } from "@/components/LabTaxDrawer";
import { emptyTaxSheet, newTaxRow, type TaxSheet } from "@/lib/financial-lab-tax";

/**
 * Local look at the Artist Tax Write-Off Estimator, not part of the product (founder, 2026-11-25): /dev/tax renders the
 * real <TaxDrawer> with a sample worksheet inside the width the Financial Lab gives it, so its steps, dropdowns and
 * totals can be read at a desktop width and at 390px without a Collaborate account to open the Lab with.
 *
 * Dev-only: `import.meta.env.DEV` is settled at build time, so a production build keeps the URL and renders "Not found".
 */
export const Route = createFileRoute("/dev/tax")({
  component: import.meta.env.DEV ? TaxLab : NotInThisBuild,
});

function NotInThisBuild() {
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        This page exists in the development build only.
      </p>
    </div>
  );
}

function TaxLab() {
  const [sheet, setSheet] = useState<TaxSheet>(() => ({
    ...emptyTaxSheet(),
    year: "2026",
    status: "single",
    rate: "22",
    selfEmployment: "full",
    rows: [
      { ...newTaxRow("studio"), amount: "1200", kept: true },
      { ...newTaxRow("mix"), amount: "650" },
      { ...newTaxRow("travel"), amount: "210.75", kept: true },
      { ...newTaxRow("other"), label: "Vinyl test pressings", amount: "480" },
    ],
  }));

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <h1 className="text-2xl font-bold">Tax write-off lab</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Local only. The real <code>TaxDrawer</code> with a sample worksheet, in the aside width the
        Financial Lab gives it. Open the drawer, then read it at a desktop width and at 390px.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)]">
        <div className="hidden md:block" />
        <aside className="min-w-0 space-y-2" aria-label="Financial Lab side drawers">
          <TaxDrawer sheet={sheet} onChange={setSheet} />
        </aside>
      </div>
    </div>
  );
}
