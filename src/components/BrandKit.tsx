import { useEffect, useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { ImagePlus, Loader2, Lock, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/InfoTip";
import { BRAND_FONTS, BRANDING_PRICE, KIT_STYLES, emptyKit, isHex, kitFromRow, type BrandKit as Kit, type KitStyle } from "@/lib/brand-kit";
import { FONT_GROUPS } from "@/lib/brand-fonts";
import { loadWebFont } from "@/lib/web-fonts";
import { Disclaimer } from "@/components/Disclaimer";
import { getBrandAccess } from "@/lib/brand-kit.functions";
import { openCheckout } from "@/lib/checkout";
import { TIER_LABEL, type Tier } from "@/lib/plans";

const BUCKET = "brand-logos";
const MAX_LOGO = 2 * 1024 * 1024;
/** `allowance`: how many kits can be used on documents now (missing before the multi-kit update). */
type Access = { splits: boolean; contracts: boolean; addOnUntil: string | null; allowance?: number };
const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

/**
 * Profile → Brand kit (Personal Branding, PLAN-master-notes 3.6): their logo, name, tagline, colors and font replace
 * the Came Through Audio header on documents they send. Catalog Management: contracts and split sheets; the add-on:
 * split sheets. The server checks the plan when a PDF is made, so this form only stores the kit.
 * Several kits (founder, 2026-10-27): one per business or project, $13.99 per kit per year; each contract picks its kit.
 */
export function BrandKit({ userId, tier, artistName }: { userId: string; tier: Tier; artistName: string }) {
  const accessFn = useServerFn(getBrandAccess);
  const [access, setAccess] = useState<Access | null>(null);
  const [kits, setKits] = useState<Kit[]>(() => [emptyKit(artistName)]);
  const [current, setCurrent] = useState(0);
  const kit = kits[current] ?? kits[0]!;
  const setKit = (next: Kit | ((k: Kit) => Kit)) => setKits((all) => all.map((k, i) => (i === current ? (typeof next === "function" ? next(k) : next) : k)));
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const logoUrl = kit.logoPath ? logoUrls[kit.logoPath] ?? null : null;
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  // Back from buying it (Stripe returns to /profile?checkout=success#brand-kit): say how to use it (founder, 2026-10-27).
  const [justBought] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "success" && window.location.hash === "#brand-kit");

  useEffect(() => {
    let live = true;
    void accessFn().then((a) => live && setAccess(a)).catch(() => live && setAccess({ splits: false, contracts: false, addOnUntil: null }));
    void (async () => {
      // Oldest kit first: it's the one used when a document doesn't pick a kit.
      let res = await supabase.from("brand_kits" as never).select("*").eq("user_id", userId).order("created_at" as never, { ascending: true });
      if (res.error) res = await supabase.from("brand_kits" as never).select("*").eq("user_id", userId);
      const list = ((res.data ?? []) as Record<string, unknown>[]).map((r) => kitFromRow(r as never)).filter((k): k is Kit => !!k);
      if (!live) return;
      // Nothing saved yet: the name starts as their artist name, ready to save.
      if (!list.length) return setSaved(false);
      setKits(list.map((k) => ({ ...k, name: k.name || artistName })));
      const urls: Record<string, string> = {};
      for (const k of list) {
        if (!k.logoPath) continue;
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(k.logoPath, 3600);
        if (signed?.signedUrl) urls[k.logoPath] = signed.signedUrl;
      }
      if (live) setLogoUrls(urls);
    })();
    return () => { live = false; };
  }, [userId, tier]);

  // Only the chosen font is downloaded, for the preview (the PDF loads the same files).
  useEffect(() => { loadWebFont(kit.font); }, [kit.font]);

  const edit = (patch: Partial<Kit>) => { setKit((k) => ({ ...k, ...patch })); setSaved(false); };
  const setColor = (i: number, v: string) => edit({ colors: kit.colors.map((c, j) => (j === i ? v : c)) });

  async function uploadLogo(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Use a PNG or JPG logo."); return; }
    if (file.size > MAX_LOGO) { toast.error("That logo is over 2 MB. Try a smaller file."); return; }
    setBusy(true);
    try {
      // One logo file per kit (the first kit keeps its original logo.png / logo.jpg name).
      const path = `${userId}/logo${current === 0 ? "" : `-${crypto.randomUUID().slice(0, 8)}`}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (kit.logoPath && kit.logoPath !== path) await supabase.storage.from(BUCKET).remove([kit.logoPath]);
      edit({ logoPath: path });
      setLogoUrls((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
    } catch { toast.error("Your logo couldn't upload. Try again."); }
    finally { setBusy(false); }
  }

  async function removeLogo() {
    if (kit.logoPath) await supabase.storage.from(BUCKET).remove([kit.logoPath]);
    edit({ logoPath: null });
  }

  async function save() {
    const bad = kit.colors.find((c) => !isHex(c));
    if (bad) { toast.error(`"${bad}" isn't a color code. Use 6 digits like #004AAD.`); return; }
    const badExtra = [kit.headerColor, kit.options.accent].find((c) => c && !isHex(c));
    if (badExtra) { toast.error(`"${badExtra}" isn't a color code. Use 6 digits like #0B0B0B.`); return; }
    setBusy(true);
    try {
      const base = { user_id: userId, name: kit.name.trim(), tagline: kit.tagline.trim(), colors: kit.colors.map((c) => c.toUpperCase()), font: kit.font, logo_path: kit.logoPath, show_footer: kit.showFooter, updated_at: new Date().toISOString() };
      const row = { ...base, style: kit.style, header_color: kit.headerColor, options: kit.options };
      if (kit.id) {
        const { error } = await supabase.from("brand_kits" as never).update(row as never).eq("id", kit.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("brand_kits" as never).insert(row as never).select("id").single();
        if (error && /options/.test(error.message)) throw new Error("The new kit options need the latest database update. Ask support to run migration 20261028090000.");
        if (error) {
          // Before migration 20261027210000: one kit per person and no style or header color yet.
          if (kits.length > 1) throw new Error("More than one Branding Kit needs the latest database update. Ask support to run migration 20261027210000.");
          const { error: legacy } = await supabase.from("brand_kits" as never).upsert(base as never, { onConflict: "user_id" });
          if (legacy) throw legacy;
        } else setKit((k) => ({ ...k, id: (data as { id: string }).id }));
      }
      setSaved(true);
      toast.success(`"${kit.name || "Your kit"}" is saved.`);
    } catch (e) { toast.error(e instanceof Error && e.message.includes("migration") ? e.message : "Your brand kit couldn't save. Try again."); }
    finally { setBusy(false); }
  }

  /** Deletes a kit that isn't the only one (its logo file too). Contracts that used it go back to the first kit. */
  async function removeKit() {
    if (!kit.id || kits.length < 2) return;
    if (!(await confirmAction({ title: `Delete "${kit.name || `Kit ${current + 1}`}"?`, text: "Contracts that used it switch to your first kit. This can't be undone." }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("brand_kits" as never).delete().eq("id", kit.id);
      if (error) throw error;
      if (kit.logoPath && !kits.some((k, i) => i !== current && k.logoPath === kit.logoPath)) await supabase.storage.from(BUCKET).remove([kit.logoPath]);
      setKits((all) => all.filter((_, i) => i !== current));
      setCurrent(0);
      setSaved(true);
      toast.success("Kit deleted.");
    } catch { toast.error("That kit couldn't be deleted. Try again."); }
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
        <p className="text-sm">On your split sheets and the contracts you make. Included with {TIER_LABEL.management}, or add it to any plan for {BRANDING_PRICE}/year.</p>
        <Button onClick={() => void buy()}><Lock className="h-4 w-4" />Add Personal Branding · {BRANDING_PRICE}/year</Button>
      </div>
    );
  }

  const where = "Your contracts and split sheets";
  // Before the multi-kit update the server doesn't send a count: one kit.
  const allowance = Math.max(1, access.allowance ?? 1);
  const ending = access.addOnUntil && tier !== "management" ? Date.parse(access.addOnUntil) - Date.now() < 30 * 86400000 : false;
  const nameColor = kit.colors[0] && isHex(kit.colors[0]) ? kit.colors[0] : undefined;
  const taglineColor = kit.colors[1] && isHex(kit.colors[1]) ? kit.colors[1] : undefined;
  const stripe = kit.colors.filter(isHex);

  return (
    <div className="space-y-6">
      {justBought && (
        <div className="rounded-xl border border-primary bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Your Branding Kit is ready.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Add your logo, name, tagline, colors and font right here, then click Save.</li>
            <li>Make a contract in Contracts &amp; Blueprints or a split sheet in Split Sheets: your kit replaces our header automatically.</li>
            <li>Come back to Profile → Brand kit anytime to change it.</li>
          </ol>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {where} carry this header in place of ours.
        {tier === "management" ? ` Included with ${TIER_LABEL.management}.` : access.addOnUntil ? ` Personal Branding runs until ${longDate(access.addOnUntil)}.` : ""}
      </p>
      {ending && <Button variant="outline" onClick={() => void buy()}>Add another year · {BRANDING_PRICE}</Button>}

      {/* Several kits, one per business or project; each contract picks its kit. */}
      <div className="flex flex-wrap items-center gap-2">
        {kits.map((k, i) => (
          <Button key={k.id ?? `new-${i}`} size="sm" variant={i === current ? "default" : "outline"} onClick={() => { if (!saved && i !== current) { toast.info("Save this kit first."); return; } setCurrent(i); }}>
            {k.name || `Kit ${i + 1}`}{i === 0 && kits.length > 1 ? " · main" : ""}
          </Button>
        ))}
        {kits.length < allowance
          ? <Button size="sm" variant="ghost" disabled={!saved} onClick={() => { setKits((all) => [...all, emptyKit("")]); setCurrent(kits.length); setSaved(false); }}><Plus className="h-4 w-4" />Add a kit</Button>
          : <Button size="sm" variant="ghost" onClick={() => void buy()}><Plus className="h-4 w-4" />Add another kit · {BRANDING_PRICE}/year</Button>}
        {kits.length > 1 && kit.id && <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => void removeKit()}><Trash2 className="h-4 w-4" />Delete this kit</Button>}
      </div>
      {kits.length > allowance && <p className="text-sm">⚠️ You have {kits.length} kits and {allowance} {allowance === 1 ? "is" : "are"} active. Documents use your first {allowance === 1 ? "kit" : `${allowance} kits`}; add another kit for {BRANDING_PRICE}/year to use the rest.</p>}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bk-name" className="flex items-center gap-1.5">Name on your contracts<InfoTip text="The name at the top of your branded contracts: your business, label, DBA or artist name. Split sheets always show your artist name, and your artist name in My Catalog, Embed Metadata and everywhere else stays the same." /></Label>
          <Input id="bk-name" value={kit.name} maxLength={80} placeholder="Business or artist name" onChange={(e) => edit({ name: e.target.value })} />
          <p className="text-xs text-muted-foreground">Starts as your artist name. Change it to a company or DBA name if you like; it's used on contracts only. Split sheets keep your artist name.</p>
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

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Contract style<InfoTip text="How your header looks on contracts and split sheets made with this kit." /></Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {KIT_STYLES.map((st) => (
            <button key={st.id} type="button" onClick={() => edit({ style: st.id })} aria-pressed={kit.style === st.id}
              className={`rounded-lg border p-3 text-left text-sm transition ${kit.style === st.id ? "border-primary ring-2 ring-ring" : "border-border hover:border-primary/60"}`}>
              <StyleThumb style={st.id} color={kit.colors.find(isHex) ?? "#0b0b0b"} />
              <span className="mt-2 block font-semibold">{st.label}</span>
              <span className="block text-xs text-muted-foreground">{st.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Contract section titles<InfoTip text="The color of the numbered titles in your contracts (1. TERMS, 2. PAYMENT…). Black unless you pick a color. Dark colors read best." /></Label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="color" aria-label="Section title color" value={kit.headerColor ?? "#0b0b0b"} onChange={(e) => edit({ headerColor: e.target.value.toUpperCase() })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
          <Input aria-label="Section title color code" value={kit.headerColor ?? ""} placeholder="#0B0B0B (black)" maxLength={7}
            onChange={(e) => { const v = e.target.value.trim(); edit({ headerColor: v ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null }); }}
            className={`h-8 w-36 font-mono text-xs ${!kit.headerColor || isHex(kit.headerColor) ? "" : "border-destructive"}`} />
          {kit.headerColor && <Button variant="ghost" size="sm" onClick={() => edit({ headerColor: null })}>Use black</Button>}
          <span className="text-xs text-muted-foreground">Dark colors read best.</span>
        </div>
      </div>

      {/* More ways to style contracts (founder, 2026-10-28). */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold">More contract options</legend>
        <label className="flex items-start justify-between gap-4">
          <span><span className="block text-sm font-semibold">Logo watermark on page 1</span><span className="text-xs text-muted-foreground">A faint copy of your logo behind the text. Needs a logo.</span></span>
          <Switch checked={kit.options.watermark} disabled={!kit.logoPath} onCheckedChange={(v) => edit({ options: { ...kit.options, watermark: v } })} />
        </label>
        <label className="flex items-start justify-between gap-4">
          <span><span className="block text-sm font-semibold">Cover page</span><span className="text-xs text-muted-foreground">An opening page with your logo, name and the contract title.</span></span>
          <Switch checked={kit.options.cover} onCheckedChange={(v) => edit({ options: { ...kit.options, cover: v } })} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold">Signatures</span>
          <div role="radiogroup" aria-label="Signature style" className="flex rounded-lg border border-border p-0.5">
            {([["line", "Line"], ["box", "Box"]] as const).map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={kit.options.signature === v} onClick={() => edit({ options: { ...kit.options, signature: v } })}
              className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.signature === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold">Corners</span>
          <div role="radiogroup" aria-label="Corners" className="flex rounded-lg border border-border p-0.5">
            {([["rounded", "Rounded"], ["square", "Square"]] as const).map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={kit.options.corners === v} onClick={() => edit({ options: { ...kit.options, corners: v } })}
              className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.corners === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span><span className="block text-sm font-semibold">Second accent color</span><span className="text-xs text-muted-foreground">For signer names, signature lines and boxes, and the footer line.</span></span>
          <span className="flex items-center gap-2">
            <input type="color" aria-label="Second accent color" value={kit.options.accent ?? "#0b0b0b"} onChange={(e) => edit({ options: { ...kit.options, accent: e.target.value.toUpperCase() } })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
            <Input aria-label="Second accent color code" value={kit.options.accent ?? ""} placeholder="Same as titles" maxLength={7}
              onChange={(e) => { const v = e.target.value.trim(); edit({ options: { ...kit.options, accent: v ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null } }); }}
              className={`h-8 w-32 font-mono text-xs ${!kit.options.accent || isHex(kit.options.accent) ? "" : "border-destructive"}`} />
            {kit.options.accent && <Button variant="ghost" size="sm" onClick={() => edit({ options: { ...kit.options, accent: null } })}>Clear</Button>}
          </span>
        </div>
      </fieldset>

      <Disclaimer k="branding" />

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
        <div className={`relative overflow-hidden rounded-xl border border-border bg-white p-5 text-[#0b0b0b] ${kit.style === "sidebar" ? "pl-8" : ""}`}>
          {kit.style === "sidebar" && <span aria-hidden className="absolute inset-y-0 left-0 w-3" style={{ background: stripe[0] ?? "#0b0b0b" }} />}
          {kit.style === "banner" && <span aria-hidden className="absolute inset-x-0 top-0 h-[4.5rem]" style={{ background: stripe[0] ?? "#0b0b0b" }} />}
          <div className={`relative flex items-center gap-4 ${kit.style === "minimal" ? "hidden" : ""}`}>
            {logoUrl && <img src={logoUrl} alt="" className="h-12 max-w-[9rem] object-contain" />}
            <div className="min-w-0">
              <p className="truncate text-xl font-bold" style={{ fontFamily: kit.font, color: kit.style === "banner" ? onBand(stripe[0]) : nameColor }}>{kit.name || "Your name"}</p>
              {kit.tagline && <p className="truncate text-xs font-medium" style={{ fontFamily: kit.font, color: kit.style === "banner" ? onBand(stripe[0]) : taglineColor ?? "#525252" }}>{kit.tagline}</p>}
            </div>
          </div>
          {kit.style === "classic" && <div className="mt-3 flex h-1 overflow-hidden rounded-full">
            {(stripe.length ? stripe : ["#0b0b0b"]).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
          </div>}
          <p className={`relative text-2xl font-bold ${kit.style === "banner" ? "mt-6" : "mt-4"}`}>Producer Agreement</p>
          <p className="relative mt-3 text-sm font-bold" style={{ color: kit.headerColor && isHex(kit.headerColor) ? kit.headerColor : "#0b0b0b" }}>1. TERMS</p>
          <p className="relative text-xs text-[#525252]">The contract text reads in black, with your section titles in this color.</p>
          {kit.options.watermark && logoUrl && <img src={logoUrl} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-24 max-w-[60%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.07]" />}
          <div className={`relative mt-4 border px-3 py-2 text-xs ${kit.options.signature === "box" ? "" : "border-x-0 border-t-0"} ${kit.options.corners === "rounded" ? "rounded-md" : ""}`} style={{ borderColor: kit.options.accent ?? kit.headerColor ?? "#0b0b0b" }}>
            <span className="font-bold" style={{ color: kit.options.accent ?? kit.headerColor ?? "#0b0b0b" }}>ARTIST</span><span className="ml-2 text-[#525252]">Signature</span>
          </div>
          {kit.options.cover && <p className="relative mt-2 text-[10px] text-[#525252]">+ Cover page with your logo, name and the contract title.</p>}
          {kit.style === "minimal" && <div className="relative mt-4 flex items-center justify-between text-[10px] text-[#525252]"><span>{kit.name || "Your name"}</span>{logoUrl && <img src={logoUrl} alt="" className="h-5 max-w-[4rem] object-contain" />}</div>}
          {kit.showFooter && <p className="mt-4 text-[10px] text-[#525252]">Generated on camethroughaudio.com · <span className="font-medium tracking-[2px]">YOUR FIRST STOP BEFORE DISTRIBUTION</span></p>}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={busy || saved}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saved ? "Saved" : "Save brand kit"}</Button>
    </div>
  );
}

/** Light text on a dark band, dark text on a light one (matches the PDF). */
function onBand(hex?: string) {
  if (!hex || !isHex(hex)) return "#FFFFFF";
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? "#0b0b0b" : "#FFFFFF";
}

/** A tiny page sketch of each contract style. */
function StyleThumb({ style, color }: { style: KitStyle; color: string }) {
  return (
    <span aria-hidden className="relative block h-16 overflow-hidden rounded border border-border bg-white">
      {style === "sidebar" && <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />}
      {style === "banner" && <span className="absolute inset-x-0 top-0 h-4" style={{ background: color }} />}
      {style === "classic" && <span className="absolute left-2 right-2 top-4 h-0.5" style={{ background: color }} />}
      {style === "minimal" && <span className="absolute bottom-1.5 right-2 h-1.5 w-4 rounded-sm" style={{ background: color }} />}
      <span className={`absolute left-3 right-3 h-1 rounded bg-[#d4d4d4] ${style === "banner" ? "top-6" : "top-6"}`} />
      <span className="absolute left-3 right-6 top-9 h-1 rounded bg-[#e5e5e5]" />
      <span className="absolute left-3 right-4 top-11 h-1 rounded bg-[#e5e5e5]" />
    </span>
  );
}

