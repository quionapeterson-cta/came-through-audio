import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { confirmAction } from "@/components/ConfirmHost";
import { TestimonialCard } from "@/components/TestimonialCard";
import { getTestimonialDrafts, getTestimonialFilter, saveTestimonials, uploadTestimonialPhoto } from "@/lib/testimonials.functions";
import { DEFAULT_TESTIMONIAL_FILTER, TESTIMONIAL_LIMITS, ZOOM_RANGE, testimonialProblems, type EditableTestimonial } from "@/lib/testimonials";

const blank = (): EditableTestimonial => ({ id: crypto.randomUUID().slice(0, 12), name: "", title: "", location: "", service: "", quote: "", photo: "", focus: "50% 30%", zoom: 1, releaseSignedOn: "", published: false });
const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

/**
 * Admin → Homepage: swap testimonial photos, quotes, names and locations without a code change (Marketing, Branding,
 * super admins). Fool-proof by design: character limits keep every card the same shape, a card can't publish without
 * a photo and its signed release date, the preview is the real card with the shared filter, and nothing goes live
 * until Save. Quotes stay in the person's own words.
 */
export function TestimonialsEditor() {
  const load = useServerFn(getTestimonialDrafts);
  const loadFilter = useServerFn(getTestimonialFilter);
  const save = useServerFn(saveTestimonials);
  const upload = useServerFn(uploadTestimonialPhoto);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["testimonial-drafts"], queryFn: () => load() });
  const f = useQuery({ queryKey: ["testimonial-filter"], queryFn: () => loadFilter() });
  const [list, setList] = useState<EditableTestimonial[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setList(q.data); }, [q.data]);
  const changed = !!q.data && JSON.stringify(list) !== JSON.stringify(q.data);
  const set = (i: number, patch: Partial<EditableTestimonial>) => setList((l) => l.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: number) => setList((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); return n; });

  async function pickPhoto(i: number, file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photos can be up to 5 MB."); return; }
    try { const { url } = await upload({ data: { base64: await toBase64(file), type: file.type } }); set(i, { photo: url, focus: "50% 30%", zoom: 1 }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't upload the photo."); }
  }
  async function publish() {
    setBusy(true);
    try {
      const saved = await save({ data: list });
      await qc.invalidateQueries({ queryKey: ["testimonial-drafts"] });
      const drafts = saved.filter((t) => !t.published).length;
      toast.success(drafts ? `Saved. ${drafts} card${drafts === 1 ? " is" : "s are"} still drafts (see what's missing).` : "Saved. The homepage shows these cards now.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }

  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load the testimonials.</p>;
  const filter = f.data ?? DEFAULT_TESTIMONIAL_FILTER;
  return (
    <section className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Homepage testimonials</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Swap photos, quotes, names and locations. Quotes stay in the person's own words: trim with … but never reword. A card goes live only with a photo and the date their Photo, Video &amp; Testimonial Release was signed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setList((l) => [...l, blank()])} disabled={list.length >= 12}><Plus />Add a testimonial</Button>
          <Button variant="ghost" onClick={() => q.data && setList(q.data)} disabled={!changed}>Undo changes</Button>
          <Button onClick={() => void publish()} disabled={busy || !changed}>{busy ? "Saving…" : "Save to homepage"}</Button>
        </div>
      </div>

      <ol className="space-y-6">
        {list.map((t, i) => {
          const problems = testimonialProblems(t);
          const field = (k: keyof typeof TESTIMONIAL_LIMITS, label: string, multiline = false) => (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm"><Label htmlFor={`tm-${t.id}-${k}`}>{label}</Label>
                <span className={`tabular-nums text-xs ${(t[k] ?? "").length > TESTIMONIAL_LIMITS[k] ? "text-destructive" : "text-muted-foreground"}`}>{(t[k] ?? "").length}/{TESTIMONIAL_LIMITS[k]}</span></div>
              {multiline
                ? <textarea id={`tm-${t.id}-${k}`} rows={4} value={t[k] ?? ""} onChange={(e) => set(i, { [k]: e.target.value })} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
                : <Input id={`tm-${t.id}-${k}`} value={t[k] ?? ""} onChange={(e) => set(i, { [k]: e.target.value })} />}
            </div>
          );
          return (
            <li key={t.id} className="grid gap-5 rounded-xl border border-border p-4 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">{i + 1}. {t.name || "New testimonial"}</span>
                  <span className="flex items-center gap-1">
                    <label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={t.published} disabled={problems.length > 0} onChange={(e) => set(i, { published: e.target.checked })} />Show on homepage</label>
                    <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${t.name || "this testimonial"}`} onClick={() => void confirmAction({ title: "Delete this testimonial?", text: "It's removed when you save. The person's signed release stays in Company Contracts." }).then((ok) => { if (ok) setList((l) => l.filter((_, j) => j !== i)); })}><Trash2 /></Button>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("name", "Name")}{field("location", "Location (optional)")}
                  {field("title", "Role line (optional)")}{field("service", "Service it's about")}
                </div>
                {field("quote", "Quote, in their own words", true)}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor={`tm-${t.id}-release`}>Release signed on</Label><Input id={`tm-${t.id}-release`} type="date" value={t.releaseSignedOn} onChange={(e) => set(i, { releaseSignedOn: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor={`tm-${t.id}-photo`}>Photo (JPEG, PNG or WebP, up to 5 MB)</Label>
                    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm hover:border-primary"><ImagePlus className="h-4 w-4" />{t.photo ? "Replace photo" : "Choose photo"}
                      <input id={`tm-${t.id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pickPhoto(i, e.target.files?.[0]); e.target.value = ""; }} /></label></div>
                </div>
                {t.photo && <div className="space-y-1"><Label>Zoom</Label>
                  <Slider min={ZOOM_RANGE.min} max={ZOOM_RANGE.max} step={0.05} value={[t.zoom ?? 1]} onValueChange={([z]) => set(i, { zoom: z ?? 1 })} aria-label="Zoom" /></div>}
                {problems.length > 0 && <ul className="space-y-0.5 rounded-lg bg-muted p-3 text-sm">{problems.map((p) => <li key={p}>⚠️ {p}</li>)}</ul>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Preview{t.photo ? " · tap the face to center it" : ""}</p>
                <div className="relative" onClick={(e) => {
                  if (!t.photo) return;
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
