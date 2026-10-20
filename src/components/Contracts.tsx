import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, Copy, Download, FileSignature, Loader2, Lock, Mail, PenLine, Plus, RotateCcw, ScrollText, ShieldCheck, Trash2, Unlock, Vault } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { BLUEPRINTS, CONTRACT_DISCLAIMER, blueprintById, renderContract, type Blueprint } from "@/lib/contract-blueprints";
import { downloadContractPdf } from "@/lib/contract-pdf";
import { sendContractInvite } from "@/lib/contracts-email.functions";
import { NextBadgeHint } from "@/components/Badges";
import { logBadgeEvent } from "@/lib/badge-events";
import {
  contractLink, deleteContract, emptyParty, isValidEmail, listContracts, listReceivedContracts, reopenContract, saveContract, sendContract, signContract,
  type Contract, type ContractParty, type ReceivedContract,
} from "@/lib/contracts";

type View = "blueprints" | "contracts" | "vault";

const STATUS: Record<Contract["status"], { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border text-muted-foreground" },
  sent: { label: "Out for signature", className: "border-primary text-primary" },
  signed: { label: "Fully signed", className: "border-primary bg-primary text-primary-foreground" },
};

/**
 * Contracts & Blueprints: browse blueprints (guides are open to everyone as a preview), build custom contracts,
 * request signatures, and keep fully signed contracts in the vault. Creating requires Catalog Management;
 * contracts other people send you are always visible, since signing is free.
 */
