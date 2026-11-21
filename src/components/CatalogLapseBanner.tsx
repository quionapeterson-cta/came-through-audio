import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, PauseCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadWholeCatalog } from "@/lib/catalog";
import { currentPause, inGrace, isPaused, type Lapse, type Pause, type PlanSub } from "@/lib/retention";
import { FailedRenewalBanner, GraceOffers } from "@/components/RetentionControls";

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * Download a catalog: every master, artwork, lyrics and the catalog PDF in one ZIP. `ownerId` is the artist being
 * worked on when the button sits inside another artist's catalog, so the ZIP is theirs and not the browser's own.
 */
export function DownloadCatalogButton({ variant = "default", ownerId }: { variant?: "default" | "outline"; ownerId?: string }) {
  const [progress, setProgress] = useState<string>();
  async function run() {
    setProgress("Preparing…");
    try {
      const r = await downloadWholeCatalog((done, total) => setProgress(`${done} of ${total} songs…`), undefined, ownerId);
      // "Ready", not "downloaded": the browser can still refuse the file, and the Save button on the file message is
      // the honest way to finish it (founder, 2026-11-06).
      // Name the songs that came out incomplete and what each is missing, never just a count of files.
      if (r.gaps.length) toast.warning(`Your ZIP is ready. ${r.gaps.length === 1 ? "1 song is" : `${r.gaps.length} songs are`} incomplete:`, {
        description: r.gaps.map((g) => `${g.track.title || "Untitled"}: ${g.items.map((i) => ({ audio: "master", artwork: "cover art", lyrics: "lyrics" })[i.field] ?? i.field).join(", ")}`).join("; "),
        duration: 15000,
      });
    } catch {
      toast.error("Your catalog couldn't be downloaded. Try again, or download each song from its Downloads menu.");
    } finally { setProgress(undefined); }
  }
  return <Button variant={variant} disabled={!!progress} onClick={() => void run()}><Download />{progress ?? (ownerId ? "Download this catalog" : "Download my catalog")}</Button>;
}

/**
 * The workspace banner while a renewal payment is failing or a plan is paused. The old 30-day emptying countdown is
 * retired, so the branch that drew it stays closed; a plan that ends is simply kept read-only on Free.
 */
export function CatalogLapseBanner({ sub, lapse, pauses, onRenew, onChanged }: { sub: PlanSub | null; lapse: Lapse | null; pauses: Pause[]; onRenew: () => void; onChanged: () => void }) {
  const pause = currentPause(pauses);
  if (sub?.status === "past_due") return <FailedRenewalBanner sub={sub} lapse={lapse} pauses={pauses} onChanged={onChanged} />;
  if (pause && isPaused(pauses)) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-primary bg-card p-4">
        <PauseCircle className="h-6 w-6 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">{new Date(pause.starts_at) > new Date() ? `Your plan is paused from ${longDate(pause.starts_at)}.` : "Your plan is paused."}</span>{" "}
          <span className="text-muted-foreground">For as long as you need it: your catalog is kept safe and read-only, so you can view and download, with no adding or editing. The paid tools come back when you resume.</span></p>
        <DownloadCatalogButton variant="outline" />
        <Button asChild><Link to="/profile">Resume now</Link></Button>
      </div>
    );
  }
  if (!inGrace(lapse)) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-primary bg-card p-4">
      <TriangleAlert className="h-6 w-6 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Your plan ended. Your catalog is read-only on Free and will not be emptied.</span>{" "}
        <span className="text-muted-foreground">Download everything, or start a paid plan whenever you're ready.</span></p>
      <DownloadCatalogButton />
      <Button variant="outline" onClick={onRenew}>Renew</Button>
      <GraceOffers sub={sub} lapse={lapse} pauses={pauses} onChanged={onChanged} />
    </div>
  );
}
