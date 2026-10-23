import { useEffect, useState } from "react";
import { Copy, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendIpiRequest } from "@/lib/ipi-request.functions";
import { createIpiRequest, ipiLink, type IpiRequest } from "@/lib/ipi-requests";

export type Cowriter = { name: string; role: string; songs: { catalog_id: string; title: string }[]; email?: string | undefined };
const listSongs = (songs: { title: string }[]) => songs.slice(0, 4).map((s) => s.title).join(", ") + (songs.length > 4 ? ` and ${songs.length - 4} more` : "");

/** Ask a co-writer for their PRO and IPI: pick who, confirm their email, then send or copy the link. */
export function AskCowriterDialog({ open, cowriters, artistName, existing, onClose, onCreated }: {
  open: boolean; cowriters: Cowriter[]; artistName: string; existing: IpiRequest[]; onClose: () => void; onCreated: (r: IpiRequest) => void;
}) {
  const [pick, setPick] = useState(0);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendIpiRequest);
  const who = cowriters[pick];
  useEffect(() => { setEmail(who?.email ?? ""); }, [pick, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = who && existing.find((r) => r.status === "pending" && r.writerName.toLowerCase() === who.name.toLowerCase());

  async function go(mode: "email" | "link") {
    if (!who) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error("Add their email. Their free account has to use it."); return; }
    setBusy(true);
    try {
      const r = pending && pending.email === email.trim().toLowerCase() ? pending : await createIpiRequest({ writerName: who.name, role: who.role, email, songs: who.songs, artistName });
      if (r !== pending) onCreated(r);
      if (mode === "email") { await send({ data: { id: r.id, origin: window.location.origin } }); toast.success(`Sent to ${who.name}.`); }
      else { await navigator.clipboard.writeText(ipiLink(r.id)); toast.success("Link copied. Send it to them by text or DM."); }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the request.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a co-writer for their PRO and IPI</DialogTitle>
          <DialogDescription>They create a free account with this email and add their own details. You approve before anything goes into your catalog.</DialogDescription>
        </DialogHeader>
        {!cowriters.length ? <p className="text-sm text-muted-foreground">Every co-writer already has a PRO and IPI. Nothing to ask.</p> : <div className="space-y-4">
          {cowriters.length > 1 && <label className="block space-y-1 text-sm"><span className="font-medium">Co-writer</span>
            <select value={pick} onChange={(e) => setPick(Number(e.target.value))} className="w-full rounded-md border border-input bg-background px-3 py-2">
              {cowriters.map((c, i) => <option key={c.name} value={i}>{c.name} · {c.songs.length} song{c.songs.length === 1 ? "" : "s"}</option>)}
            </select></label>}
          {who && <div className="rounded-lg bg-muted p-3 text-sm"><b>{who.name}</b> · {who.role}<span className="block text-muted-foreground">Missing on {listSongs(who.songs)}</span></div>}
          <label className="block space-y-1 text-sm"><span className="font-medium">{who?.name.split(" ")[0] ?? "Their"}'s email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
            <span className="block text-xs text-muted-foreground">{who?.email ? "From your Contributor Library or split sheets." : "We'll save it with the request."}</span></label>
          {pending && <p className="text-xs text-muted-foreground">You already asked {who!.name} on {new Date(pending.createdAt).toLocaleDateString()}. Sending again reuses that request.</p>}
        </div>}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={busy || !who} onClick={() => void go("link")}><Copy />Copy the link instead</Button>
          <Button disabled={busy || !who} onClick={() => void go("email")}>{busy ? <Loader2 className="animate-spin" /> : <Send />}Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Answers waiting for approval, and requests still out. Approving fills blank PRO/IPI fields only. */
export function IpiRequestList({ requests, onApply, onDismiss, onResend }: {
  requests: IpiRequest[]; onApply: (r: IpiRequest) => Promise<void>; onDismiss: (r: IpiRequest) => Promise<void>; onResend: (r: IpiRequest) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string>();
  const run = async (id: string, f: () => Promise<void>) => { setBusy(id); try { await f(); } finally { setBusy(undefined); } };
  const shown = requests.filter((r) => r.status === "answered" || r.status === "pending");
  if (!shown.length) return <p className="text-sm text-muted-foreground">No requests out. Use "Ask a co-writer for their IPI" in the report whenever a co-writer's details are missing.</p>;
  return (
    <ul className="space-y-3">
      {shown.map((r) => (
        <li key={r.id} className={`rounded-xl border p-4 ${r.status === "answered" ? "border-primary bg-primary/5" : "border-border"}`}>
          {r.status === "answered" && r.answer ? <>
            <b>{r.answer.legal_name} sent their details</b>
            <p className="mt-1 text-sm">{r.answer.no_pro ? "Not in a PRO yet. Nothing to add for now." : `${r.answer.pro} · IPI ${r.answer.ipi}`}</p>
            <p className="text-xs text-muted-foreground">{r.answer.no_pro ? "Ask again once they join one." : `Fills the blank PRO and IPI for ${r.writerName} on ${listSongs(r.songs)}. Nothing you already entered is changed.`}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!r.answer.no_pro && <Button size="sm" disabled={!!busy} onClick={() => void run(r.id, () => onApply(r))}>{busy === r.id && <Loader2 className="animate-spin" />}Add to {r.songs.length} song{r.songs.length === 1 ? "" : "s"}</Button>}
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run(r.id, () => onDismiss(r))}>{r.answer.no_pro ? "Got it" : "Not right"}</Button>
            </div>
          </> : <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><b>{r.writerName}</b> <span className="text-sm text-muted-foreground">· {r.email}</span></span>
              <span className="text-xs text-muted-foreground">{r.sentAt ? `Emailed ${new Date(r.sentAt).toLocaleDateString()}` : "Link only"} · waiting</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{listSongs(r.songs)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run(r.id, () => onResend(r))}><Mail />Email again</Button>
              <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(ipiLink(r.id)).then(() => toast.success("Link copied."))}><Copy />Copy link</Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void run(r.id, () => onDismiss(r))}>Cancel</Button>
            </div>
          </>}
        </li>
      ))}
    </ul>
  );
}
