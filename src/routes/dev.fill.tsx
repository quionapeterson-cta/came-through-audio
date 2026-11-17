import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AgencyLists } from "@/components/AgencyLists";
import { societyForPro } from "@/lib/repertoires";
import { emptyContributor, emptyMetadata } from "@/lib/metadata";
import type { Contributor } from "@/lib/metadata";
import type { CatalogTrack } from "@/lib/catalog";

/**
 * Local look at the catalog-fill dialog, not part of the product (founder, 2026-11-17): /dev/fill loads a sample BMI list
 * and opens the dialog by itself, so a remembered release is exercised without an agency file of your own. The real
 * <AgencyLists> renders here against a small catalog, so what is typed here is what the product does — and a release typed
 * by hand is saved with the signed-in account (signed out, the server refuses it and the dialog says so).
 *
 * Dev-only: `import.meta.env.DEV` is settled at build time, so a production build keeps the URL and renders "Not found".
 */
export const Route = createFileRoute("/dev/fill")({ component: import.meta.env.DEV ? FillLab : NotInThisBuild });

function NotInThisBuild() {
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">This page exists in the development build only.</p>
    </div>
  );
}

const track = (id: string, title: string, album: string, releaseType: string, instrumental = false, writers: Contributor[] = []): CatalogTrack => ({
  id,
  title,
  artist: "Karma Came",
  updatedAt: "",
  metadata: { ...emptyMetadata(), title, artist: "Karma Came", album, releaseType, instrumental, writers, publishers: [], composers: [] },
});

/** A writer the catalog already holds under a different spelling or share, so the sample list differs. */
const writer = (name: string, percentage: string) => ({ ...emptyContributor(), name, legalName: name, role: "Author/Composer", percentage });

const catalog = [
  track("b", "Second Wind", "BAM", "Album"),
  track("d", "Third Rail", "BAM", "Album"),
  track("c", "Tape Loop", "Tape", "EP"),
  track("e", "Half Light", "Tape", "EP"),
  track("f", "Loose", "", "", false),
  track("g", "Second Wind (Instrumental)", "BAM", "Album", true),
  // Already in the catalog under the agency's own names, so each shows as a duplicate with a version to choose.
  track("h", "AM PM", "BAM", "Album", false, [writer("QUI-ONA PETERSON", "100")]),
  track("i", "NIGHT BUS", "", "", false, [writer("S. C. ANDRE JR", "100")]),
];

const bmi = societyForPro("BMI")!;

const SAMPLE = [
  "Work Title,ISWC,Writer Name,IPI,Share %",
  "TWENTY FOUR SEVEN LOVE,T9187370996,PETERSON QUI ONA LASHAY,658645500,50",
  "TWENTY FOUR SEVEN LOVE,T9187370996,STEPHENS CALVIN ANDRE JR (MR),00549852210,50",
  "AM PM,T3335070554,PETERSON QUI ONA LASHAY,658645500,50",
  "AM PM,T3335070554,STEPHENS CALVIN ANDRE JR (MR),00549852210,50",
  "NIGHT BUS,T4445070555,PETERSON QUI ONA LASHAY,658645500,100",
  "",
].join("\n");

function FillLab() {
  // Loads the sample list and opens the dialog, so the lab is a look at the dialog itself.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise((r) => timers.push(setTimeout(r, ms)));
    void (async () => {
      await wait(300);
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) return;
      const dt = new DataTransfer();
      dt.items.add(new File([SAMPLE], "bmi-sample.csv", { type: "text/csv" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(900);
      const button = [...document.querySelectorAll("button")].find((b) => /Fill my catalog/i.test(b.textContent ?? ""));
      button?.click();
    })();
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Catalog fill lab</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Development only. The real <code>AgencyLists</code> with a small catalog and a sample BMI list that loads itself,
        so the dialog opens on its own — no agency download needed. A release typed by hand is saved with the signed-in
        account; with no session the server refuses it and the dialog says so.
      </p>
      <div className="mt-6 max-w-4xl">
        <AgencyLists
          userId="preview"
          societies={[bmi]}
          songsFor={() => catalog}
          allTracks={catalog}
          summaries={{}}
          onApply={async () => undefined}
        />
      </div>
    </div>
  );
}
