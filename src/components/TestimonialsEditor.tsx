import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Check, ImagePlus, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { confirmAction } from "@/components/ConfirmHost";
import { TestimonialCard } from "@/components/TestimonialCard";
import { TestimonialFilterPanel } from "@/components/TestimonialFilterPanel";
import type { StaffAccess } from "@/lib/departments";
import {
  canDecideTestimonials,
  canSubmitTestimonials,
  REVIEW_LABEL,
  STARTING_REVIEW,
  testimonialsChanged,
  testimonialsEditable,
  type TestimonialReview,
  type TestimonialWorkspace,
} from "@/lib/testimonial-review";
import {
  decideTestimonials,
  getTestimonialDrafts,
  requestTestimonialApproval,
  saveTestimonials,
  uploadTestimonialPhoto,
} from "@/lib/testimonials.functions";
import { DEFAULT_TESTIMONIAL_FILTER, TESTIMONIAL_LIMITS, ZOOM_RANGE, testimonialProblems, type EditableTestimonial, type TestimonialFilter } from "@/lib/testimonials";

const blank = (): EditableTestimonial => ({ id: crypto.randomUUID().slice(0, 12), name: "", title: "", location: "", service: "", quote: "", photo: "", focus: "50% 30%", zoom: 1, releaseSignedOn: "", published: false });
const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

const TONE: Record<TestimonialReview["status"], string> = {
  draft: "border-border bg-muted",
  pending_approval: "border-amber-500/60 bg-amber-500/10",
  changes_requested: "border-amber-500/60 bg-amber-500/10",
  denied: "border-destructive/60 bg-destructive/5",
  approved: "border-emerald-600/50 bg-emerald-600/10",
};

/** What the reviewer (or the editor) is told about where this version stands, in one line plus the detail. */
function reviewText(review: TestimonialReview): { title: string; body: string } {
  switch (review.status) {
    case "pending_approval":
      return {
        title: "Waiting for a super admin",
        body: `Sent for approval${review.submittedAt ? ` on ${day(review.submittedAt)}` : ""}. Editing is locked until they approve it, decline it, or send it back with a note.`,
      };
    case "changes_requested":
      return {
        title: "Sent back for updates",
        body: `${review.note ? `A super admin asked for changes: “${review.note}”. ` : ""}Edit the cards, save them, then request approval again.`,
      };
    case "denied":
      return {
        title: "Declined",
        body: `${review.note ? `A super admin declined this version: “${review.note}”. ` : ""}The homepage still shows the last approved cards.`,
      };
    case "approved":
      return {
        title: "Approved and live",
        body: `A super admin approved this version${review.decidedAt ? ` on ${day(review.decidedAt)}` : ""}. The ticked cards are on the homepage. Edit and save to start a new version.`,
      };
    default:
      return {
        title: "Draft — not on the homepage",
        body: "Save your changes, then a Marketing or Branding lead sends the section to a super admin. The homepage changes only when it is approved.",
      };
  }
}

/**
 * Admin → Homepage (founder, 2026-11-21). Marketing and Branding edit the testimonial cards; a lead sends the section
 * to a super admin, who approves it, declines it, or sends it back with a note. Nothing reaches the homepage until a
 * super admin approves it, and the working copy is locked while a version is waiting.
 *
 * Fool-proof by design: character limits keep every card the same shape, a card can't publish without a photo and its
 * signed release date, the preview is the real card with the shared filter. Quotes stay in the person's own words.
 */
