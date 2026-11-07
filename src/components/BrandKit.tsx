import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { AlertTriangle, ArrowDown, ArrowUp, Check, FileDown, ImagePlus, Loader2, Lock, Plus, Redo2, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/InfoTip";
import { BRAND_FONTS, BRANDING_PRICE, KIT_STYLES, LOGO_NUDGE_MAX, contrastWarnings, emptyHistory, emptyKit, isHex, kitFromRow, logoNudgeValue, recordHistory, redoHistory, undoHistory, withColorSet, withoutColorSet, type BrandKit as Kit, type KitHistory, type KitStyle } from "@/lib/brand-kit";
import { logoPalette } from "@/lib/logo-colors";
import { downloadSamplePdf, type SampleKind } from "@/lib/sample-pdf";
import { FONT_GROUPS } from "@/lib/brand-fonts";
import { loadWebFont } from "@/lib/web-fonts";
import { Disclaimer } from "@/components/Disclaimer";
import { getBrandAccess } from "@/lib/brand-kit.functions";
import { openCheckout } from "@/lib/checkout";
import { hasTier, TIER_LABEL, type Tier } from "@/lib/plans";

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
  // Colours read from the logo just uploaded: suggestions, applied only when the member clicks (founder, 2026-11-06).
  const [fromLogo, setFromLogo] = useState<string[]>([]);
  /** Which document the preview shows (founder, 2026-11-06). */
  const [preview, setPreview] = useState<SampleKind>("contract");
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Undo and redo of the kit being edited; cleared when another kit is opened (founder, 2026-11-07). */
  const [history, setHistory] = useState<KitHistory>(emptyHistory);
  const [setName, setSetName] = useState("");
  /**
   * Every kit exactly as the load or the last save left it, indexed like `kits` (founder, 2026-11-07). Leaving a kit with
   * unsaved edits puts its copy back, and Revert does the same in one click, so a disliked change never needs fifty undos
   * and a dropped edit can't ride along into a later Save.
   */
  const origin = useRef<Kit[]>([]);
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
      if (!list.length) { origin.current = [emptyKit(artistName)]; return setSaved(false); }
      const loaded = list.map((k) => ({ ...k, name: k.name || artistName }));
      setKits(loaded);
      origin.current = loaded.map((k) => structuredClone(k));
      const urls: Record<string, string> = {};
      for (const k of list) {
        for (const path of k.logoPaths) {
          if (urls[path]) continue;
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
          if (signed?.signedUrl) urls[path] = signed.signedUrl;
        }
      }
      if (live) setLogoUrls(urls);
    })();
    return () => { live = false; };
  }, [userId, tier]);

  // Only the chosen font is downloaded, for the preview (the PDF loads the same files).
  useEffect(() => { loadWebFont(kit.font); }, [kit.font]);

  // ⌘Z and ⇧⌘Z (Ctrl on Windows) anywhere in the editor; a text field keeps its own undo, so typing is never hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const edit = (patch: Partial<Kit>) => { setHistory((h) => recordHistory(h, kit)); setKit((k) => ({ ...k, ...patch })); setSaved(false); };
  /** Back and forward through every edit above, so a colour can be tried and taken back without retyping the kit. */
  const undo = () => { const step = undoHistory(history, kit); if (!step) return; setHistory(step.history); setKit(step.kit); setSaved(false); };
  const redo = () => { const step = redoHistory(history, kit); if (!step) return; setHistory(step.history); setKit(step.kit); setSaved(false); };
  const setColor = (i: number, v: string) => edit({ colors: kit.colors.map((c, j) => (j === i ? v : c)) });

  /** Puts the saved copy back, so edits the member is leaving behind can't be saved later by accident. */
  const restoreSaved = () => {
    const back = origin.current[current];
    if (back) setKit(structuredClone(back));
  };

  /**
   * Opening another kit or adding one never waits for a Save (founder, 2026-11-07): it asks once, because leaving with
   * unsaved edits drops them, and the kit then opens exactly as it was last saved.
   */
  async function leaveCurrent(): Promise<boolean> {
    if (saved) return true;
    const ok = await confirmAction({
      title: `Leave "${kit.name || `Kit ${current + 1}`}" without saving?`,
      text: "Your unsaved changes to this kit are dropped and it opens as you last saved it. Cancel, then Save, to keep them.",
      action: "Discard changes",
    });
    if (!ok) return false;
    restoreSaved();
    setSaved(true);
    return true;
  }

  async function openKit(i: number) {
    if (i === current) return;
    if (!(await leaveCurrent())) return;
    setHistory(emptyHistory());
    setSetName("");
    setCurrent(i);
    setSaved(true);
  }

  async function addKit() {
    if (!(await leaveCurrent())) return;
    const fresh = emptyKit("");
    origin.current.push(structuredClone(fresh));
    setHistory(emptyHistory());
    setSetName("");
    setKits((all) => [...all, fresh]);
    setCurrent(kits.length);
    setSaved(false);
  }

  /** One click back to the saved kit instead of undoing every change; the revert itself can be undone (⌘Z). */
  function revert() {
    const back = origin.current[current];
    if (!back || saved) return;
    setHistory((h) => recordHistory(h, kit));
    setKit(structuredClone(back));
    setSaved(true);
    toast.success("Back to your last saved kit.");
  }

  async function uploadLogo(file: File) {
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.error("Use a PNG or JPG logo."); return; }
    if (file.size > MAX_LOGO) { toast.error("That logo is over 2 MB. Try a smaller file."); return; }
    setBusy(true);
    try {
      // Every upload writes its own file, so adding a logo adds a version instead of overwriting the one already in use
      // (founder, 2026-11-07). A kit's original logo.png is simply one more version alongside the new ones.
      const path = `${userId}/logo-${crypto.randomUUID().slice(0, 8)}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      // Every version is kept, so one can be switched in later without rebuilding the kit (founder, 2026-11-06).
      edit({ logoPath: path, logoPaths: [path, ...kit.logoPaths.filter((p) => p !== path)] });
      setLogoUrls((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
      // Read its colours while the browser already has the file: nothing extra is uploaded and no server work is spent.
      setFromLogo(await logoPalette(file));
    } catch { toast.error("Your logo couldn't upload. Try again."); }
    finally { setBusy(false); }
  }

  /** Deletes one logo version; if it was the one in use, the next version takes over. */
  async function removeLogoVersion(path: string) {
    await supabase.storage.from(BUCKET).remove([path]);
    const left = kit.logoPaths.filter((p) => p !== path);
    setLogoUrls((m) => { const next = { ...m }; delete next[path]; return next; });
    edit({ logoPaths: left, logoPath: kit.logoPath === path ? left[0] ?? null : kit.logoPath });
  }

  /** Switches the version this kit prints, without touching anything else in the kit. */
  const useLogo = (path: string) => edit({ logoPath: path });
  /** Moves the logo by half a millimetre, kept inside the kit's limits (founder, 2026-11-07). */
  const nudgeLogo = (d: number) => edit({ options: { ...kit.options, logoNudge: logoNudgeValue(kit.options.logoNudge + d) } });
  // Dragging the logo thumbnail moves it while the pointer is down, and the whole gesture lands as one change, so undo
  // takes back the drag rather than a tenth of a millimetre of it (founder, 2026-11-07).
  const [dragFrom, setDragFrom] = useState<{ y: number; nudge: number } | null>(null);
  const [dragNudge, setDragNudge] = useState<number | null>(null);
  const shownNudge = dragNudge ?? kit.options.logoNudge;
  /** Pixels of drag per millimetre: a short throw on a 48px thumbnail still reaches the whole range. */
  const DRAG_PX_PER_MM = 4;
  function startLogoDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragFrom({ y: e.clientY, nudge: kit.options.logoNudge });
    setDragNudge(kit.options.logoNudge);
  }
  function moveLogoDrag(e: PointerEvent<HTMLDivElement>) {
    if (!dragFrom) return;
    setDragNudge(logoNudgeValue(dragFrom.nudge + (e.clientY - dragFrom.y) / DRAG_PX_PER_MM));
  }
  function endLogoDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const settled = dragNudge;
    setDragFrom(null);
    setDragNudge(null);
    if (settled !== null && settled !== kit.options.logoNudge) edit({ options: { ...kit.options, logoNudge: settled } });
  }
  function onLogoKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.5;
    if (e.key === "ArrowUp") { e.preventDefault(); nudgeLogo(-step); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudgeLogo(step); }
  }
  // The preview's own scale: the name is 20px here for the PDF's 14 pt, so a millimetre of movement in print covers the
  // same fraction of the name on screen. That ratio is what has to match for the artwork to line up with the letters.
  const pxPerMm = 20 / 4.94;
  const logoRight = !!logoUrl && kit.options.logoAlign === "right";
  const snapClass = kit.options.logoSnap === "top" ? "items-start" : kit.options.logoSnap === "bottom" ? "items-end" : "items-center";
  // The side is a flex order rather than the DOM order, so the name stays first for a screen reader either way.
  const logoImage = logoUrl ? (
    <img src={logoUrl} alt="" className={`h-12 max-w-[9rem] shrink-0 object-contain ${logoRight ? "order-2" : "order-1"}`}
      style={{ transform: `translateY(${(shownNudge * pxPerMm).toFixed(1)}px)` }} />
  ) : null;

  /** A one-page print of the kit, drawn with the same header and footer every download uses (founder, 2026-11-06). */
  async function sample() {
    setBusy(true);
    try {
      const dataUrl = logoUrl ? await (await fetch(logoUrl)).blob().then((b) => new Promise<string>((ok, no) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => no(new Error("logo"));
        fr.readAsDataURL(b);
      })) : null;
      const { logoPath: _active, ...rest } = kit;
      await downloadSamplePdf({ ...rest, logo: dataUrl ? { dataUrl } : null }, preview, artistName);
    } catch { toast.error("Couldn't make the sample PDF. Try again."); }
    finally { setBusy(false); }
  }

  async function save() {
    const bad = kit.colors.find((c) => !isHex(c));
    if (bad) { toast.error(`"${bad}" isn't a color code. Use 6 digits like #004AAD.`); return; }
    const badExtra = [kit.headerColor, kit.options.accent].find((c) => c && !isHex(c));
    if (badExtra) { toast.error(`"${badExtra}" isn't a color code. Use 6 digits like #0B0B0B.`); return; }
    setBusy(true);
    try {
      const base = { user_id: userId, name: kit.name.trim(), tagline: kit.tagline.trim(), colors: kit.colors.map((c) => c.toUpperCase()), font: kit.font, logo_path: kit.logoPath, logo_paths: kit.logoPaths, show_footer: kit.showFooter, updated_at: new Date().toISOString() };
      const row = { ...base, style: kit.style, header_color: kit.headerColor, options: kit.options, color_sets: kit.colorSets };
      let newId: string | undefined;
      if (kit.id) {
        const { error } = await supabase.from("brand_kits" as never).update(row as never).eq("id", kit.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("brand_kits" as never).insert(row as never).select("id").single();
        if (error && /options/.test(error.message)) throw new Error("The new kit options need the latest database update. Ask support to run migration 20261028090000.");
        if (error && /logo_paths/.test(error.message)) throw new Error("Logo versions need the latest database update. Ask support to run migration 20261106140000.");
        if (error && /color_sets/.test(error.message)) throw new Error("Saved colour sets need the latest database update. Ask support to run migration 20261107120000.");
        if (error) {
          // Before migration 20261027210000: one kit per person and no style or header color yet.
          if (kits.length > 1) throw new Error("More than one Branding Kit needs the latest database update. Ask support to run migration 20261027210000.");
          const { error: legacy } = await supabase.from("brand_kits" as never).upsert(base as never, { onConflict: "user_id" });
          if (legacy) throw legacy;
        } else { const id = (data as { id: string }).id; newId = id; setKit((k) => ({ ...k, id })); }
      }
      // What Revert goes back to, carrying the id a first save has just gained (founder, 2026-11-07).
      origin.current[current] = { ...kit, name: kit.name.trim(), tagline: kit.tagline.trim(), colors: kit.colors.map((c) => c.toUpperCase()), ...(newId ? { id: newId } : {}) };
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
      origin.current.splice(current, 1);
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
        <p className="text-sm">On your split sheets, the contracts you make, and your lyric and catalog downloads. Included with {TIER_LABEL.management}, or add it to any plan for {BRANDING_PRICE}/year.</p>
        <Button onClick={() => void buy()}><Lock className="h-4 w-4" />Add Personal Branding · {BRANDING_PRICE}/year</Button>
      </div>
    );
  }

  const where = "Your contracts, split sheets, lyric downloads and catalog downloads";
  // Before the multi-kit update the server doesn't send a count: one kit.
  const allowance = Math.max(1, access.allowance ?? 1);
  const ending = access.addOnUntil && tier !== "management" ? Date.parse(access.addOnUntil) - Date.now() < 30 * 86400000 : false;
  const nameColor = kit.colors[0] && isHex(kit.colors[0]) ? kit.colors[0] : undefined;
  const taglineColor = kit.colors[1] && isHex(kit.colors[1]) ? kit.colors[1] : undefined;
  /**
   * A tagline's colour is the kit's second colour, so the picker by the tagline field and the Colours area are the same
   * value seen in two places (founder, 2026-11-07). With no colours yet, black names the documents and grey stays the
   * tagline's default.
   */
  function setTaglineColor(hex: string) {
    const next = [...kit.colors];
    while (next.length < 2) next.push(next.length === 0 ? "#0b0b0b" : "#525252");
    next[1] = hex;
    edit({ colors: next });
  }
  const stripe = kit.colors.filter(isHex);
  // The line under a Classic header: one solid line in the kit's accent, the same colour the PDF draws (kitAccent).
  const accent = [kit.options.accent, kit.headerColor].find((c) => c && isHex(c)) ?? "#0b0b0b";
  // Colours that will be hard to read on the white page: a warning, never a block (founder, 2026-11-06).
  const warns = contrastWarnings(kit);
  // A split sheet shows the artist's name, never a business name; the server swaps it for the real download too.
  const previewName = preview === "split" ? artistName.trim() || kit.name : kit.name;
  // The four styles added on 2026-11-07 draw their own heading in the preview, so the settled one steps aside for them.
  const freshHeader = kit.style === "label" || kit.style === "ticket" || kit.style === "frame" || kit.style === "editorial";

  return (
    <div className="space-y-6">
      {justBought && (
        <div className="rounded-xl border border-primary bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Your Branding Kit is ready.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Add your logo, name, tagline, colors and font right here, then click Save.</li>
            <li>Make a contract in Contracts &amp; Blueprints, a split sheet in Split Sheets, or download a lyric or catalog PDF from My Catalog: your kit replaces our header automatically.</li>
            <li>Come back to Profile → Brand kit anytime to change it.</li>
          </ol>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {where} carry this header in place of ours.
        {tier === "management" ? ` Included with ${TIER_LABEL.management}.` : access.addOnUntil ? ` Personal Branding runs until ${longDate(access.addOnUntil)}, even if your plan changes before then.` : ""}
      </p>
      {ending && <Button variant="outline" onClick={() => void buy()}>Add another year · {BRANDING_PRICE}</Button>}

      {/* Several kits, one per business or project; each contract picks its kit. */}
      <div className="flex flex-wrap items-center gap-2">
        {kits.map((k, i) => (
          <Button key={k.id ?? `new-${i}`} size="sm" variant={i === current ? "default" : "outline"} onClick={() => void openKit(i)} title={i === current ? undefined : saved ? `Open ${k.name || `Kit ${i + 1}`}` : "Opens as you last saved it; the unsaved changes here are dropped"}>
            {k.name || `Kit ${i + 1}`}{i === 0 && kits.length > 1 ? " · main" : ""}
          </Button>
        ))}
        {kits.length < allowance
          ? <Button size="sm" variant="ghost" onClick={() => void addKit()}><Plus className="h-4 w-4" />Add a kit</Button>
          : <Button size="sm" variant="ghost" onClick={() => void buy()}><Plus className="h-4 w-4" />Add another kit · {BRANDING_PRICE}/year</Button>}
        {kits.length > 1 && kit.id && <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => void removeKit()}><Trash2 className="h-4 w-4" />Delete this kit</Button>}
      </div>
      {kits.length > allowance && <p className="text-sm">⚠️ You have {kits.length} kits and {allowance} {allowance === 1 ? "is" : "are"} active. Documents use your first {allowance === 1 ? "kit" : `${allowance} kits`}; add another kit for {BRANDING_PRICE}/year to use the rest.</p>}

      {/* Editor on the left, the live preview on the right and pinned while scrolling (founder, 2026-11-06): every change
          shows as it's made. On a phone the preview follows the editor. */}
      <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bk-name" className="flex items-center gap-1.5">Name on your contracts<InfoTip text="The name at the top of your branded contracts: your business, label, DBA or artist name. Split sheets always show your artist name, and your artist name in My Catalog, Embed Metadata and everywhere else stays the same." /></Label>
          <Input id="bk-name" value={kit.name} maxLength={80} placeholder="Business or artist name" onChange={(e) => edit({ name: e.target.value })} />
          {!kit.name.trim() && artistName.trim() && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => edit({ name: artistName.trim() })}><Check className="h-3.5 w-3.5" />Use my artist name: {artistName.trim()}</Button>}
          <p className="text-xs text-muted-foreground">Starts as your artist name. Change it to a company or DBA name if you like; it's used on contracts only. Split sheets keep your artist name.</p>
          {/* The footer switch lives here now, at the foot of the name box (founder, 2026-11-07). Only the plans that may
              drop the footer see it at all. */}
          {hasTier(tier, "collaborate") && (
            <label htmlFor="bk-footer" className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Switch id="bk-footer" className="scale-75" checked={kit.showFooter} onCheckedChange={(v) => edit({ showFooter: v })} />
              Footer: "Made on Camethroughaudio.com"
            </label>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bk-tagline" className="flex items-center gap-1.5">Tagline<InfoTip text="Optional. A short line under your name, like your slogan." /></Label>
          <Input id="bk-tagline" value={kit.tagline} maxLength={80} onChange={(e) => edit({ tagline: e.target.value })} />
          {/* The tagline's colour lives with the tagline (founder, 2026-11-07), and it is the same value as Colours 2. */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="color" aria-label="Tagline color" value={taglineColor ?? "#525252"} onChange={(e) => setTaglineColor(e.target.value.toUpperCase())} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
            <Input aria-label="Tagline color code" value={kit.colors[1] ?? ""} maxLength={7} placeholder="#525252 (grey)"
              onChange={(e) => { const v = e.target.value.trim(); if (v) setTaglineColor(v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`); }}
              className={`h-8 w-28 font-mono text-xs ${!kit.colors[1] || isHex(kit.colors[1]) ? "" : "border-destructive"}`} />
          </div>
          <p className="text-xs text-muted-foreground">Your tagline&apos;s colour — the same as the second colour in Colors. Grey unless you pick one.</p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">Logo<InfoTip text="Optional. PNG or JPG, up to 2 MB. A wide logo with a clear background looks best. Keep as many versions as you like and switch between them." /></Label>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl && (
              // Click and grab to move it (founder, 2026-11-07): the thumbnail itself is the handle, so nothing has to sit
              // over the preview. The arrows work too, for a keyboard.
              <div
                role="slider" tabIndex={0}
                aria-label="Your logo: drag up or down, or press the arrow keys, to line it up with your name"
                aria-valuemin={-LOGO_NUDGE_MAX} aria-valuemax={LOGO_NUDGE_MAX} aria-valuenow={shownNudge}
                aria-valuetext={`${shownNudge > 0 ? "Down" : shownNudge < 0 ? "Up" : "On the line"} ${Math.abs(shownNudge).toFixed(1)} millimetres`}
                title="Drag up or down to line your logo up with your name"
                onPointerDown={startLogoDrag} onPointerMove={moveLogoDrag} onPointerUp={endLogoDrag} onPointerCancel={endLogoDrag}
                onKeyDown={onLogoKey}
                className={`touch-none select-none rounded ${dragFrom ? "cursor-grabbing ring-2 ring-ring" : "cursor-ns-resize"}`}
              >
                <img src={logoUrl} alt="Your logo" draggable={false}
                  className="pointer-events-none h-12 max-w-[10rem] rounded border border-border bg-white object-contain p-1" />
              </div>
            )}
            <Button asChild variant="outline" size="sm" disabled={busy}>
              <label className="cursor-pointer"><ImagePlus className="h-4 w-4" />{kit.logoPaths.length ? "Add a version" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />
              </label>
            </Button>
          </div>
          {kit.logoPaths.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold">Logo versions <span className="font-normal text-muted-foreground">— click one to use it</span></p>
              <ul className="flex flex-wrap gap-2">
                {kit.logoPaths.map((path, i) => (
                  <li key={path} className={`flex items-center gap-1 rounded-lg border p-1 ${path === kit.logoPath ? "border-primary ring-1 ring-ring" : "border-border"}`}>
                    <button type="button" onClick={() => useLogo(path)} aria-pressed={path === kit.logoPath} title={`Use logo version ${i + 1}`} className="h-9 w-16 overflow-hidden rounded bg-white">
                      {logoUrls[path] ? <img src={logoUrls[path]} alt={`Logo version ${i + 1}`} className="h-full w-full object-contain" /> : <span className="block text-center text-[10px] text-muted-foreground">…</span>}
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete logo version ${i + 1}`} onClick={() => void removeLogoVersion(path)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Switching a version changes the logo only; the rest of the kit stays as it is.</p>
            </div>
          )}
          {/* Where the logo sits (founder, 2026-11-07): a side, a line to line up with, then movement by the millimetre,
              because a logo file often carries empty space above its ink and no snap can find the ink by itself. */}
          {kit.logoPath && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              {/* Label centres the heading, so a side would be a control that does nothing: it says so instead. */}
              {kit.style === "label" ? (
                <p className="text-xs text-muted-foreground">Label centres your logo above your name, so the side doesn't apply. The line-up and the movement still move it.</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Logo side</span>
                  <div role="radiogroup" aria-label="Logo side" className="flex rounded-lg border border-border p-0.5">
                    {([["left", "Left"], ["right", "Right"]] as const).map(([v, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={kit.options.logoAlign === v} onClick={() => edit({ options: { ...kit.options, logoAlign: v } })}
                        className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.logoAlign === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Line up with your name</span>
                <div role="radiogroup" aria-label="Logo line" className="flex rounded-lg border border-border p-0.5">
                  {([["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]] as const).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={kit.options.logoSnap === v} onClick={() => edit({ options: { ...kit.options, logoSnap: v } })}
                      className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.logoSnap === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold">Move it up or down<InfoTip text="Grab the logo above and drag it up or down, or nudge it with the arrows. A logo file often has empty space above the artwork, so moving it a few millimetres is what lines the artwork itself — not the empty box — up with your name." /></span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Move the logo up" onClick={() => nudgeLogo(-0.5)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Move the logo down" onClick={() => nudgeLogo(0.5)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <input type="range" aria-label="Move the logo up or down" min={-LOGO_NUDGE_MAX} max={LOGO_NUDGE_MAX} step={0.5} value={kit.options.logoNudge}
                    onChange={(e) => edit({ options: { ...kit.options, logoNudge: logoNudgeValue(e.target.value) } })} className="h-8 min-w-[8rem] flex-1 accent-primary" />
                  <Input type="number" aria-label="Logo movement in millimetres" step={0.1} min={-LOGO_NUDGE_MAX} max={LOGO_NUDGE_MAX} value={kit.options.logoNudge}
                    onChange={(e) => edit({ options: { ...kit.options, logoNudge: logoNudgeValue(e.target.value) } })} className="h-8 w-20 font-mono text-xs" />
                  <span className="text-xs text-muted-foreground">mm</span>
                  {kit.options.logoNudge !== 0 && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => edit({ options: { ...kit.options, logoNudge: 0 } })}>Reset</Button>}
                </div>
                <p className="text-xs text-muted-foreground">{shownNudge === 0 ? "On the line you picked." : `${shownNudge > 0 ? "Down" : "Up"} ${Math.abs(shownNudge).toFixed(1)} mm from the line you picked.`} Positive moves it down. Drag the logo to do it by eye, and the preview shows where it lands.</p>
              </div>
              {kit.style === "minimal" && <p className="text-xs text-muted-foreground">Minimal kits put the logo in the footer, so these only matter if you switch to another style.</p>}
            </div>
          )}
          {fromLogo.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Colours from your logo</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {fromLogo.map((c) => (
                  <button key={c} type="button" title={`Add ${c}`} aria-label={`Add ${c}`} onClick={() => edit({ colors: kit.colors.includes(c) ? kit.colors : [...kit.colors, c] })}
                    className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs">
                    <span aria-hidden className="h-4 w-4 rounded" style={{ background: c }} />{c}<Plus className="h-3 w-3" />
                  </button>
                ))}
                <Button size="sm" variant="outline" onClick={() => {
                  // Darkest first, so the name and tagline are the darkest shades and the section heads take the darkest too
                  // (founder, 2026-11-07). A section-title colour the member already picked is left alone.
                  const darkest = fromLogo[0];
                  edit({ colors: fromLogo, ...(darkest && !kit.headerColor ? { headerColor: darkest } : {}) });
                  toast.success(darkest ? "Your logo's colours are in, darkest first: the darkest names your documents and heads your sections, the next sets your tagline." : "Your logo's colours are in.");
                }}>Use these colours</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Darkest first. Drawn from the file you uploaded, not guessed. Tap one to add it alone, or take them all.</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bk-font" className="flex items-center gap-1.5">Font<InfoTip text="The font for your name and tagline. The rest of the document stays in our easy-to-read font." /></Label>
          <select id="bk-font" value={kit.font} onChange={(e) => edit({ font: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {FONT_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.fonts.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>)}
          </select>
          <p className="text-xs text-muted-foreground">{BRAND_FONTS.length} fonts. Pick one and the preview shows it.</p>
        </div>
      </div>

      {/* Contract style sits above Colors and under the font (founder, 2026-11-07): pick the look, then the colours it wears. */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Contract style<InfoTip text="How your header looks on contracts and split sheets made with this kit." /></Label>
        <div className="grid grid-cols-2 gap-2">
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
        <Label className="flex items-center gap-1.5">Colors<InfoTip text="Add as many as you like. The first colors your name and the second your tagline." /></Label>
        <div className="flex flex-wrap gap-3">
          {kit.colors.map((c, i) => (
            // Every colour says what it paints (founder, 2026-11-07), so a member never removes the wrong one.
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-1.5">
              <span className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{colorTitle(i)}</span>
              <div className="flex items-center gap-1.5">
                <input type="color" aria-label={`${colorTitle(i)} color`} value={isHex(c) ? c : "#000000"} onChange={(e) => setColor(i, e.target.value.toUpperCase())} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                <Input aria-label={`${colorTitle(i)} color code`} value={c} maxLength={7} onChange={(e) => setColor(i, e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} className={`h-8 w-24 font-mono text-xs ${isHex(c) ? "" : "border-destructive"}`} />
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove the ${colorTitle(i).toLowerCase()} color`} onClick={() => edit({ colors: kit.colors.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-11" onClick={() => edit({ colors: [...kit.colors, kit.colors.length ? "#4D8CFF" : "#004AAD"] })}><Plus className="h-4 w-4" />Add color</Button>

          {/* The colours that used to sit in their own fields (founder, 2026-11-07): now they line up with the palette, each
              with its own title, so every colour choice is in one place. Blank still prints the black it always printed. */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-1.5">
            <span className="flex items-center gap-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Section titles<InfoTip text="The color of the numbered titles in your contracts (1. TERMS, 2. PAYMENT…). Black unless you pick a color. Dark colors read best." /></span>
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="Section title color" value={kit.headerColor ?? "#0b0b0b"} onChange={(e) => edit({ headerColor: e.target.value.toUpperCase() })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <Input aria-label="Section title color code" value={kit.headerColor ?? ""} placeholder="#0B0B0B (black)" maxLength={7}
                onChange={(e) => { const v = e.target.value.trim(); edit({ headerColor: v ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null }); }}
                className={`h-8 w-28 font-mono text-xs ${!kit.headerColor || isHex(kit.headerColor) ? "" : "border-destructive"}`} />
              {kit.headerColor && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => edit({ headerColor: null })}>Black</Button>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-1.5">
            <span className="flex items-center gap-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Document title<InfoTip text="The colour of the document's own title, like “Producer Agreement” at the top of a contract. Black unless you pick a colour. Dark colours read best." /></span>
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="Document title color" value={kit.options.titleColor ?? "#0b0b0b"} onChange={(e) => edit({ options: { ...kit.options, titleColor: e.target.value.toUpperCase() } })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <Input aria-label="Document title color code" value={kit.options.titleColor ?? ""} placeholder="#0B0B0B (black)" maxLength={7}
                onChange={(e) => { const v = e.target.value.trim(); edit({ options: { ...kit.options, titleColor: v ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null } }); }}
                className={`h-8 w-28 font-mono text-xs ${!kit.options.titleColor || isHex(kit.options.titleColor) ? "" : "border-destructive"}`} />
              {kit.options.titleColor && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => edit({ options: { ...kit.options, titleColor: null } })}>Black</Button>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-1.5">
            <span className="flex items-center gap-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Second accent<InfoTip text="For signer names, signature lines and boxes. Blank uses your section titles' colour." /></span>
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="Second accent color" value={kit.options.accent ?? "#0b0b0b"} onChange={(e) => edit({ options: { ...kit.options, accent: e.target.value.toUpperCase() } })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              <Input aria-label="Second accent color code" value={kit.options.accent ?? ""} placeholder="Same as titles" maxLength={7}
                onChange={(e) => { const v = e.target.value.trim(); edit({ options: { ...kit.options, accent: v ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null } }); }}
                className={`h-8 w-28 font-mono text-xs ${!kit.options.accent || isHex(kit.options.accent) ? "" : "border-destructive"}`} />
              {kit.options.accent && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => edit({ options: { ...kit.options, accent: null } })}>Clear</Button>}
            </div>
          </div>
        </div>
        {warns.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            {warns.map((w) => (
              <li key={`${w.field}-${w.hex}`} className={`flex items-start gap-2 ${w.severe ? "text-destructive" : "text-muted-foreground"}`}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span><span className="font-semibold">{w.label}</span> in {w.hex} is {w.severe ? "very hard" : "hard"} to read on a white page ({w.ratio}:1). {w.severe ? "Pick a darker or lighter colour." : "4.5:1 or more reads comfortably."}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Saved palettes (founder, 2026-11-07): name the colours once, put the whole set back in one click. */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Colour sets<InfoTip text="Save the colours you use as a palette, then put a whole palette back in one click. Saved with this kit, so they're there on any device." /></Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="New colour set name" value={setName} maxLength={40} placeholder="Name this palette" onChange={(e) => setSetName(e.target.value)} className="h-9 w-52" />
          <Button size="sm" variant="outline" disabled={!setName.trim() || !kit.colors.length} onClick={() => {
            const name = setName.trim();
            if (!name) return;
            edit({ colorSets: withColorSet(kit.colorSets, { name, colors: kit.colors }) });
            setSetName("");
            toast.success(`“${name}” is ready. Click Save to keep it.`);
          }}><Plus className="h-4 w-4" />Save this palette</Button>
        </div>
        {kit.colorSets.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {kit.colorSets.map((set) => (
              <li key={set.name} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
                <span aria-hidden className="flex overflow-hidden rounded">
                  {set.colors.map((c) => <span key={c} className="h-6 w-3" style={{ background: c }} />)}
                </span>
                <span className="text-xs font-semibold">{set.name}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { edit({ colors: set.colors }); toast.success(`“${set.name}” is in your colours. Click Save to keep it.`); }}>Apply</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${set.name}`} onClick={() => edit({ colorSets: withoutColorSet(kit.colorSets, set.name) })}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">No saved palettes yet. Pick your colours, name them, and save the set here.</p>}
      </div>

      {/* Every colour the kit draws is set in Colors now (founder, 2026-11-07), so they sit together. */}

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
        {/* A line is its own choice, never shaped by the corner setting (founder, 2026-11-07): the line is a straight rule,
            and only a box (and the cover page) has corners to round. */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold">Signatures<InfoTip text="Line: one straight rule under each signer's name, in your accent colour. Box: a frame around each signer's whole block. The line keeps square ends whatever the corners are set to." /></span>
            <div role="radiogroup" aria-label="Signature style" className="flex rounded-lg border border-border p-0.5">
              {([["line", "Line"], ["box", "Box"]] as const).map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={kit.options.signature === v} onClick={() => edit({ options: { ...kit.options, signature: v } })}
                className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.signature === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Line is one straight rule under each signer, and nothing shapes it. Box frames the whole block, and that frame is the only thing the corners below round off.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold">Box corners<InfoTip text="Only the signature box and the cover page have corners. A signature line has none, so rounding or squaring never bends it." /></span>
          <div role="radiogroup" aria-label="Box corners" className="flex rounded-lg border border-border p-0.5">
            {([["rounded", "Rounded"], ["square", "Square"]] as const).map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={kit.options.corners === v} onClick={() => edit({ options: { ...kit.options, corners: v } })}
              className={`rounded-md px-3 py-1 text-sm font-semibold ${kit.options.corners === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
        </div>
      </fieldset>

      <Disclaimer k="branding" />
      </div>

      {/* Preview: the header as it prints (white page, like the PDF). */}
      <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
        <div role="tablist" aria-label="Preview on a document" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(["contract", "split", "lyrics", "catalog"] as const).map((id) => (
            <Button key={id} role="tab" aria-selected={preview === id} size="sm" variant={preview === id ? "default" : "ghost"} onClick={() => setPreview(id)}>
              {{ contract: "Contract", split: "Split sheet", lyrics: "Lyrics", catalog: "Catalog" }[id]}
            </Button>
          ))}
        </div>
        <div className={`relative overflow-hidden rounded-xl border border-border bg-white p-5 text-[#0b0b0b] ${kit.style === "sidebar" ? "pl-8" : ""}`}>
          {kit.style === "sidebar" && <span aria-hidden className="absolute inset-y-0 left-0 w-3" style={{ background: stripe[0] ?? "#0b0b0b" }} />}
          {kit.style === "banner" && <span aria-hidden className="absolute inset-x-0 top-0 h-[4.5rem]" style={{ background: stripe[0] ?? "#0b0b0b" }} />}
          {/* Frame: the keyline the PDF draws around the first page, shown here as the card's own border. */}
          {kit.style === "frame" && <span aria-hidden className="pointer-events-none absolute inset-2 border" style={{ borderColor: accent }} />}
          {/* The preview is a preview (founder, 2026-11-07): no guides, handles or controls are drawn over it. It shows the
              header as it will print, and every tool for moving the logo lives with the other editing tools. */}
          <div className={`relative flex gap-4 ${snapClass} ${kit.style === "minimal" || freshHeader ? "hidden" : ""}`}>
            <div className={`min-w-0 flex-1 ${logoRight ? "order-1" : "order-2"}`}>
              <p className="truncate text-xl font-bold" style={{ fontFamily: kit.font, color: kit.style === "banner" ? onBand(stripe[0]) : nameColor }}>{previewName || "Your name"}</p>
              {kit.tagline && <p className="truncate text-xs font-medium" style={{ fontFamily: kit.font, color: kit.style === "banner" ? onBand(stripe[0]) : taglineColor ?? "#525252" }}>{kit.tagline}</p>}
            </div>
            {logoImage}
          </div>
          {kit.style === "label" && (
            <div className="relative text-center">
              {logoUrl && <img src={logoUrl} alt="" className="mx-auto h-8 max-w-[10rem] object-contain" style={{ transform: `translateY(${(shownNudge * pxPerMm).toFixed(1)}px)` }} />}
              <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 rounded-full" style={{ background: accent }} />
              <p className="mt-2 truncate text-xl font-bold" style={{ fontFamily: kit.font, color: nameColor }}>{previewName || "Your name"}</p>
              {kit.tagline && <p className="truncate text-xs font-medium" style={{ fontFamily: kit.font, color: taglineColor ?? "#525252" }}>{kit.tagline}</p>}
            </div>
          )}
          {kit.style === "ticket" && (
            <div className="relative rounded-sm border px-3 pb-2.5 pt-3" style={{ borderColor: accent }}>
              <div className={`flex gap-3 ${snapClass}`}>
                <div className={`min-w-0 flex-1 ${logoRight ? "order-1" : "order-2"}`}>
                  <p className="truncate text-xl font-bold" style={{ fontFamily: kit.font, color: nameColor }}>{previewName || "Your name"}</p>
                  {kit.tagline && <p className="truncate text-xs font-medium" style={{ fontFamily: kit.font, color: taglineColor ?? "#525252" }}>{kit.tagline}</p>}
                </div>
                {logoImage}
              </div>
              {/* The perforation: a dashed foot, the way the PDF punches the box's bottom edge. */}
              <div aria-hidden className="mt-2 border-t border-dashed" style={{ borderColor: accent }} />
            </div>
          )}
          {kit.style === "editorial" && (
            <div className="relative">
              <span aria-hidden className="block h-1.5 w-10 rounded" style={{ background: accent }} />
              <div className={`mt-2 flex gap-4 ${snapClass}`}>
                {!logoRight && logoUrl && <img src={logoUrl} alt="" className="h-10 max-w-[8rem] shrink-0 object-contain" style={{ transform: `translateY(${(shownNudge * pxPerMm).toFixed(1)}px)` }} />}
                <p className="min-w-0 flex-1 truncate text-2xl font-bold" style={{ fontFamily: kit.font, color: nameColor }}>{previewName || "Your name"}</p>
                {logoRight && logoUrl && <img src={logoUrl} alt="" className="h-10 max-w-[8rem] shrink-0 object-contain" style={{ transform: `translateY(${(shownNudge * pxPerMm).toFixed(1)}px)` }} />}
              </div>
              {kit.tagline && <p className="mt-1 truncate text-right text-[11px] uppercase tracking-wider" style={{ fontFamily: kit.font, color: taglineColor ?? "#525252" }}>{kit.tagline}</p>}
              <span aria-hidden className="mt-2 block h-px w-full" style={{ background: accent }} />
            </div>
          )}
          {(kit.style === "classic" || kit.style === "frame") && <div className="mt-3 h-1 rounded-full" style={{ background: accent }} />}
          <p className={`relative text-2xl font-bold ${kit.style === "banner" ? "mt-6" : "mt-4"}`}
            style={{ color: kit.options.titleColor && isHex(kit.options.titleColor) ? kit.options.titleColor : undefined }}>
            {preview === "contract" ? "Producer Agreement" : preview === "split" ? "Split Sheet Agreement" : preview === "lyrics" ? "Song Title" : "Catalog"}
          </p>
          {preview === "lyrics" ? (
            <>
              <p className="relative mt-3 text-sm font-bold" style={{ color: kit.headerColor && isHex(kit.headerColor) ? kit.headerColor : "#0b0b0b" }}>LYRICS</p>
              <p className="relative mt-1 whitespace-pre-line text-sm leading-6">First line of your song{"\n"}Second line, printed in black{"\n"}Third line, under your own header{"\n"}Fourth line, ready to download</p>
            </>
          ) : preview === "catalog" ? (
            <>
              <p className="relative mt-3 text-sm font-bold" style={{ color: kit.headerColor && isHex(kit.headerColor) ? kit.headerColor : "#0b0b0b" }}>TRACKS</p>
              <ul className="relative mt-1 space-y-1 text-sm">
                {["Song one · 04:12", "Song two · 03:28", "Song three · 02:59"].map((line) => (
                  <li key={line} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="relative mt-3 text-sm font-bold" style={{ color: kit.headerColor && isHex(kit.headerColor) ? kit.headerColor : "#0b0b0b" }}>{preview === "split" ? "1. OWNERSHIP SPLITS" : "1. TERMS"}</p>
              <p className="relative text-xs text-[#525252]">{preview === "split" ? "The split sheet reads in black, with draws and shares in your accent colour." : "The contract text reads in black, with your section titles in this color."}</p>
            </>
          )}
          {kit.options.watermark && logoUrl && <img src={logoUrl} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-24 max-w-[60%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.07]" />}
          {preview === "contract" && (
            <>
              {/* A line never takes a corner: rounding a bottom border bends it, which is exactly what a line must not do. */}
              <div className={`relative mt-4 border px-3 py-2 text-xs ${kit.options.signature === "box" ? (kit.options.corners === "rounded" ? "rounded-md" : "") : "border-x-0 border-t-0"}`} style={{ borderColor: kit.options.accent ?? kit.headerColor ?? "#0b0b0b" }}>
                <span className="font-bold" style={{ color: kit.options.accent ?? kit.headerColor ?? "#0b0b0b" }}>ARTIST</span><span className="ml-2 text-[#525252]">Signature</span>
              </div>
              {kit.options.cover && <p className="relative mt-2 text-[10px] text-[#525252]">+ Cover page with your logo, name and the contract title.</p>}
            </>
          )}
          {kit.style === "minimal" && <div className="relative mt-4 flex items-center justify-between text-[10px] text-[#525252]"><span>{previewName || "Your name"}</span>{logoUrl && <img src={logoUrl} alt="" className="h-5 max-w-[4rem] object-contain" />}</div>}
          {/* No footer in the preview (founder, 2026-11-07): the made-on line belongs on the file, and the preview shows
              the header alone. The switch below the preview still turns it on and off. */}
        </div>
        {/* Save and the rest, under the preview (founder, 2026-11-06). The footer switch moved into the name box
            (founder, 2026-11-07). */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} disabled={busy || saved}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saved ? "Saved" : "Save brand kit"}</Button>
            <Button variant="outline" size="sm" onClick={undo} disabled={!history.past.length} title="Undo the last change (Ctrl+Z)" aria-label="Undo the last change"><Undo2 className="h-4 w-4" />Undo</Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo the last undo"><Redo2 className="h-4 w-4" />Redo</Button>
            <Button variant="outline" size="sm" onClick={revert} disabled={saved || !origin.current[current]} title="Drop your unsaved changes and go back to the kit you last saved" aria-label="Revert to the last saved kit"><RotateCcw className="h-4 w-4" />Revert</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void sample()} title="A one-page test print using this kit"><FileDown className="h-4 w-4" />Sample PDF</Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** What each colour in the Colours area paints: the first names the documents, the second is the tagline (founder, 2026-11-07). */
const colorTitle = (i: number) => (i === 0 ? "Your name" : i === 1 ? "Your tagline" : `Extra ${i - 1}`);

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
      {style === "label" && <>
        <span className="absolute left-1/2 top-1.5 h-1.5 w-6 -translate-x-1/2 rounded-sm bg-[#d4d4d4]" />
        <span className="absolute left-1/2 top-4 h-0.5 w-5 -translate-x-1/2" style={{ background: color }} />
      </>}
      {style === "ticket" && <span className="absolute left-2 right-2 top-1.5 h-5 rounded-sm border" style={{ borderColor: color }} />}
      {style === "frame" && <span className="absolute inset-1.5 rounded-sm border" style={{ borderColor: color }} />}
      {style === "editorial" && <>
        <span className="absolute left-2 top-1.5 h-1 w-5" style={{ background: color }} />
        <span className="absolute left-2 right-2 top-4 h-px bg-[#d4d4d4]" />
      </>}
      <span className={`absolute left-3 right-3 h-1 rounded bg-[#d4d4d4] ${style === "banner" ? "top-6" : "top-6"}`} />
      <span className="absolute left-3 right-6 top-9 h-1 rounded bg-[#e5e5e5]" />
      <span className="absolute left-3 right-4 top-11 h-1 rounded bg-[#e5e5e5]" />
    </span>
  );
}

