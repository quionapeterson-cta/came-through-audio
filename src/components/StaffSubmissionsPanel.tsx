import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPT_FOR, fileProblem, KIND_HINT, KIND_LABEL, KIND_LIMIT, limitLabel, STATUS_LABEL,
  SUBMISSION_KINDS, SUBMISSION_STATUS, type SubmissionKind, type SubmissionStatus,
} from "@/lib/staff-submissions";
import {
  createSubmissionUpload, handleStaffSubmission, listStaffSubmissions, submitStaffIdea, type StaffSubmission,
} from "@/lib/staff-submissions.functions";

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  new: "border-primary bg-primary/10 text-primary",
  in_review: "border-border text-foreground",
  done: "border-emerald-600 text-emerald-700",
  declined: "border-destructive text-destructive",
};

const sizeLabel = (bytes: number | null) => (bytes ? limitLabel(bytes) : "");

/** Any staff member's form: one kind, a title, a note, an optional link and an optional file. */
function SubmissionForm() {
  const startUpload = useServerFn(createSubmissionUpload);
  const submit = useServerFn(submitStaffIdea);
  const qc = useQueryClient();
  const [kind, setKind] = useState<SubmissionKind>("idea");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (file) {
      const problem = fileProblem(kind, file);
      if (problem) { toast.error(problem); return; }
    }
    setBusy(true);
    try {
      let uploaded: { path: string; name: string; size: number; type: string } | null = null;
      if (file) {
        const target = await startUpload({ data: { kind, name: file.name, size: file.size, type: file.type } });
        const { error } = await supabase.storage.from("staff-submissions").uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
        if (error) throw new Error("The file didn't finish uploading. Try again, or send it as a link.");
        uploaded = { path: target.path, name: file.name, size: file.size, type: file.type };
      }
      await submit({ data: { kind, title, details, link: link || null, file: uploaded } });
      toast.success("Sent to the super admin.");
      setTitle(""); setDetails(""); setLink(""); setFile(null);
      await qc.invalidateQueries({ queryKey: ["staff-submissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void send(e)} className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-lg font-bold">Send something to a super admin</h3>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Ideas, paperwork, videos, music, photos, projects. Any staff member can send one; a super admin is the only
        person who reads it back.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="ib-kind" className="text-sm font-medium">What is it?</label>
          <Select value={kind} onValueChange={(v) => { setKind(v as SubmissionKind); setFile(null); }}>
            <SelectTrigger id="ib-kind" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{SUBMISSION_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
        </div>
        <div>
          <label htmlFor="ib-title" className="text-sm font-medium">Title</label>
          <Input id="ib-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Q1 social campaign" className="mt-1" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="ib-details" className="text-sm font-medium">Details</label>
          <textarea id="ib-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="ib-link" className="text-sm font-medium">Link <span className="text-muted-foreground">(optional)</span></label>
          <Input id="ib-link" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://…" className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Use a link for anything bigger than the file limit.</p>
        </div>
        <div>
          <label htmlFor="ib-file" className="text-sm font-medium">File <span className="text-muted-foreground">(optional, up to {limitLabel(KIND_LIMIT[kind])})</span></label>
          <Input id="ib-file" type="file" accept={ACCEPT_FOR(kind)} className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <Button type="submit" className="mt-4" disabled={busy || title.trim().length < 3}>
        <Send className="h-4 w-4" />{busy ? "Sending…" : "Send to super admin"}
      </Button>
    </form>
  );
}

function SubmissionRow({ s, isSuper }: { s: StaffSubmission; isSuper: boolean }) {
  const handle = useServerFn(handleStaffSubmission);
  const qc = useQueryClient();
  const [status, setStatus] = useState<SubmissionStatus>(s.status);
  const [note, setNote] = useState(s.note);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await handle({ data: { id: s.id, status, note } });
      toast.success("Updated.");
      await qc.invalidateQueries({ queryKey: ["staff-submissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that.");
    } finally { setBusy(false); }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground">{s.title}</span>
        <Badge variant="secondary">{KIND_LABEL[s.kind]}</Badge>
        <Badge variant="outline" className={STATUS_STYLE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {s.submitter || "Staff"} · {new Date(s.createdAt).toLocaleDateString()}
        </span>
      </div>
      {s.details ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{s.details}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {s.link ? <a href={s.link} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Open link</a> : null}
        {s.fileName ? <span>{s.fileName} · {sizeLabel(s.fileSize)}</span> : null}
        {isSuper && s.downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={s.downloadUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Download</a>
          </Button>
        ) : null}
      </div>
      {isSuper && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as SubmissionStatus)}>
            <SelectTrigger className="h-9 w-52" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>{SUBMISSION_STATUS.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note back to the submitter" className="h-9 w-64" />
          <Button size="sm" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      )}
      {!isSuper && s.note ? <p className="mt-2 text-xs text-muted-foreground">Super admin: {s.note}</p> : null}
    </li>
  );
}

/**
 * Admin → Idea Box: every staff member sends ideas, paperwork, video, music, photos and projects to a super admin
 * (founder, 2026-11-05). Files go straight to a private bucket through a signed upload; nobody but a super admin reads
 * them back, and nothing bigger than the kind's limit ever leaves the browser.
 */
export function StaffSubmissionsPanel({ isSuper }: { isSuper: boolean }) {
  const fetchQueue = useServerFn(listStaffSubmissions);
  const queue = useQuery({ queryKey: ["staff-submissions"], queryFn: () => fetchQueue(), refetchOnWindowFocus: false });
  const rows = queue.data ?? [];
  const waiting = rows.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-6">
      <SubmissionForm />
      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold">{isSuper ? "Everything sent to you" : "What you've sent"}</h3>
          {waiting > 0 && <Badge>{waiting} waiting</Badge>}
          <span className="text-xs text-muted-foreground">
            {isSuper ? "Only super admins see other people's submissions." : "A super admin reads these; you'll see their note here."}
          </span>
        </div>
        {queue.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          : queue.isError ? <p className="mt-3 text-sm text-destructive">Couldn't load submissions. Has migration 20261105130000 been run?</p>
          : rows.length ? <ul className="mt-3 space-y-3">{rows.map((s) => <SubmissionRow key={s.id} s={s} isSuper={isSuper} />)}</ul>
          : <p className="mt-3 text-sm text-muted-foreground">Nothing yet.</p>}
      </section>
    </div>
  );
}
