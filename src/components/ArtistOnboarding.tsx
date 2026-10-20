import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Lock, Plus, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProSelect } from "@/components/ProSelect";
import { emptyContributor, GENRES, RELEASE_TYPES, WRITER_ROLES, writerRole, type Contributor } from "@/lib/metadata";
import { isBadgeImage } from "@/lib/badges";
import { loadOnboarding, loadProfile, saveOnboarding, saveProfile, type ArtistProfile, type Onboarding } from "@/lib/artist-profile";
import { capShare, splitTotal } from "@/lib/splits-total";
import { ARTIST_SEAT_PRICES, TIER_LABEL } from "@/lib/plans";
import { InfoTip } from "@/components/InfoTip";
import type { GlossaryKey } from "@/lib/glossary";

// Placeholder founder badge until the custom opening-message badge is supplied.
const FIRST_BADGE = "/icons/serious/came_genesis_gold.png";
const AVATAR_BADGES = [
  { src: "/icons/playful/bedazzled_mic.png", label: "Recording artist" },
  { src: "/icons/playful/bedazzled_note.png", label: "Songwriter" },
  { src: "/icons/playful/producer/full_gold_beat_machine.png", label: "Producer" },
  { src: "/icons/playful/bedazzled_band.png", label: "Live musician" },
  { src: "/icons/playful/bedazzled_cta.png", label: "CTA Badge" },
];
const STEPS = ["Welcome", "Profile Image", "Embed Defaults", "Artist Catalog Profile"];
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
  // Badges are shown whole so wide artwork is never cropped; photos stay round.
  if (isBadgeImage(src)) return <img src={src} alt="Profile badge" className={`${className} object-contain`} />;
  return src
    ? <img src={src} alt="Profile" className={`${className} rounded-full border-2 border-primary bg-card object-cover`} />
    : <span className={`${className} flex items-center justify-center rounded-full border-2 border-primary bg-card text-primary`}><UserRound className="h-1/2 w-1/2" /></span>;
}