export function TestimonialsEditor({ access }: { access: StaffAccess }) {
  const load = useServerFn(getTestimonialDrafts);
  const save = useServerFn(saveTestimonials);
  const request = useServerFn(requestTestimonialApproval);
  const decide = useServerFn(decideTestimonials);
  const upload = useServerFn(uploadTestimonialPhoto);
  const qc = useQueryClient();
  // Unsaved edits must survive a refetch. Without this a window-focus refetch silently reverted the form and greyed out
  // Save, which reads as "it won't let me save them to the homepage".
  const q = useQuery({ queryKey: ["testimonial-drafts"], queryFn: () => load(), staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [list, setList] = useState<EditableTestimonial[]>([]);
  // The photo filter is part of the same draft (founder, 2026-11-21), so it saves and is approved with the cards.
  const [filter, setFilter] = useState<TestimonialFilter>(DEFAULT_TESTIMONIAL_FILTER);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const review = q.data?.review ?? STARTING_REVIEW;
  const locked = !testimonialsEditable(review.status);
  const canSubmit = canSubmitTestimonials(access);
  const canDecide = canDecideTestimonials(access);
  useEffect(() => { if (q.data) { setList(q.data.items); setFilter(q.data.filter); } }, [q.data]);
  const changed = !!q.data && testimonialsChanged(q.data, list, filter);
  const set = (i: number, patch: Partial<EditableTestimonial>) => setList((l) => l.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: number) => setList((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); return n; });
  const apply = (ws: TestimonialWorkspace) => { qc.setQueryData(["testimonial-drafts"], ws); setList(ws.items); setFilter(ws.filter); };

  async function pickPhoto(i: number, file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photos can be up to 5 MB."); return; }
    try { const { url } = await upload({ data: { base64: await toBase64(file), type: file.type } }); set(i, { photo: url, focus: "50% 30%", zoom: 1 }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't upload the photo."); }
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const ws = await save({ data: { items: list, filter } });
      apply(ws);
      const hidden = ws.items.filter((t) => !t.published);
      if (!hidden.length) { toast.success("Saved as a draft. The homepage changes only when a super admin approves it."); return; }
      // Name the cards that wouldn't go live and say why, so nothing saves quietly as a draft.
      toast.success(`Saved as a draft. ${hidden.length} card${hidden.length === 1 ? " is" : "s are"} not ticked for the homepage yet.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }

  async function requestApproval() {
    if (changed) { toast.error("Save your changes first, then send the section for approval."); return; }
    setBusy(true);
    try {
      apply(await request());
      toast.success("Sent to a super admin. The homepage stays as it is until they approve it.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send it for approval."); }
    finally { setBusy(false); }
  }

  async function decision(kind: "approve" | "deny" | "changes") {
    setBusy(true);
    try {
      apply(await decide({ data: { decision: kind, note: note.trim() } }));
      setNote("");
      toast.success(kind === "approve" ? "Approved. The ticked cards are on the homepage." : kind === "changes" ? "Sent back for updates." : "Declined.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't record that decision."); }
    finally { setBusy(false); }
  }

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the testimonials.</p>;
  const message = reviewText(review);
  return (
    <section className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Homepage testimonials</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Swap photos, quotes, names and locations, and tune the photo filter below. Quotes stay in the person's own words: trim with … but never reword. A card goes live only with a photo and the date their Photo, Video &amp; Testimonial Release was signed. The cards and the filter reach the homepage only after a super admin approves the same version.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setList((l) => [...l, blank()])} disabled={locked || list.length >= 12}><Plus />Add a testimonial</Button>
          <Button variant="ghost" onClick={() => { if (!q.data) return; setList(q.data.items); setFilter(q.data.filter); }} disabled={!changed}><Undo2 />Undo changes</Button>
          <Button onClick={() => void saveDraft()} disabled={busy || !changed || locked}>{busy ? "Saving…" : "Save draft"}</Button>
          {canSubmit && review.status !== "pending_approval" && (
            <Button variant="default" onClick={() => void requestApproval()} disabled={busy || changed} title={changed ? "Save your changes first" : "Send this version to a super admin"}><Send />Request approval</Button>
          )}
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${TONE[review.status]}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={review.status === "approved" ? "default" : "outline"}>{REVIEW_LABEL[review.status]}</Badge>
          <p className="text-sm font-bold">{message.title}</p>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{message.body}</p>
        {!canSubmit && !expanded(review) && review.status !== "pending_approval" && (
          <p className="mt-1 text-xs text-muted-foreground">Your Marketing or Branding lead sends the section to a super admin.</p>
        )}
        {canDecide && review.status === "pending_approval" && (
          <div className="mt-3 space-y-2">
            <Label htmlFor="testimonial-review-note">Note to Marketing and Branding (required to send it back or decline)</Label>
            <textarea id="testimonial-review-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What needs to change, or why this version is declined." className="w-full rounded-md border border-input bg-background p-3 text-sm" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void decision("approve")} disabled={busy}><Check />Approve &amp; publish</Button>
              <Button size="sm" variant="outline" onClick={() => void decision("changes")} disabled={busy}><Undo2 />Send back for updates</Button>
              <Button size="sm" variant="destructive" onClick={() => void decision("deny")} disabled={busy}><X />Decline</Button>
            </div>
          </div>
        )}
      </div>

      <TestimonialFilterPanel filter={filter} onChange={setFilter} locked={locked} />

      <ol className="space-y-6">
        {list.map((t, i) => {
          const problems = testimonialProblems(t);
          const field = (k: keyof typeof TESTIMONIAL_LIMITS, label: string, multiline = false) => (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm"><Label htmlFor={`tm-${t.id}-${k}`}>{label}</Label>
                <span className={`tabular-nums text-xs ${(t[k] ?? "").length > TESTIMONIAL_LIMITS[k] ? "text-destructive" : "text-muted-foreground"}`}>{(t[k] ?? "").length}/{TESTIMONIAL_LIMITS[k]}</span></div>
              {multiline
                ? <textarea id={`tm-${t.id}-${k}`} rows={4} value={t[k] ?? ""} disabled={locked} onChange={(e) => set(i, { [k]: e.target.value })} className="w-full rounded-md border border-input bg-background p-3 text-sm disabled:opacity-60" />
                : <Input id={`tm-${t.id}-${k}`} value={t[k] ?? ""} disabled={locked} onChange={(e) => set(i, { [k]: e.target.value })} />}
            </div>
          );
          return (
            <li key={t.id} className="grid gap-5 rounded-xl border border-border p-4 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">{i + 1}. {t.name || "New testimonial"}</span>
                  <span className="flex items-center gap-1">
                    <label className="mr-2 flex items-center gap-2 text-sm" title={problems.length > 0 ? "Needs a photo and the release date before it can go live" : undefined}><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={t.published} disabled={locked || problems.length > 0} onChange={(e) => set(i, { published: e.target.checked })} />Show on homepage</label>
                    <Button size="icon" variant="ghost" aria-label="Move up" disabled={locked || i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" disabled={locked || i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${t.name || "this testimonial"}`} disabled={locked} onClick={() => void confirmAction({ title: "Delete this testimonial?", text: "It's removed from the draft when you save. The homepage changes only when a super admin approves it. The person's signed release stays in Company Contracts." }).then((ok) => { if (ok) setList((l) => l.filter((_, j) => j !== i)); })}><Trash2 /></Button>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("name", "Name")}{field("location", "Location (optional)")}
                  {field("title", "Role line (optional)")}{field("service", "Service it's about")}
                </div>
                {field("quote", "Quote, in their own words", true)}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor={`tm-${t.id}-release`}>Release signed on</Label><Input id={`tm-${t.id}-release`} type="date" value={t.releaseSignedOn} disabled={locked} onChange={(e) => set(i, { releaseSignedOn: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor={`tm-${t.id}-photo`}>Photo (JPEG, PNG or WebP, up to 5 MB)</Label>
                    <label className={`flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary"}`}><ImagePlus className="h-4 w-4" />{t.photo ? "Replace photo" : "Choose photo"}
                      <input id={`tm-${t.id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} className="sr-only" onChange={(e) => { void pickPhoto(i, e.target.files?.[0]); e.target.value = ""; }} /></label></div>
                </div>
                {t.photo && <div className="space-y-1"><Label>Zoom</Label>
                  <Slider min={ZOOM_RANGE.min} max={ZOOM_RANGE.max} step={0.05} value={[t.zoom ?? 1]} onValueChange={([z]) => set(i, { zoom: z ?? 1 })} disabled={locked} aria-label="Zoom" /></div>}
                {problems.length > 0 && <ul className="space-y-0.5 rounded-lg bg-muted p-3 text-sm">{problems.map((p) => <li key={p}>⚠️ {p}</li>)}</ul>}
                {problems.length === 0 && !t.published && <p className="rounded-lg bg-muted p-3 text-sm">✅ Ready to go live. Tick <span className="font-semibold text-foreground">Show on homepage</span> above, then save.</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Preview{t.photo ? " · tap the face to center it" : ""}</p>
                <div className="relative" onClick={(e) => {
                  if (!t.photo || locked) return;
                  const img = (e.currentTarget.querySelector("img") as HTMLImageElement | null)?.getBoundingClientRect();
                  if (!img || e.clientY > img.bottom) return;
                  const x = Math.round(((e.clientX - img.left) / img.width) * 100), y = Math.round(((e.clientY - img.top) / img.height) * 100);
                  set(i, { focus: `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%` });
                }}>
                  {t.photo ? <TestimonialCard t={t} filter={filter} /> : <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">Add a photo to preview</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {!list.length && <p className="text-sm text-muted-foreground">No testimonials yet. Add one to show the section on the homepage.</p>}
    </section>
  );
}

/** Whether the version has already been decided, so the "your lead sends it" hint has nothing to add. */
function expanded(review: TestimonialReview): boolean {
  return review.status === "changes_requested" || review.status === "denied" || review.status === "approved";
}
