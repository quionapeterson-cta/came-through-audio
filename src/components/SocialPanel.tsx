import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SocialLinks } from "@/components/SocialLinks";
import { getSiteSocials, setSiteSocials } from "@/lib/social.functions";
import { SOCIAL_PLATFORMS, type SocialLink } from "@/lib/social";

/**
 * Admin → Homepage → Social (founder, 2026-11-04): every platform the footer can show, its address, and the switch that
 * puts it on the page. Only switched-on platforms with an address appear, so the future ones can be filled in quietly.
 */
export function SocialPanel() {
  const { data, isLoading } = useQuery({ queryKey: ["site-socials"], queryFn: () => getSiteSocials() });
  const [links, setLinks] = useState<SocialLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data && !links) setLinks(data); }, [data, links]);
  const update = (platform: SocialLink["platform"], patch: Partial<SocialLink>) =>
    setLinks((rows) => (rows ?? []).map((r) => (r.platform === platform ? { ...r, ...patch } : r)));
  const save = async () => {
    if (!links) return;
    setBusy(true);
    try { await setSiteSocials({ data: links }); toast.success("Social links saved."); }
    catch { toast.error("Couldn't save the social links."); }
    finally { setBusy(false); }
  };
  if (isLoading || !links) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold">Social media</h3>
      <p className="mt-1 text-sm text-muted-foreground">Paste each account's address and switch on the ones that should appear in the footer. Only switched-on accounts with an address are shown on the homepage.</p>
      <div className="mt-5 space-y-4">
        {SOCIAL_PLATFORMS.map(({ platform, label }) => {
          const row = links.find((l) => l.platform === platform)!;
          return (
            <div key={platform} className="grid gap-2 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
              <Label htmlFor={`social-${platform}`} className="font-semibold">{label}</Label>
              <Input id={`social-${platform}`} value={row.url} placeholder="https://…" onChange={(e) => update(platform, { url: e.target.value })} />
              <div className="flex items-center gap-2">
                <Switch id={`social-on-${platform}`} checked={row.enabled} onCheckedChange={(v) => update(platform, { enabled: v })} />
                <Label htmlFor={`social-on-${platform}`} className="text-sm text-muted-foreground">Show</Label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save social links"}</Button>
        <SocialLinks links={links} />
      </div>
    </section>
  );
}