type NameStatus = { in_grace: boolean; grace_until: string | null; changes_left: number; next_change_at: string | null; frees_up_at?: string | null };
const normName = (v?: string | null) => (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
async function loadNameStatus(): Promise<NameStatus> {
  const { data, error } = await supabase.rpc("artist_name_status" as never);
  if (error) throw error;
  return data as NameStatus;
}
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const daysUntil = (iso: string) => Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** "in 5 days (Oct 24)" */
const whenNext = (iso: string) => `in ${plural(daysUntil(iso), "day")} (${shortDay(iso)})`;
/** Plain-language artist-name rule: free fixes for 72 hours after signup, then once a week and 3 times a year. */
function nameRuleText(s?: NameStatus) {
  if (!s) return "Your artist name is tied to your catalog. You can change it once a week, up to 3 times a year.";
  if (s.in_grace && s.grace_until) return `Fix any typos freely until ${day(s.grace_until)}. After that, you can change it once a week, up to 3 times a year.`;
  if (s.next_change_at) return `You can change your artist name again ${whenNext(s.next_change_at)}. ${plural(s.changes_left, "change")} left this year.`;
  return `You can change your artist name once a week, up to 3 times a year (${s.changes_left} left). Releasing as another artist? Add an artist to your account.`;
}

export function ArtistOnboarding({ userId, open, onOpenChange, onSaved, firstRun }: {
  userId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (o: Onboarding) => void; firstRun: boolean;
}) {
  const [step, setStep] = useState(firstRun ? 0 : 1);
  const [ob, setOb] = useState<Onboarding>({ done: false, welcomed: false, avatar: "", stageName: "", legalName: "" });
  const [p, setP] = useState<ArtistProfile>({});
  const [nameRule, setNameRule] = useState<NameStatus>();
  const [savedName, setSavedName] = useState("");
  // The "Change your artist name?" pop-up, and the "Add another artist" coming-soon panel inside it.
  const [confirmName, setConfirmName] = useState(false);
  const [seats, setSeats] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(firstRun ? 0 : 1);
    const saved = loadOnboarding(userId);
    const prof = loadProfile(userId) ?? {};
    setP({ copyright: `© ${year} `, phonographic: `℗ ${year} `, language: "English", ...prof });
    if (saved) setOb(saved);
    supabase.from("profiles").select("stage_name, legal_name").eq("id", userId).maybeSingle().then(({ data }) => {
      setSavedName(data?.stage_name ?? "");
      if (!saved) setOb((o) => ({ ...o, stageName: data?.stage_name ?? "", legalName: data?.legal_name ?? "" }));
    });
    loadNameStatus().then(setNameRule).catch(() => setNameRule(undefined));
  }, [open, userId, firstRun]);

  const set = <K extends keyof ArtistProfile>(k: K, v: ArtistProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  const newName = () => ob.stageName.trim() || p.artist?.trim() || "";
  const nameChanges = () => !!normName(savedName) && normName(savedName) !== normName(newName());

  /** Changing a saved artist name counts toward the limit, so it asks first (free typo fixes in the first 72 hours don't). */
  async function finish() {
    if (nameChanges() && !nameRule?.in_grace) { setSeats(false); setConfirmName(true); return; }
    await save();
  }

  async function notifySeats() {
    const { error } = await supabase.from("feature_interest" as never).upsert({ user_id: userId, feature: "artist_seats" } as never, { onConflict: "user_id,feature", ignoreDuplicates: true });
    if (error) { toast.error("Couldn't save that. Try again."); return; }
    setNotified(true);
    toast.success("We'll let you know when you can add more artists.");
  }

  async function save() {
    setConfirmName(false);
    const stage = newName();
    const final: Onboarding = { ...ob, stageName: stage, done: true, welcomed: true };
    // Artist name changes are limited (see artist_name_status); the database has the final say.
    if (nameChanges()) {
      const { error } = await supabase.from("profiles").update({ stage_name: stage }).eq("id", userId);
      if (error) { toast.error(error.message.replace("ARTIST_NAME_LOCKED: ", "")); return; }
      setSavedName(stage);
    }
    saveProfile(userId, { ...p, artist: p.artist?.trim() || stage });
    saveOnboarding(userId, final);
    await supabase.from("profiles").update({ stage_name: stage || null, legal_name: ob.legalName.trim() || null }).eq("id", userId);
    onSaved(final);
    onOpenChange(false);
    toast.success(firstRun ? "You're all set! Your saved details will prefill every new embed and catalog entry." : "Profile saved.");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!firstRun) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" onInteractOutside={(e) => firstRun && e.preventDefault()} onEscapeKeyDown={(e) => firstRun && e.preventDefault()}>
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            if (i === 0 && !firstRun) return null;
            const look = `inline-block rounded-full px-3 py-1 font-semibold ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`;
            // When editing an existing profile, every section opens on its own.
            return <li key={s}>{firstRun
              ? <span className={look}>{i + 1}. {s}</span>
              : <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)} className={`${look} transition hover:ring-2 hover:ring-primary/40`}>{i + 1}. {s}</button>}</li>;
          })}
        </ol>

        {step === 0 && (
          <div className="space-y-4 text-center">
            <img src={FIRST_BADGE} alt="Your first badge" className="mx-auto h-28 w-28" />
            <DialogHeader><DialogTitle className="text-center text-2xl">Hi {ob.stageName || "there"}!</DialogTitle></DialogHeader>
            <div className="max-h-[45vh] space-y-4 overflow-y-auto text-left">
              <p className="text-muted-foreground">At CTA we celebrate your wins! Handling your music business isn’t an easy feat so enjoy unlocking badges as you complete embeds, log catalog entries,protect your creations and properly register your music!</p>
              <p className="text-muted-foreground">I built this platform from the ground up and worked tediously (and tirelessly) to solve the mass problem we face as independent artists: organizing the pre distribution/after the studio process and demystifying music business into clear, tangible steps.Not to mention protecting our original creations that come from the heart and mind from Ai accusations. From Metadata embedding and Legal Blockchain Proof of creation as AI protection to song registrations, here’s what “They” don’t tell you; but matters the most, all in one place!</p>
              <p className="font-semibold">Here’s your first badge! A celebration of believing in yourself &amp; your artistry!</p>
              <p className="text-muted-foreground">This one is for the independent artist community, and is well over due! Quit Playing with Us’!</p>
              <p className="text-sm text-muted-foreground">Cheers,</p>
              <p className="text-sm font-semibold text-foreground">We’re on your Team!</p>
              <p className="text-sm text-muted-foreground">Karma Came,<br /><span className="italic">“Don’t you evah! Let em’ knock you out cho’ Crown”. “Nah, nevah dat”.</span><br />Founder<br />Came Through Audio<br />Independent Record Label</p>
            </div>
            <p className="text-lg font-bold text-primary">Let’s goooo!</p>
            <Button className="w-full" onClick={() => { setOb((o) => ({ ...o, welcomed: true })); setStep(1); }}>Claim my badge &amp; set up my profile<ArrowRight /></Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Choose your profile image</DialogTitle>
              <DialogDescription>Upload a photo, pick a badge, or skip — you can change it anytime from Profile.</DialogDescription></DialogHeader>
            <div className="flex justify-center"><ArtistAvatar src={ob.avatar} className="h-24 w-24" /></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
            <Nav onBack={firstRun ? () => setStep(0) : undefined} onNext={() => setStep(2)} nextLabel={!firstRun ? "Change and Continue" : ob.avatar ? "Continue" : "Skip for now"} onSave={firstRun ? undefined : finish} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Set Your Embed Defaults</DialogTitle>
              <DialogDescription>Enter it once, prefill every embed. Add the public release details you use most and each new song starts closer to distribution-ready. You can always change details for an individual track.</DialogDescription></DialogHeader>
            <Group title="Artist & Label">
              <Field label="Primary Artist / Stage Name"><Input value={ob.stageName} onChange={(e) => { setOb((o) => ({ ...o, stageName: e.target.value })); set("artist", e.target.value); }} />
                {savedName && <p className="mt-1 text-xs text-muted-foreground">{nameRuleText(nameRule)}</p>}</Field>
              <Field label="Default Label Name (optional)" term="label"><Input value={p.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="Your label name" /></Field>
              <Field label="Produced by (optional)" term="producedBy"><Input value={p.producers?.[0]?.name ?? ""} placeholder="Name"
                onChange={(e) => { const rest = p.producers?.slice(1) ?? []; set("producers", [{ ...(p.producers?.[0] ?? emptyContributor()), name: e.target.value }, ...rest]); }} /></Field>
            </Group>
            <Group title="Release Metadata">
              <Field label="Primary Genre"><Pick value={p.primaryGenre ?? ""} options={GENRES} onChange={(v) => set("primaryGenre", v)} /></Field>
              <Field label="Secondary Genre (optional)"><Pick value={p.secondaryGenre ?? ""} options={GENRES} onChange={(v) => set("secondaryGenre", v)} /></Field>
              <Field label="Default Language"><Input value={p.language ?? ""} onChange={(e) => set("language", e.target.value)} /></Field>
              <Field label="Usually recorded in" term="neighbouringRights"><Input value={p.recordedIn ?? ""} placeholder="United States" onChange={(e) => set("recordedIn", e.target.value)} /></Field>
              <Field label="Default Release Type" term="releaseType"><Pick value={p.releaseType ?? ""} options={RELEASE_TYPES} empty="Ask each time" onChange={(v) => set("releaseType", v)} /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={!!p.explicit} onChange={(e) => set("explicit", e.target.checked)} />My songs are usually Explicit (you can change this per song)<InfoTip term="explicit" /></label>
            </Group>
            <Group title="Copyright Lines">
              <Field label="Composition Copyright (©)" term="cLine"><Input value={p.copyright ?? ""} onChange={(e) => set("copyright", e.target.value)} placeholder={`© ${year} Publisher or rights holder`} /></Field>
              <Field label="Sound Recording Copyright (℗)" term="pLine"><Input value={p.phonographic ?? ""} onChange={(e) => set("phonographic", e.target.value)} placeholder={`℗ ${year} Label or rights holder`} /></Field>
            </Group>
            <PrivacyNote />
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel={firstRun ? "Continue" : "Change and Continue"} onSave={firstRun ? undefined : finish} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <DialogHeader><DialogTitle className="text-2xl">Build Your Artist Catalog Profile</DialogTitle>
              <DialogDescription>Save your private credit and registration details once. We’ll prefill every catalog entry, split sheet and registration file — so you never have to enter them again.</DialogDescription></DialogHeader>
            <Field label="Legal Name"><Input value={ob.legalName} onChange={(e) => setOb((o) => ({ ...o, legalName: e.target.value }))} placeholder="As registered with your PRO" /></Field>
            <Rows title="Writer" rows={p.writers} onChange={(r) => set("writers", r)} seed={ob.legalName} writer />
            <Rows title="Publisher" rows={p.publishers} onChange={(r) => set("publishers", r)} />
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Private: PRO affiliations, IPI name numbers and shares stay in your catalog and are never embedded in your music files.</p>
            <IpiNote />
            <Nav onBack={() => setStep(2)} onNext={finish} nextLabel={firstRun ? "Save & start embedding" : "Save & exit"} />
          </div>
        )}
      </DialogContent>
      <NameChangeDialog open={confirmName} onOpenChange={setConfirmName} from={savedName} to={newName()} status={nameRule}
        seats={seats} onSeats={() => setSeats(true)} notified={notified} onNotify={() => void notifySeats()} onConfirm={() => void save()} />
    </Dialog>
  );
}

