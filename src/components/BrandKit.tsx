import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/InfoTip";
import { BRAND_FONTS, BRANDING_PRICE, emptyKit, fontFile, isHex, kitFromRow, type BrandKit as Kit } from "@/lib/brand-kit";
import { FONT_GROUPS } from "@/lib/brand-fonts";
import { getBrandAccess } from "@/lib/brand-kit.functions";
import { openCheckout } from "@/lib/checkout";
import { TIER_LABEL, type Tier } from "@/lib/plans";

const BUCKET = "brand-logos";
const MAX_LOGO = 2 * 1024 * 1024;
type Access = { splits: boolean; contracts: boolean; addOnUntil: string | null };
const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * Profile → Brand kit (Personal Branding, PLAN-master-notes 3.6): their logo, name, tagline, colors and font replace
 * the Came Through Audio header on documents they send. Catalog Management: contracts and split sheets; the add-on:
 * split sheets. The server checks the plan when a PDF is made, so this form only stores the kit.
 */
export function BrandKit({ userId, tier, artistName }: { userId: string; tier: Tier; artistName: string }) {
  const accessFn = useServerFn(getBrandAccess);
  const [access, setAccess] = useState<Access | null>(null);
  const [kit, setKit] = useState<Kit>(() => emptyKit(artistName));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void accessFn().then((a) => live && setAccess(a)).catch(() => live && setAccess({ splits: false, contracts: false, addOnUntil: null }));
    void (async () => {
      const { data } = await supabase.from("brand_kits" as never).select("*").eq("user_id", userId).maybeSingle();
      const k = kitFromRow(data);
      if (!live) return;
      // Nothing saved yet: the name starts as their artist name, ready to save.
      if (!k) return setSaved(false);
      setKit({ ...k, name: k.name || artistName });
      if (k.logoPath) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(k.logoPath, 3600);
        if (live) setLogoUrl(signed?.signedUrl ?? null);
      }
    })();
    return () => { live = false; };
  }, [userId, tier]);

  // Only the chosen font is downloaded, for the preview (the PDF loads the same files).
  useEffect(() => { loadPreviewFont(kit.font); }, [kit.font]);

  const edit = (patch: Partial<Kit>) => { setKit((k) => ({ ...k, ...patch })); setSaved(false); };
  const setColor = (i: number, v: string) => edit({ colors: kit.colors.map((c, j) => (j === i ? v : c)) });

  async function uploadLogo(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Use a PNG or JPG logo."); return; }
    if (file.size > MAX_LOGO) { toast.error("That logo is over 2 MB. Try a smaller file."); return; }
    setBusy(true);
    try {
      const path = `${userId}/logo.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (kit.logoPath && kit.logoPath !== path) await supabase.storage.from(BUCKET).remove([kit.logoPath]);
      edit({ logoPath: path });
      setLogoUrl(URL.createObjectURL(file));
    } catch { toast.error("Your logo couldn't upload. Try again."); }
    finally { setBusy(false); }
  }

  async function removeLogo() {
    if (kit.logoPath) await supabase.storage.from(BUCKET).remove([kit.logoPath]);
    edit({ logoPath: null });
    setLogoUrl(null);
  }

  async function save() {
    const bad = kit.colors.find((c) => !isHex(c));
    if (bad) { toast.error(`"${bad}" isn't a color code. Use 6 digits like #004AAD.`); return; }
    setBusy(true);
    try {
      const row = { user_id: userId, name: kit.name.trim(), tagline: kit.tagline.trim(), colors: kit.colors.map((c) => c.toUpperCase()), font: kit.font, logo_path: kit.logoPath, show_footer: kit.showFooter, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("brand_kits" as never).upsert(row as never, { onConflict: "user_id" });
      if (error) throw error;
      setSaved(true);
      toast.success("Your brand kit is saved.");
    } catch { toast.error("Your brand kit couldn't save. Try again."); }
    finally { setBusy(false); }
  }

  async function buy() {
    try { await openCheckout({ kind: "branding" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open. Contact support and we'll help right away."); }
  }

  if (!access) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>;

  if (!access.splits) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Put your own logo, name, tagline, colors and font at the top of the documents you send, in place of ours.</p>
        <ul className="space-y-1 text-sm">
          <li><span className="font-semibold">{TIER_LABEL.management}:</span> included, on contracts and split sheets.</li>
          <li><span className="font-semibold">{TIER_LABEL.collaborate}:</span> add it to split sheets for {BRANDING_PRICE}/year.</li>
        </ul>
        {tier === "collaborate"
          ? <Button onClick={() => void buy()}><Lock className="h-4 w-4" />Add Personal Branding · {BRANDING_PRICE}/year</Button>
          : <Button asChild><Link to="/plans"><Lock className="h-4 w-4" />See plans</Link></Button>}
      </div>
    );
  }

  const where = access.contracts ? "Your contracts and split sheets" : "Your split sheets";
  const ending = access.addOnUntil && !access.contracts ? Date.parse(access.addOnUntil) - Date.now() < 30 * 86400000 : false;
  const nameColor = kit.colors[0] && isHex(kit.colors[0]) ? kit.colors[0] : undefined;
  const taglineColor = kit.colors[1] && isHex(kit.colors[1]) ? kit.colors[1] : undefined;
  const stripe = kit.colors.filter(isHex);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {where} carry this header in place of ours.
        {access.contracts ? ` Included with ${TIER_LABEL.management}.` : access.addOnUntil ? ` Personal Branding runs until ${longDate(access.addOnUntil)}.` : ""}
      </p>
      {ending && <Button variant="outline" onClick={() => void buy()}>Add another year · {BRANDING_PRICE}</Button>}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bk-name" className="flex items-center gap-1.5">Name on the header<InfoTip text="Your artist, label or company name, as it should appear at the top of your documents." /></Label>
          <Input id="bk-name" value={kit.name} maxLength={80} onChange={(e) => edit({ name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bk-tagline" className="flex items-center gap-1.5">Tagline<InfoTip text="Optional. A short line under your name, like your slogan." /></Label>
          <Input id="bk-tagline" value={kit.tagline} maxLength={80} onChange={(e) => edit({ tagline: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">Logo<InfoTip text="Optional. PNG or JPG, up to 2 MB. A wide logo with a clear background looks best." /></Label>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="Your logo" className="h-12 max-w-[10rem] rounded border border-border bg-white object-contain p-1" />}
            <Button asChild variant="outline" size="sm" disabled={busy}>
              <label className="cursor-pointer"><ImagePlus className="h-4 w-4" />{kit.logoPath ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />
              </label>
            </Button>
            {kit.logoPath && <Button variant="ghost" size="sm" onClick={() => void removeLogo()}><Trash2 className="h-4 w-4" />Remove</Button>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bk-font" className="flex items-center gap-1.5">Font<InfoTip text="The font for your name and tagline. The rest of the document stays in our easy-to-read font." /></Label>
          <select id="bk-font" value={kit.font} onChange={(e) => edit({ font: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {FONT_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.fonts.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>)}
          </select>
          <p className="text-xs text-muted-foreground">{BRAND_FONTS.length} fonts. Pick one and the preview below shows it.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Colors<InfoTip text="Add as many as you like. The first colors your name, the second your tagline, and all of them make the stripe under your header." /></Label>
        <div className="flex flex-wrap gap-3">
          {kit.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border p-1.5">
              <input type="color" aria-label={`Color ${i + 1}`} value={isHex(c) ? c : "#000000"} onChange={(e) => setColor(i, e.target.value.toUpperCase())} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <Input aria-label={`Color ${i + 1} code`} value={c} maxLength={7} onChange={(e) => setColor(i, e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} className={`h-8 w-24 font-mono text-xs ${isHex(c) ? "" : "border-destructive"}`} />
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove color ${i + 1}`} onClick={() => edit({ colors: kit.colors.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-11" onClick={() => edit({ colors: [...kit.colors, kit.colors.length ? "#4D8CFF" : "#004AAD"] })}><Plus className="h-4 w-4" />Add color</Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="bk-footer">Show "Generated on camethroughaudio.com"</Label>
          <p className="text-xs text-muted-foreground">A small line at the bottom of each page, with our tagline. You can turn it off.</p>
        </div>
        <Switch id="bk-footer" checked={kit.showFooter} onCheckedChange={(v) => edit({ showFooter: v })} />
      </div>

      {/* Preview: the header as it prints (white page, like the PDF). */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preview</p>
        <div className="rounded-xl border border-border bg-white p-5 text-[#0b0b0b]">
          <div className="flex items-center gap-4">
            {logoUrl && <img src={logoUrl} alt="" className="h-12 max-w-[9rem] object-contain" />}
            <div className="min-w-0">
              <p className="truncate text-xl font-bold" style={{ fontFamily: kit.font, color: nameColor }}>{kit.name || "Your name"}</p>
              {kit.tagline && <p className="truncate text-xs font-medium" style={{ fontFamily: kit.font, color: taglineColor ?? "#525252" }}>{kit.tagline}</p>}
            </div>
          </div>
          <div className="mt-3 flex h-1 overflow-hidden rounded-full">
            {(stripe.length ? stripe : ["#0b0b0b"]).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
          </div>
          <p className="mt-4 text-2xl font-bold">Split Sheet Agreement</p>
          {kit.showFooter && <p className="mt-4 text-[10px] text-[#525252]">Generated on camethroughaudio.com · <span className="font-medium tracking-[2px] text-[#004AAD]">YOUR FIRST STOP BEFORE DISTRIBUTION</span></p>}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={busy || saved}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saved ? "Saved" : "Save brand kit"}</Button>
    </div>
  );
}

const previewFonts = new Set<string>(["Poppins"]);
function loadPreviewFont(f: string) {
  if (previewFonts.has(f) || typeof FontFace === "undefined") return;
  previewFonts.add(f);
  for (const [weight, w] of [["500", "medium"], ["700", "bold"]] as const) {
    new FontFace(f, `url(/fonts/${fontFile(f, w)}.ttf)`, { weight }).load().then((face) => document.fonts.add(face)).catch(() => previewFonts.delete(f));
  }
}
