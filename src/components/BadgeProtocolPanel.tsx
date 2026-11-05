import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLLECTIONS, TIER_LABEL, type Tier } from "@/lib/badges";
import {
  BADGE_SCOPES, BADGE_STEPS, FILE_RULES, NAMING_RULES,
  badgeKeys, badgeSlug, slugProblem, type BadgeScope,
} from "@/lib/badge-protocol";
import {
  claimFounderAccess, decideBadgeSubmission, getFounderAccess, listBadgeSubmissions, markBadgeUploaded, submitBadgeIdea, type BadgeSubmission,
} from "@/lib/badge-submissions.functions";

const TIERS: Tier[] = ["standard", "instant", "mega", "ultimate"];
const STATUS: Record<BadgeSubmission["status"], { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "border-border text-muted-foreground" },
  approved: { label: "Approved — awaiting R2 upload", className: "border-primary bg-primary/10 text-primary" },
  rejected: { label: "Rejected", className: "border-destructive text-destructive" },
  uploaded: { label: "Art in R2 — ready to build", className: "border-emerald-600 text-emerald-700" },
};

const readArt = (file: File) =>
  new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      resolve({ name: file.name, type: file.type, base64: text.slice(text.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });

function Step({ n, step }: { n: number; step: { title: string; body: string; who: string } }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{step.title}</span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{step.who}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
      </div>
    </li>
  );
}