/** Seat prices (yearly, per added artist); artist seats aren't built yet. */
const SEAT_PRICES = ARTIST_SEAT_PRICES.map((s) => [TIER_LABEL[s.tier], s.price] as const);

function NameChangeDialog({ open, onOpenChange, from, to, status, seats, onSeats, notified, onNotify, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; from: string; to: string; status?: NameStatus | undefined;
  seats: boolean; onSeats: () => void; notified: boolean; onNotify: () => void; onConfirm: () => void;
}) {
  const left = status?.changes_left ?? 3;
  const blocked = !!status?.next_change_at || left <= 0;
  const weekOut = new Date(Date.now() + 7 * 86_400_000).toISOString();
  // With no earlier changes, the one being made now is the first to free up, a year from today.
  const freesUp = status?.frees_up_at ?? new Date(Date.now() + 365 * 86_400_000).toISOString();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {seats ? <>
          <DialogHeader><DialogTitle>Coming soon: add more artists</DialogTitle>
            <DialogDescription>Manage another artist's catalog from your account, each with their own login. Yearly, per added artist:</DialogDescription></DialogHeader>
          <ul className="space-y-1 text-sm">{SEAT_PRICES.map(([tier, price]) => <li key={tier} className="flex justify-between rounded-lg bg-muted px-3 py-2"><span>{tier}</span><span className="font-semibold">{price}/yr</span></li>)}</ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={onNotify} disabled={notified}>{notified ? "We'll let you know" : "Notify me"}</Button>
          </div>
        </> : <>
          <DialogHeader><DialogTitle>Change your artist name?</DialogTitle>
            <DialogDescription className="font-semibold text-foreground">"{from}" → "{to}"</DialogDescription></DialogHeader>
          {blocked ? (
            <p className="text-sm">You can change your artist name again <b>{status?.next_change_at ? whenNext(status.next_change_at) : `when a change frees up on ${shortDay(freesUp)}`}</b>. <b>{plural(left, "change")}</b> left this year.</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Changes left this year</dt><dd className="font-semibold">{left} of 3</dd>
              <dt className="text-muted-foreground">Next change after this</dt><dd className="font-semibold">{whenNext(weekOut)}</dd>
              <dt className="text-muted-foreground">Resets</dt><dd className="font-semibold">1 change frees up on {day(freesUp)}</dd>
            </dl>
          )}
          <p className="text-sm text-muted-foreground">Songs you already saved keep the name they were released under.</p>
          <p className="text-sm"><span className="font-semibold">Releasing music as a different artist?</span> <span className="text-muted-foreground">Add them as another artist instead, so both names stay on your account.</span></p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onSeats}><Plus />Add another artist</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!blocked && <Button onClick={onConfirm}>Change name</Button>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}

