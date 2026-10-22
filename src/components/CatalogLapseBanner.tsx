import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, PauseCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadWholeCatalog } from "@/lib/catalog";
import { currentPause, inGrace, isPaused, type Lapse, type Pause, type PlanSub } from "@/lib/retention";
import { FailedRenewalBanner, GraceOffers } from "@/components/RetentionControls";

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/** Download my catalog: every master, artwork, lyrics and the catalog PDF in one ZIP. */
export function DownloadCatalogButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [progress, setProgress] = useState<string>();
  async function run() {
    setProgress("Preparing…");
    try {
      const r = await downloadWholeCatalog((done, total) => setProgress(`${done} of ${total} songs…`));
      if (r.skipped) toast.warning(`Downloaded ${r.songs} songs. ${r.skipped} file${r.skipped === 1 ? "" : "s"} couldn't be fetched; try those from each song's Downloads.`);
      else toast.success(`Downloaded ${r.songs} song${r.songs === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Your catalog couldn't be downloaded. Try again, or download each song from its Downloads menu.");
    } finally { setProgress(undefined); }
  }
  return <Button variant={variant} disabled={!!progress} onClick={() => void run()}><Download />{progress ?? "Download my catalog"}</Button>;
}

/**
 * The workspace banner while a renewal payment is failing, a plan has ended (30-day grace before the catalog is
 * emptied) or is paused. Need more time and Pause are offered right here when they're available.
 */
export function CatalogLapseBanner({ sub, lapse, pauses, onRenew, onChanged }: { sub: PlanSub | null; lapse: Lapse | null; pauses: Pause[]; onRenew: () => void; onChanged: () => void }) {
  const pause = currentPause(pauses);
  if (sub?.status === "past_due") return <FailedRenewalBanner sub={sub} lapse={lapse} pauses={pauses} onChanged={onChanged} />;
  if (pause && isPaused(pauses)) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-primary bg-card p-4">
        <PauseCircle className="h-6 w-6 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Your plan is paused until {longDate(pause.ends_at)}.</span>{" "}
          <span className="text-muted-foreground">Your catalog is kept safe and read-only: view and download, no adding or editing.</span></p>
        <DownloadCatalogButton variant="outline" />
        <Button asChild><Link to="/profile">Resume now</Link></Button>
      </div>
    );
  }
  if (!inGrace(lapse)) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-primary bg-card p-4">
      <TriangleAlert className="h-6 w-6 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Your plan ended. Your catalog will be emptied on {longDate(lapse!.empty_after)}.</span>{" "}
        <span className="text-muted-foreground">Download everything now, or renew to keep it.</span></p>
      <DownloadCatalogButton />
      <Button variant="outline" onClick={onRenew}>Renew</Button>
      <GraceOffers sub={sub} lapse={lapse} pauses={pauses} onChanged={onChanged} />
    </div>
  );
}