/** The submission form. The slug and the two bucket keys update as the title is typed, so nobody guesses a name. */
function BadgeIdeaForm() {
  const submit = useServerFn(submitBadgeIdea);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [collection, setCollection] = useState<string>(COLLECTIONS[0]!.id);
  const [tier, setTier] = useState<Tier>("standard");
  const [scope, setScope] = useState<BadgeScope>("playful");
  const [set, setSet] = useState("");
  const [milestone, setMilestone] = useState("");
  const [action, setAction] = useState("");
  const [description, setDescription] = useState("");
  const [popup, setPopup] = useState("");
  const [webFile, setWebFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const slug = badgeSlug(title);
  const problem = title.trim() ? slugProblem(slug) : null;
  const keys = slug ? badgeKeys({ scope, slug, set: set || null }) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const art = webFile ? await readArt(webFile) : null;
      const master = masterFile ? await readArt(masterFile) : null;
      await submit({
        data: { title, collection, tier, scope, set: set || null, milestone, action, description, popup, art, master },
      });
      toast.success("Idea submitted for super admin approval.");
      setTitle(""); setMilestone(""); setAction(""); setDescription(""); setPopup(""); setSet(""); setWebFile(null); setMasterFile(null);
      await qc.invalidateQueries({ queryKey: ["badge-submissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit the idea.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold">Submit a badge idea</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Nothing ships from this form. A super admin approves it first, then the founder uploads the art to the bucket.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="bp-title" className="text-sm font-medium">Badge title</label>
          <Input id="bp-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Holiday 2026" className="mt-1" />
          {problem ? <p className="mt-1 text-xs text-destructive">{problem}</p>
            : keys ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Bucket keys: <code className="rounded bg-muted px-1">{keys.web}</code> · <code className="rounded bg-muted px-1">{keys.master}</code>
              </p>
            ) : null}
        </div>
        <div>
          <label htmlFor="bp-collection" className="text-sm font-medium">Collection</label>
          <Select value={collection} onValueChange={setCollection}>
            <SelectTrigger id="bp-collection" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{COLLECTIONS.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="bp-tier" className="text-sm font-medium">Tier</label>
          <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
            <SelectTrigger id="bp-tier" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t}>{TIER_LABEL[t] || "Standard"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="bp-scope" className="text-sm font-medium">Art style</label>
          <Select value={scope} onValueChange={(v) => setScope(v as BadgeScope)}>
            <SelectTrigger id="bp-scope" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{BADGE_SCOPES.map((s) => <SelectItem key={s} value={s}>{s === "serious" ? "Serious" : "Playful"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="bp-set" className="text-sm font-medium">Set folder <span className="text-muted-foreground">(optional)</span></label>
          <Input id="bp-set" value={set} onChange={(e) => setSet(e.target.value)} maxLength={48} placeholder="holiday-drops" className="mt-1" />
        </div>
        <div>
          <label htmlFor="bp-milestone" className="text-sm font-medium">Milestone</label>
          <Input id="bp-milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)} maxLength={200} placeholder="Embed 10 lyrics" className="mt-1" />
        </div>
        <div>
          <label htmlFor="bp-action" className="text-sm font-medium">Short action</label>
          <Input id="bp-action" value={action} onChange={(e) => setAction(e.target.value)} maxLength={80} placeholder="Embed 5 lyrics" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="bp-description" className="text-sm font-medium">Description</label>
          <textarea id="bp-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="bp-popup" className="text-sm font-medium">Unlock message</label>
          <Input id="bp-popup" value={popup} onChange={(e) => setPopup(e.target.value)} maxLength={200} placeholder="{artist} came through with 10 embeds" className="mt-1" />
        </div>
        <div>
          <label htmlFor="bp-art" className="text-sm font-medium">Web copy (512 × 512, up to 9 MB)</label>
          <Input id="bp-art" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1"
            onChange={(e) => setWebFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label htmlFor="bp-master" className="text-sm font-medium">4K master (original, up to 9 MB)</label>
          <Input id="bp-master" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1"
            onChange={(e) => setMasterFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-muted-foreground">Both files land with the idea; the founder files each one at the key the queue prints.</p>
        </div>
      </div>
      <Button type="submit" className="mt-4" disabled={busy || !title.trim() || !!problem}>{busy ? "Submitting…" : "Submit for approval"}</Button>
    </form>
  );
}

function SubmissionRow({ s, canDecide }: { s: BadgeSubmission; canDecide: boolean }) {
  const decide = useServerFn(decideBadgeSubmission);
  const uploaded = useServerFn(markBadgeUploaded);
  const qc = useQueryClient();
  const [note, setNote] = useState(s.note);
  const [busy, setBusy] = useState(false);
  const status = STATUS[s.status];

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await qc.invalidateQueries({ queryKey: ["badge-submissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    } finally { setBusy(false); }
  }

  async function copyKeys() {
    try {
      await navigator.clipboard.writeText(`${s.webKey}\n${s.masterKey}`);
      toast.success("Bucket keys copied.");
    } catch { toast.error("Couldn't copy. Select the keys by hand."); }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground">{s.title}</span>
        <Badge variant="outline" className={status.className}>{status.label}</Badge>
        <Badge variant="secondary">{s.collection}</Badge>
        <Badge variant="secondary">{TIER_LABEL[s.tier as Tier] || "Standard"}</Badge>
        <Badge variant="secondary">{s.scope}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {s.submitter || "Staff"} · {new Date(s.createdAt).toLocaleDateString()}
        </span>
      </div>

      {s.milestone ? <p className="mt-2 text-sm text-muted-foreground">{s.milestone}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Web: <code className="rounded bg-muted px-1">{s.webKey}</code></span>
        <span>4K: <code className="rounded bg-muted px-1">{s.masterKey}</code></span>
        <span>{s.artName ? `Web: ${s.artName}` : "No web copy yet"}</span>
        <span>{s.masterName ? `4K: ${s.masterName}` : "No 4K master yet"}</span>
      </div>

      {canDecide && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {s.downloadUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={s.downloadUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Web copy</a>
            </Button>
          )}
          {s.masterUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={s.masterUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />4K master</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void copyKeys()}><Copy className="h-4 w-4" />Copy R2 keys</Button>
          {s.status !== "uploaded" && (
            <>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Why, or the upload note" className="h-9 w-64" />
              {s.status === "submitted" && (
                <>
                  <Button size="sm" disabled={busy} onClick={() => void run(() => decide({ data: { id: s.id, decision: "approved", note } }), "Approved.")}>
                    <Check className="h-4 w-4" />Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => decide({ data: { id: s.id, decision: "rejected", note } }), "Rejected.")}>
                    <X className="h-4 w-4" />Reject
                  </Button>
                </>
              )}
              {s.status === "approved" && (
                <Button size="sm" disabled={busy} onClick={() => void run(() => uploaded({ data: { id: s.id, note } }), "Marked uploaded.")}>
                  <Check className="h-4 w-4" />Art is in R2
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {!canDecide && s.note ? <p className="mt-2 text-xs text-muted-foreground">Founder note: {s.note}</p> : null}
    </li>
  );
}

/**
 * Admin → Badges → Badge Protocol: the conditions, the steps and the approval queue for badge art. Branding, Marketing
 * & Social Media and Support submit; a super admin decides; only the founder uploads to R2 (founder, 2026-11-05).
 */
export function BadgeProtocolPanel({ isSuper }: { isSuper: boolean }) {
  const fetchQueue = useServerFn(listBadgeSubmissions);
  const fetchFounder = useServerFn(getFounderAccess);
  const claimSeat = useServerFn(claimFounderAccess);
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ["badge-submissions"], queryFn: () => fetchQueue(), refetchOnWindowFocus: false });
  const founder = useQuery({ queryKey: ["founder-access"], queryFn: () => fetchFounder(), refetchOnWindowFocus: false });
  const [claiming, setClaiming] = useState(false);
  const isFounder = founder.data?.me ?? false;
  const rows = queue.data ?? [];
  const waiting = rows.filter((r) => r.status === "submitted").length;

  async function claim() {
    setClaiming(true);
    try {
      await claimSeat();
      toast.success("Founder access claimed. Approvals are yours alone now.");
      await qc.invalidateQueries({ queryKey: ["founder-access"] });
      await qc.invalidateQueries({ queryKey: ["badge-submissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't claim founder access.");
    } finally { setClaiming(false); }
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Badge creation, start to finish</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every step in one list, in the order it happens: designed by the teams, approved by a super admin, uploaded to
          the bucket by the founder alone, then built by engineering so it can be earned. Nobody else holds the bucket
          keys, so nobody else can put art in front of a user.
        </p>
        <ol className="mt-4 space-y-3">
          {BADGE_STEPS.map((step, i) => <Step key={step.title} n={i + 1} step={step} />)}
        </ol>
      </section>

      {isSuper && (
        <section className={`rounded-2xl border p-5 ${isFounder ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{isFounder ? "You are the founder" : "Founder access"}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isFounder
                  ? "Approving badge art and marking it uploaded in R2 is yours alone, even if another super admin is added later."
                  : founder.data?.claimed
                    ? "Badge approvals belong to the founder's account. A super admin can read this queue but cannot approve it."
                    : "Nobody has claimed this seat yet. Claim it once and approval stops depending on the super admin role."}
              </p>
            </div>
            {founder.data && !founder.data.claimed && (
              <Button disabled={claiming} onClick={() => void claim()}>{claiming ? "Claiming…" : "Claim founder access"}</Button>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Naming conditions</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {NAMING_RULES.map((n) => (
              <li key={n.rule}>
                <span className="font-semibold text-foreground">{n.rule}:</span>{" "}
                <span className="text-muted-foreground">{n.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-bold">The two files</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {FILE_RULES.map((f) => (
              <li key={f.file}>
                <span className="font-semibold text-foreground">{f.file}:</span>{" "}
                <span className="text-muted-foreground">{f.spec}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BadgeIdeaForm />

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold">Approval queue</h3>
          <Badge variant={waiting ? "default" : "secondary"}>{waiting} waiting</Badge>
          {!isSuper && <span className="text-xs text-muted-foreground">A super admin approves every idea.</span>}
        </div>
        {queue.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          : queue.isError ? <p className="mt-3 text-sm text-destructive">Couldn't load the queue. Has migration 20261105120000 been run?</p>
          : rows.length ? <ul className="mt-3 space-y-3">{rows.map((s) => <SubmissionRow key={s.id} s={s} canDecide={isFounder} />)}</ul>
          : <p className="mt-3 text-sm text-muted-foreground">No badge ideas yet.</p>}
      </section>

    </div>
  );
}