function Nav({ onBack, onNext, onSave, nextLabel = "Continue" }: { onBack?: (() => void) | undefined; onNext: () => void; onSave?: (() => void) | undefined; nextLabel?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
      {onBack ? <Button variant="ghost" onClick={onBack}><ArrowLeft />Back</Button> : <span />}
      <div className="flex flex-wrap gap-3">
        {onSave && <Button variant="outline" onClick={onSave}><Save />Save &amp; exit</Button>}
        <Button onClick={onNext}>{nextLabel}{nextLabel !== "Save & exit" && <ArrowRight />}</Button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-1 text-sm font-bold text-primary">{title}</legend><div className="grid gap-3 sm:grid-cols-2">{children}</div></fieldset>;
}

function Field({ label, term, children }: { label: string; term?: GlossaryKey; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}{term && <InfoTip term={term} />}</Label>{children}</div>;
}

function Pick({ value, options, onChange, empty = "Select…" }: { value: string; options: readonly string[]; onChange: (v: string) => void; empty?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
      <option value="">{empty}</option>{options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function PrivacyNote() {
  return <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Your private PRO affiliations, IPI name numbers, splits and registration details are never embedded in your music files. They stay private in your catalog.</p>;
}

export function IpiNote() {
  return <p className="rounded-lg border border-primary/40 bg-accent/30 p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">No PRO or IPI number yet?</span> Leave them blank. Add them anytime after you register with a PRO and receive your IPI name number.</p>;
}

function Rows({ title, rows, onChange, seed, writer }: { title: string; rows?: Contributor[] | undefined; onChange: (r: Contributor[]) => void; seed?: string; writer?: boolean }) {
  const list = rows?.length ? rows : [writer ? { ...emptyContributor(), legalName: seed ?? "" } : emptyContributor()];
  const upd = (i: number, k: keyof Contributor, v: string) => onChange(list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const total = splitTotal(list);
  return (
    <fieldset className="space-y-2 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-bold text-primary">{title}<InfoTip term={writer ? "roles" : "publisher"} /></legend>
      {writer && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Legal name</span> is only needed to register songs, so you can add it later.</p>}
      {/* The row inputs have no room for labels, so their tips sit in one line above them. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center">Legal name<InfoTip term="legalName" /></span>
        <span className="inline-flex items-center">PRO<InfoTip term="pro" /></span>
        <span className="inline-flex items-center">IPI<InfoTip term="ipi" /></span>
        <span className="inline-flex items-center">Share<InfoTip term={writer ? "split" : "publisher"} /></span>
      </p>
      {list.map((r, i) => (
        <div key={i} className={`grid items-start gap-x-4 gap-y-2 ${writer ? "sm:grid-cols-[1.6fr_1.1fr_1.1fr_1fr_0.7fr_auto]" : "sm:grid-cols-[1.6fr_1.1fr_1fr_0.7fr_auto]"}`}>
          {writer
            ? <Input aria-label="Legal name" placeholder="Legal name" value={r.legalName ?? ""} onChange={(e) => upd(i, "legalName", e.target.value)} />
            : <Input aria-label={`${title} legal name`} placeholder="Legal name" value={r.name} onChange={(e) => upd(i, "name", e.target.value)} />}
          {writer && (
            <select aria-label="Writer role" value={writerRole(r.role)} onChange={(e) => upd(i, "role", e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {WRITER_ROLES.map((o) => <option key={o}>{o}</option>)}
            </select>)}
          <ProSelect value={r.pro} onChange={(v) => upd(i, "pro", v)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
          <Input aria-label="IPI name number" placeholder="IPI name number" inputMode="numeric" value={r.ipi} onChange={(e) => upd(i, "ipi", e.target.value.replace(/\D/g, "").slice(0, 11))} />
          <Input aria-label="Default share %" placeholder="Share %" inputMode="decimal" value={r.percentage} onChange={(e) => upd(i, "percentage", capShare(list, i, e.target.value).value)} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, emptyContributor()])}><Plus />Add {title}</Button>
        <span className="text-xs text-muted-foreground">Default share total: {total}% of 100%</span>
      </div>
    </fieldset>
  );
}
