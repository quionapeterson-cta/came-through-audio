import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Lock, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emptyContributor, GENRES, PROS, RELEASE_TYPES, type Contributor } from "@/lib/metadata";
import { loadOnboarding, loadProfile, saveOnboarding, saveProfile, type ArtistProfile, type Onboarding } from "@/lib/artist-profile";

// Placeholder founder badge until the custom opening-message badge is supplied.
const FIRST_BADGE = "/icons/serious/came_genesis_gold.png";
const AVATAR_BADGES = [
  { src: "/icons/playful/bedazzled_mic.png", label: "Recording artist" },
  { src: "/icons/playful/bedazzled_note.png", label: "Songwriter" },
  { src: "/icons/playful/bedazzled_cta.png", label: "Came Through" },
];
const STEPS = ["Welcome", "Profile Image", "Release Defaults", "Artist Catalog Profile"];
const year = new Date().getFullYear();

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = 256, c = document.createElement("canvas"); c.width = s; c.height = s;
      const ctx = c.getContext("2d")!; const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      resolve(c.toDataURL("image/jpeg", 0.85)); URL.revokeObjectURL(img.src);
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}

export function ArtistAvatar({ src, className = "h-10 w-10" }: { src?: string | undefined; className?: string }) {
  return src
    ? <img src={src} alt="Profile" className={`${className} rounded-full border-2 border-primary bg-card object-cover`} />
    : <span className={`${className} flex items-center justify-center rounded-full border-2 border-primary bg-card text-primary`}><UserRound className="h-1/2 w-1/2" /></span>;
}

