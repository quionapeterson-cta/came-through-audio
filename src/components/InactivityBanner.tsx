import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DownloadCatalogButton } from "@/components/CatalogLapseBanner";
import { noticeLine } from "@/lib/inactivity";

type Notice = { delete_on: string };

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * The in-app half of the two-year notice (founder, 2026-11-09): while a Free account is scheduled, every visit to the
 * workspace says the date and puts the download in front of the member, right up to the day itself. A live paid plan
 * cancels the deadline, so a paying account never sees it, and it disappears once the files have been cleared (the
 * schedule is marked spent). Signing in keeps the account and the paperwork; it does not keep the files, which is why
 * this asks them to download rather than to come back.
 */
export function InactivityBanner({ userId, paid }: { userId: string; paid: boolean }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (paid) { setNotice(null); return; }
    let live = true;
    void supabase.from("account_inactivity" as never)
      .select("delete_on").eq("user_id", userId).is("deleted_at", null).maybeSingle()
      .then(({ data }) => { if (live) setNotice((data ?? null) as Notice | null); });
    return () => { live = false; };
  }, [userId, paid]);

  if (!notice) return null;
  const left = noticeLine(notice.delete_on);
  const when = longDate(notice.delete_on);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-primary bg-card p-4">
      <TriangleAlert className="h-6 w-6 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{left === "last day" ? `Today is the last day: your stored files are deleted on ${when}.` : `Your stored files are deleted in ${left}, on ${when}.`}</span>{" "}
        <span className="text-muted-foreground">
          Every master and piece of artwork, your AI Protection proof videos and your catalog entries go on that date.
          Download what you want to keep now, and keep an unchanged copy of each proof video from AI Protection → My
          certificates. Your account, split sheets, contracts and certificates stay.
        </span>
      </p>
      <DownloadCatalogButton />
      <Button variant="outline" asChild><Link to="/plans">Upgrade and keep everything</Link></Button>
    </div>
  );
}