export function Contracts({ userId, unlocked, onUpgrade }: { userId: string; unlocked: boolean; onUpgrade: () => void }) {
  const [view, setView] = useState<View>("blueprints");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [received, setReceived] = useState<ReceivedContract[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contract | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, r, t] = await Promise.allSettled([unlocked ? listContracts() : Promise.resolve([]), listReceivedContracts(), listTracks()]);
    if (c.status === "fulfilled") setContracts(c.value);
    if (r.status === "fulfilled") setReceived(r.value);
    if (t.status === "fulfilled") setTracks(t.value);
    if (c.status === "rejected" || r.status === "rejected") toast.error("Could not load your contracts.");
    setLoading(false);
  };
  useEffect(() => { void load(); }, [unlocked]);

  const start = (bp: Blueprint) => {
    if (!unlocked) { onUpgrade(); return; }
    setEditing({
      blueprint: bp.id, title: bp.name, catalogId: null, fields: {}, body: "", status: "draft", bodyHash: "",
      sentAt: null, completedAt: null, updatedAt: new Date().toISOString(),
      parties: bp.roles.map((role, i) => emptyParty(role, i === 0)),
    });
  };

  if (editing) {
    return <ContractEditor userId={userId} initial={editing} tracks={tracks} onClose={() => { setEditing(null); void load(); }} />;
  }

  const open = contracts.filter((c) => c.status !== "signed");
  const signed = contracts.filter((c) => c.status === "signed");

  return (
    <TooltipProvider delayDuration={100}>
      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NextBadgeHint userId={userId} collections={["contracts"]} className="order-last" />
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Contracts">
            {([["blueprints", "Blueprints", ScrollText], ["contracts", "My Contracts", FileSignature], ["vault", "Signed Vault", Vault]] as const).map(([id, label, Icon]) => (
              <Button key={id} role="tab" aria-selected={view === id} size="sm" variant={view === id ? "default" : "ghost"} onClick={() => setView(id)}>
                <Icon className="h-4 w-4" />{label}
                {id === "contracts" && open.length > 0 && <span className="ml-1 opacity-70">{open.length}</span>}
                {id === "vault" && signed.length + received.length > 0 && <span className="ml-1 opacity-70">{signed.length + received.length}</span>}
              </Button>
            ))}
          </div>
          {!unlocked && <Button size="sm" onClick={onUpgrade}><Lock className="h-4 w-4" />Unlock with Catalog Management</Button>}
        </div>

        {view === "blueprints" && <Blueprints unlocked={unlocked} onUse={start} />}

        {view === "contracts" && (!unlocked ? (
          <Locked onUpgrade={onUpgrade} text="Build custom contracts from any blueprint, send them for e-signature and keep every signed copy in your vault." />
        ) : loading ? <Spinner /> : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Drafts and contracts waiting on signatures. Start a new one from any blueprint.</p>
              <Button onClick={() => setView("blueprints")}><Plus className="h-4 w-4" />New contract</Button>
            </div>
            {open.length === 0
              ? <Empty icon={FileSignature} text="No contracts yet. Pick a blueprint to create your first one." />
              : <ul className="grid gap-3">{open.map((c) => <ContractRow key={c.id} contract={c} onOpen={() => setEditing(c)} />)}</ul>}
          </section>
        ))}

        {view === "vault" && (loading ? <Spinner /> : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">Your signed contracts <span className="opacity-70">{signed.length}</span></h3>
              {!unlocked ? <p className="text-sm text-muted-foreground">Contracts you create with Catalog Management are stored here once everyone signs.</p>
                : signed.length === 0 ? <p className="text-sm text-muted-foreground">Fully signed contracts are locked and stored here, ready to download.</p>
                : <ul className="grid gap-3">{signed.map((c) => <ContractRow key={c.id} contract={c} onOpen={() => setEditing(c)} />)}</ul>}
            </section>
            <section className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">Sent to you <span className="opacity-70">{received.length}</span></h3>
              {received.length === 0 ? <p className="text-sm text-muted-foreground">Contracts other people ask you to sign show up here.</p> : (
                <ul className="grid gap-2">
                  {received.map((r) => (
                    <li key={r.party_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                      <div>
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-xs text-muted-foreground">You sign as {r.role}{r.signed_at ? ` · signed ${new Date(r.signed_at).toLocaleDateString()}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={STATUS[r.status].className}>{STATUS[r.status].label}</Badge>
                        <Button asChild size="sm" variant={r.signed_at ? "outline" : "default"}><a href={`/contract/${r.party_id}`}>{r.signed_at ? "View" : "Review & sign"}</a></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

function Blueprints({ unlocked, onUse }: { unlocked: boolean; onUse: (bp: Blueprint) => void }) {
  const [openId, setOpenId] = useState<string>();
  return (
    <section className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{CONTRACT_DISCLAIMER}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {BLUEPRINTS.map((bp) => {
          const expanded = openId === bp.id;
          return (
            <article key={bp.id} className={`flex flex-col rounded-2xl border p-5 transition ${expanded ? "border-primary" : "border-border hover:border-primary"}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{bp.category}</p>
              <h3 className="mt-1 text-lg font-bold">{bp.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{bp.summary}</p>
              {expanded && (
                <div className="mt-4 space-y-3 text-sm">
                  <p><span className="font-semibold">When to use it: </span>{bp.whenToUse}</p>
                  <div>
                    <p className="font-semibold">Key terms to watch</p>
                    <ul className="mt-1 space-y-1">{bp.keyTerms.map((k) => <li key={k} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} /><span>{k}</span></li>)}</ul>
                  </div>
                  <p className="text-muted-foreground">Parties: {bp.roles.join(" and ")}</p>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="ghost" onClick={() => { if (!expanded) logBadgeEvent("blueprint_read"); setOpenId(expanded ? undefined : bp.id); }}>{expanded ? "Hide guide" : "Read the guide"}</Button>
                <Button size="sm" variant="outline" onClick={() => unlocked ? void downloadContractPdf({ title: bp.name, body: renderContract(bp, {}, []), parties: bp.roles.map((role) => ({ name: "", role, signedAt: null })), status: "draft" }) : onUse(bp)}>
                  {unlocked ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}Blank PDF
                </Button>
                <Button size="sm" onClick={() => onUse(bp)}>{unlocked ? <PenLine className="h-4 w-4" /> : <Lock className="h-4 w-4" />}Use this blueprint</Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ContractRow({ contract: c, onOpen }: { contract: Contract; onOpen: () => void }) {
  const done = c.parties.filter((p) => p.signedAt).length;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 transition hover:border-primary">
      <div className="min-w-0">
        <div className="truncate font-bold">{c.title}</div>
        <div className="text-xs text-muted-foreground">{blueprintById(c.blueprint)?.name ?? "Custom"} · {c.parties.map((p) => p.legalName || p.role).join(", ")}</div>
      </div>
      <div className="flex items-center gap-2">
        {c.status !== "draft" && <span className="text-xs text-muted-foreground">{done}/{c.parties.length} signed</span>}
        <Badge variant="outline" className={STATUS[c.status].className}>{STATUS[c.status].label}</Badge>
        <Button size="sm" variant="outline" onClick={onOpen}>{c.status === "draft" ? "Edit" : "Open"}</Button>
      </div>
    </li>
  );
}

function ContractEditor({ userId, initial, tracks, onClose }: { userId: string; initial: Contract; tracks: CatalogTrack[]; onClose: () => void }) {
  const bp = blueprintById(initial.blueprint) ?? BLUEPRINTS[0]!;
  const [c, setC] = useState<Contract>(initial);
  const [customized, setCustomized] = useState(!!initial.body && initial.body !== renderContract(bp, initial.fields, initial.parties));
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState({ email: "", legalName: "" });
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState<string>();
  const sendInvite = useServerFn(sendContractInvite);
  const draft = c.status === "draft";

  useEffect(() => {
    void Promise.all([supabase.from("profiles").select("legal_name").eq("id", userId).maybeSingle(), supabase.auth.getUser()]).then(([{ data }, { data: auth }]) => {
      const a = { email: auth.user?.email ?? "", legalName: data?.legal_name ?? "" };
      setAccount(a);
      if (initial.status === "draft") setC((x) => ({ ...x, parties: x.parties.map((p) => p.isOwner ? { ...p, email: a.email, legalName: p.legalName || a.legalName } : p) }));
    });
  }, [userId]);

  const rendered = useMemo(() => renderContract(bp, c.fields, c.parties), [bp, c.fields, c.parties]);
  const body = customized ? c.body : rendered;
  const blanks = draft ? [...new Set(body.match(/\[[^\]\n]{2,60}\]/g) ?? [])] : [];
  const partyIssues = c.parties.flatMap((p, i) => [
    !p.legalName.trim() && `${p.role || `Party ${i + 1}`}: add a legal name`,
    !isValidEmail(p.email) && `${p.role || `Party ${i + 1}`}: add a valid email`,
  ]).filter((x): x is string => !!x);
  const ready = c.parties.length >= 2 && partyIssues.length === 0 && blanks.length === 0;

  const setField = (key: string, value: string) => setC((x) => ({ ...x, fields: { ...x.fields, [key]: value } }));
  const setParty = (i: number, patch: Partial<ContractParty>) => setC((x) => ({ ...x, parties: x.parties.map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  const markOwner = (i: number) => setC((x) => ({ ...x, parties: x.parties.map((p, idx) => idx === i
    ? { ...p, isOwner: true, email: account.email, legalName: p.legalName || account.legalName }
    : { ...p, isOwner: false, email: p.isOwner ? "" : p.email }) }));
  const pickSong = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    setC((x) => ({ ...x, catalogId: id || null, ...(t && { fields: { ...x.fields, songTitle: t.title }, title: `${bp.name} – ${t.title}` }) }));
  };

  const save = async (quiet = false) => {
    setBusy(true);
    try {
      const saved = await saveContract({ ...c, body });
      setC(saved);
      if (!quiet) toast.success("Draft saved.");
      return saved;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the contract.");
      return null;
    } finally { setBusy(false); }
  };

  const lockAndSend = async () => {
    const saved = await save(true);
    if (!saved?.id) return;
    setBusy(true);
    try {
      await sendContract(saved.id);
      const fresh = (await listContracts()).find((x) => x.id === saved.id);
      if (fresh) setC(fresh);
      toast.success("Locked. Now send each party their signature request.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not lock the contract."); }
    finally { setBusy(false); }
  };

  const refresh = async () => { const fresh = (await listContracts()).find((x) => x.id === c.id); if (fresh) setC(fresh); };

  const email = async (p: ContractParty) => {
    if (!p.id) return;
    setSending(p.id);
    try {
      await sendInvite({ data: { partyId: p.id, origin: window.location.origin } });
      toast.success(`Signature request emailed to ${p.email}.`);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the email."); }
    finally { setSending(undefined); }
  };

  const signAsOwner = async (p: ContractParty) => {
    if (!p.id) return;
    if (typed.trim().toLowerCase() !== p.legalName.trim().toLowerCase()) { toast.error("Type your legal name exactly as listed."); return; }
    setBusy(true);
    try { await signContract(p.id, typed); setTyped(""); toast.success("Signed."); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not sign."); }
    finally { setBusy(false); }
  };

  const pdf = () => downloadContractPdf({ title: c.title, body, bodyHash: c.bodyHash, status: c.status,
    parties: c.parties.map((p) => ({ name: p.legalName, role: p.role, signedAt: p.signedAt, signatureName: p.signatureName, signatureHash: p.signatureHash })) });

  return (
    <TooltipProvider delayDuration={100}>
      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose}><ChevronLeft className="h-4 w-4" />All contracts</Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={STATUS[c.status].className}>{STATUS[c.status].label}</Badge>
            <Button variant="outline" size="sm" onClick={() => void pdf()}><Download className="h-4 w-4" />{c.status === "signed" ? "Signed PDF" : "PDF"}</Button>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{bp.name}</p>
          {draft
            ? <Input aria-label="Contract title" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} className="mt-1 h-auto border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0" />
            : <h2 className="mt-1 text-2xl font-bold">{c.title}</h2>}
        </div>

        {draft && (
          <>
            <Step n={1} title="Deal details">
              <div className="grid gap-4 sm:grid-cols-2">
                {tracks.length > 0 && bp.fields.some((f) => f.key === "songTitle") && (
                  <Field label="Catalog song (optional)" tip="Pick a song from My Catalog to fill in its title.">
                    <select value={c.catalogId ?? ""} onChange={(e) => pickSong(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Not linked to a catalog song</option>
                      {[...tracks].sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </Field>
                )}
                {bp.fields.map((f) => (
                  <Field key={f.key} label={f.label} tip={f.tip} wide={f.multiline}>
                    {f.multiline
                      ? <textarea rows={3} value={c.fields[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
                      : <Input value={c.fields[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} />}
                  </Field>
                ))}
              </div>
            </Step>

            <Step n={2} title="Parties" hint="Use each person's legal name. Mark which party is you; you'll sign with your account email.">
              <div className="space-y-3">
                {c.parties.map((p, i) => (
                  <div key={p.id ?? i} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end ${p.isOwner ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Field label="Role" tip="This party's role in the deal, for example Artist or Producer.">
                      <Input list={`roles-${bp.id}`} value={p.role} onChange={(e) => setParty(i, { role: e.target.value })} />
                    </Field>
                    <Field label="Legal name" tip="The person's or company's full legal name, exactly as it should appear on the contract.">
                      <Input value={p.legalName} onChange={(e) => setParty(i, { legalName: e.target.value })} placeholder="Full legal name" />
                    </Field>
                    <Field label="Email" tip="Where the signature request goes. They sign by logging in with this email.">
                      <Input type="email" value={p.email} disabled={p.isOwner} onChange={(e) => setParty(i, { email: e.target.value })} placeholder="name@example.com" />
                    </Field>
                    <div className="flex items-center gap-2 pb-1">
                      <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="owner" checked={p.isOwner} onChange={() => markOwner(i)} className="accent-[var(--primary)]" />Me</label>
                      {c.parties.length > 2 && <Button variant="ghost" size="icon" aria-label={`Remove ${p.role}`} onClick={() => setC({ ...c, parties: c.parties.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
                <datalist id={`roles-${bp.id}`}>{bp.roles.map((r) => <option key={r} value={r} />)}</datalist>
                <Button variant="outline" size="sm" onClick={() => setC({ ...c, parties: [...c.parties, emptyParty(bp.roles[1])] })}><Plus className="h-4 w-4" />Add party</Button>
              </div>
            </Step>
          </>
        )}

        <Step n={draft ? 3 : undefined} title="Contract text" hint={draft ? "Fills in as you type. Customize the wording if you need to." : c.bodyHash ? `Locked · SHA-256 ${c.bodyHash.slice(0, 16)}…` : undefined}>
          {draft && (
            <div className="mb-3 flex flex-wrap gap-2">
              {!customized
                ? <Button variant="outline" size="sm" onClick={() => { setC({ ...c, body: rendered }); setCustomized(true); }}><PenLine className="h-4 w-4" />Customize wording</Button>
                : <Button variant="ghost" size="sm" onClick={() => setCustomized(false)}><RotateCcw className="h-4 w-4" />Reset to blueprint</Button>}
            </div>
          )}
          {draft && customized
            ? <textarea aria-label="Contract text" rows={22} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} className="w-full rounded-xl border border-input bg-background p-4 font-mono text-sm leading-relaxed" />
            : <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-5 text-sm leading-relaxed">{body}</div>}
          <p className="mt-2 text-xs text-muted-foreground">{CONTRACT_DISCLAIMER}</p>
        </Step>

        {draft ? (
          <Step n={4} title="Save and request signatures">
            {!ready && (
              <ul className="mb-4 space-y-1 text-sm">
                {c.parties.length < 2 && <li>⚠️ Add at least two parties.</li>}
                {partyIssues.map((x) => <li key={x}>⚠️ {x}</li>)}
                {blanks.map((b) => <li key={b}>⚠️ Fill in {b.slice(1, -1)}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save draft</Button>
              <Button disabled={busy || !ready} onClick={() => void lockAndSend()}><Lock className="h-4 w-4" />Lock &amp; request signatures</Button>
              {c.id && <Button variant="ghost" className="ml-auto" disabled={busy} onClick={() => { if (confirm("Delete this draft?")) void deleteContract(c.id!).then(onClose); }}><Trash2 className="h-4 w-4" />Delete</Button>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Locking freezes the text and records its fingerprint, so nobody can change it after people start signing.</p>
          </Step>
        ) : (
          <Step title="Signatures">
            <ul className="space-y-3">
              {c.parties.map((p) => (
                <li key={p.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{p.legalName} <span className="text-sm font-normal text-muted-foreground">· {p.role}{p.isOwner ? " · you" : ""}</span></div>
                      <div className="text-xs text-muted-foreground">{p.signedAt ? `Signed ${new Date(p.signedAt).toLocaleString()}` : p.invitedAt ? `Request sent ${new Date(p.invitedAt).toLocaleDateString()}` : p.email}</div>
                    </div>
                    {p.signedAt ? <span className="flex items-center gap-1 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />Signed</span> : !p.isOwner && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(contractLink(p.id!)); toast.success("Signing link copied."); }}><Copy className="h-4 w-4" />Copy link</Button>
                        <Button size="sm" disabled={sending === p.id} onClick={() => void email(p)}>{sending === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{p.invitedAt ? "Resend" : "Email request"}</Button>
                      </div>
                    )}
                  </div>
                  {p.isOwner && !p.signedAt && c.status === "sent" && (
                    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                      <label className="min-w-60 flex-1 space-y-1 text-sm"><span className="font-medium">Type your legal name to sign: <span className="font-bold">{p.legalName}</span></span>
                        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={p.legalName} className="font-serif text-lg italic" /></label>
                      <Button disabled={busy} onClick={() => void signAsOwner(p)}><FileSignature className="h-4 w-4" />Sign</Button>
                    </div>
                  )}
                  {p.signatureHash && <p className="mt-2 break-all text-[11px] text-muted-foreground">Verification hash: {p.signatureHash}</p>}
                </li>
              ))}
            </ul>
            {c.status === "sent" && !c.parties.some((p) => p.signedAt) && (
              <Button variant="ghost" size="sm" className="mt-3" disabled={busy} onClick={() => void reopenContract(c.id!).then(refresh).catch((e: Error) => toast.error(e.message))}><Unlock className="h-4 w-4" />Unlock to edit (nobody has signed yet)</Button>
            )}
          </Step>
        )}
      </div>
    </TooltipProvider>
  );
}

function Step({ n, title, hint, children }: { n?: number | undefined; title: string; hint?: string | undefined; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        {n && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>}{title}
      </h3>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, tip, wide, children }: { label: string; tip: string; wide?: boolean | undefined; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center text-sm font-medium">
        {label}
        <InfoTip title={label} text={tip} />
      </span>
      {children}
    </div>
  );
}

function Locked({ text, onUpgrade }: { text: string; onUpgrade: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary p-8 text-center">
      <Lock className="h-8 w-8 text-primary" />
      <h2 className="text-2xl font-bold">Included with Catalog Management</h2>
      <p className="max-w-md text-muted-foreground">{text}</p>
      <Button onClick={onUpgrade}>Upgrade to unlock</Button>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 text-center">
      <Icon className="h-10 w-10 text-primary" />
      <p className="mt-3 max-w-md text-muted-foreground">{text}</p>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>;
}