export function ArtistOnboarding({ userId, open, onOpenChange, onSaved, firstRun }: {
  userId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (o: Onboarding) => void; firstRun: boolean;
}) {
  const [step, setStep] = useState(firstRun ? 0 : 1);
  const [ob, setOb] = useState<Onboarding>({ done: false, welcomed: false, avatar: "", stageName: "", legalName: "" });
  const [p, setP] = useState<ArtistProfile>({});

  useEffect(() => {
    if (!open) return;
    setStep(firstRun ? 0 : 1);
    const saved = loadOnboarding(userId);
    const prof = loadProfile(userId) ?? {};
    setP({ copyright: `© ${year} `, phonographic: `℗ ${year} `, language: "English", ...prof });
    if (saved) setOb(saved);
    else supabase.from("profiles").select("stage_name, legal_name").eq("id", userId).maybeSingle().then(({ data }) =>
      setOb((o) => ({ ...o, stageName: data?.stage_name ?? "", legalName: data?.legal_name ?? "" })));
  }, [open, userId, firstRun]);

  const set = <K extends keyof ArtistProfile>(k: K, v: ArtistProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function finish() {
    const stage = ob.stageName.trim() || p.artist?.trim() || "";
    const final: Onboarding = { ...ob, stageName: stage, done: true, welcomed: true };
    saveProfile(userId, { ...p, artist: p.artist?.trim() || stage });
    saveOnboarding(userId, final);
    await supabase.from("profiles").update({ stage_name: stage || null, legal_name: ob.legalName.trim() || null }).eq("id", userId);
    onSaved(final);
    onOpenChange(false);
    toast.success("You're all set! Your saved details will prefill every new embed and catalog entry.");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!firstRun) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => firstRun && e.preventDefault()} onEscapeKeyDown={(e) => firstRun && e.preventDefault()}>
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Setup steps">
          {STEPS.map((s, i) => (i === 0 && !firstRun) ? null : (
            <li key={s} className={`rounded-full px-3 py-1 font-semibold ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}. {s}</li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4 text-center">
            <img src={FIRST_BADGE} alt="Your first badge" className="mx-auto h-28 w-28" />
            <DialogHeader><DialogTitle className="text-center text-2xl">Hi {ob.stageName || "there"}!</DialogTitle></DialogHeader>
            <p className="text-muted-foreground">At CTA we celebrate your wins! Handling your music business isn’t an easy feat, so enjoy unlocking badges as you complete embeds, catalog entries, protecting your creations and proper registrations!</p>
            <p className="font-semibold">Here’s your first badge! A celebration of believing in yourself &amp; artistry!</p>
            <p className="text-sm italic text-muted-foreground">Cheers,<br /><span className="font-semibold not-italic text-foreground">We’re on your Team!</span><br /><span className="not-italic">Karma Came,<br />Founder<br />Came Through Audio</span></p>
            <p className="text-lg font-bold text-primary">Let’s goooo!</p>
            <Button className="w-full" onClick={() => { setOb((o) => ({ ...o, welcomed: true })); setStep(1); }}>Claim my badge &amp; set up my profile<ArrowRight /></Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Choose your profile image</DialogTitle>
              <DialogDescription>Upload a photo, pick a badge, or skip — you can change it anytime from Profile.</DialogDescription></DialogHeader>
            <div className="flex justify-center"><ArtistAvatar src={ob.avatar} className="h-24 w-24" /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-3 text-center text-xs hover:border-primary">
                <Camera className="h-10 w-10 text-primary" />Upload photo
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { const avatar = await resizeImage(f); setOb((o) => ({ ...o, avatar })); } catch { toast.error("That image couldn't be read. Try a JPG or PNG."); }
                }} />
              </label>
              {AVATAR_BADGES.map((b) => (
                <button key={b.src} type="button" onClick={() => setOb((o) => ({ ...o, avatar: b.src }))}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-xs ${ob.avatar === b.src ? "border-primary bg-accent/40" : "border-border hover:border-primary"}`}>
                  <img src={b.src} alt="" className="h-10 w-10 object-contain" />{b.label}
                </button>
              ))}
            </div>
            <Nav onBack={firstRun ? () => setStep(0) : undefined} onNext={() => setStep(2)} nextLabel={ob.avatar ? "Continue" : "Skip for now"} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Set Your Release Defaults</DialogTitle>
              <DialogDescription>Enter it once, prefill every embed. Add the public release details you use most and each new song starts closer to distribution-ready. You can always change details for an individual track.</DialogDescription></DialogHeader>
            <Group title="Artist & Label">
              <Field label="Primary Artist / Stage Name"><Input value={ob.stageName} onChange={(e) => { setOb((o) => ({ ...o, stageName: e.target.value })); set("artist", e.target.value); }} /></Field>
              <Field label="Default Label Name (optional)"><Input value={p.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="Your label or own imprint" /></Field>
            </Group>
            <Group title="Release Metadata">
              <Field label="Primary Genre"><Pick value={p.primaryGenre ?? ""} options={GENRES} onChange={(v) => set("primaryGenre", v)} /></Field>
              <Field label="Secondary Genre (optional)"><Pick value={p.secondaryGenre ?? ""} options={GENRES} onChange={(v) => set("secondaryGenre", v)} /></Field>
              <Field label="Default Language"><Input value={p.language ?? ""} onChange={(e) => set("language", e.target.value)} /></Field>
              <Field label="Default Release Type"><Pick value={p.releaseType ?? ""} options={RELEASE_TYPES} empty="Ask each time" onChange={(v) => set("releaseType", v)} /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={!!p.explicit} onChange={(e) => set("explicit", e.target.checked)} />My songs are usually Explicit (you can change this per song)</label>
            </Group>
            <Group title="Copyright Lines">
              <Field label="Composition Copyright (©)"><Input value={p.copyright ?? ""} onChange={(e) => set("copyright", e.target.value)} placeholder={`© ${year} Publisher or rights holder`} /></Field>
              <Field label="Sound Recording Copyright (℗)"><Input value={p.phonographic ?? ""} onChange={(e) => set("phonographic", e.target.value)} placeholder={`℗ ${year} Label or rights holder`} /></Field>
            </Group>
            <PrivacyNote />
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Build Your Artist Catalog Profile</DialogTitle>
              <DialogDescription>Save your private credit and registration details once. We’ll prefill every catalog entry, split sheet and registration file — so you never have to enter them again.</DialogDescription></DialogHeader>
            <Field label="Legal Name"><Input value={ob.legalName} onChange={(e) => setOb((o) => ({ ...o, legalName: e.target.value }))} placeholder="As registered with your PRO" /></Field>
            <Rows title="Writer (Author / Composer)" rows={p.writers} onChange={(r) => set("writers", r)} seed={ob.legalName} />
            <Rows title="Producer" rows={p.producers} onChange={(r) => set("producers", r)} seed={ob.stageName} noPro />
            <Rows title="Publisher" rows={p.publishers} onChange={(r) => set("publishers", r)} />
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Private: PRO affiliations, IPI name numbers and shares stay in your catalog and are never embedded in your music files.</p>
            <Nav onBack={() => setStep(2)} onNext={finish} nextLabel="Save & start embedding" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continue" }: { onBack?: (() => void) | undefined; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border pt-4">
      {onBack ? <Button variant="ghost" onClick={onBack}><ArrowLeft />Back</Button> : <span />}
      <Button onClick={onNext}>{nextLabel}<ArrowRight /></Button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-1 text-sm font-bold text-primary">{title}</legend><div className="grid gap-3 sm:grid-cols-2">{children}</div></fieldset>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Pick({ value, options, onChange, empty = "Select…" }: { value: string; options: readonly string[]; onChange: (v: string) => void; empty?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
      <option value="">{empty}</option>{options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function PrivacyNote() {
  return <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Your private PRO affiliations, IPI name numbers, splits and registration details are never embedded in your music files. You’ll save them separately in the next step.</p>;
}

function Rows({ title, rows, onChange, seed, noPro }: { title: string; rows?: Contributor[] | undefined; onChange: (r: Contributor[]) => void; seed?: string; noPro?: boolean }) {
  const list = rows?.length ? rows : [{ ...emptyContributor(), name: seed ?? "" }];
  const upd = (i: number, k: keyof Contributor, v: string) => onChange(list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const total = list.reduce((s, r) => s + Number(r.percentage || 0), 0);
  return (
    <fieldset className="space-y-2 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-bold text-primary">{title}</legend>
      {list.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1.3fr_0.8fr_auto]">
          <Input aria-label={`${title} name`} placeholder="Name" value={r.name} onChange={(e) => upd(i, "name", e.target.value)} />
          {noPro ? <span className="hidden sm:block" /> : (
            <select aria-label="PRO" value={r.pro} onChange={(e) => upd(i, "pro", e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">PRO</option>{PROS.map((o) => <option key={o}>{o}</option>)}
            </select>)}
          {noPro ? <span className="hidden sm:block" /> : <Input aria-label="IPI name number" placeholder="IPI name #" inputMode="numeric" value={r.ipi} onChange={(e) => upd(i, "ipi", e.target.value.replace(/\D/g, "").slice(0, 11))} />}
          <Input aria-label="Default share %" placeholder="Share %" inputMode="decimal" value={r.percentage} onChange={(e) => {
            const others = total - Number(r.percentage || 0); const v = Math.min(Number(e.target.value || 0), 100 - others);
            upd(i, "percentage", e.target.value === "" ? "" : String(Math.max(0, v)));
          }} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, emptyContributor()])}><Plus />Add {title.split(" ")[0]}</Button>
        <span className="text-xs text-muted-foreground">Default share total: {total}% of 100%</span>
      </div>
    </fieldset>
  );
}
