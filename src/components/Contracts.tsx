import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "@/components/ConfirmHost";
import { AlertTriangle, BookOpen, CalendarDays, Gift, Check, ChevronDown, ChevronLeft, Copy, Download, FileSignature, FlaskConical, Loader2, Lock, Mail, PenLine, Plus, RotateCcw, ScrollText, ShieldCheck, Trash2, Unlock, Vault } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UpgradeLock } from "@/components/UpgradeLock";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isValid, parse } from "date-fns";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { BLUEPRINTS, CATEGORIES, COMPANY_BLUEPRINTS, COMPANY_LEGAL_NAME, COMPANY_SIGNER_NAME, CONTRACT_DISCLAIMER, SIGNATURE_FONT, blueprintById, fillBlanks, georgiaLaw, initialFields, missingFields, renderContract, type Blueprint, type BlueprintField } from "@/lib/contract-blueprints";
import { downloadContractPdf } from "@/lib/contract-pdf";
import { myBrand } from "@/lib/brand-load";
import { loadWebFont } from "@/lib/web-fonts";
import { ContractGenerator } from "@/components/ContractGenerator";
import type { GeneratedDraft } from "@/lib/contract-generator";
import { sendContractInvite } from "@/lib/contracts-email.functions";
import { companySignLink } from "@/lib/contract-sign.functions";
import { grantLaunchGift, listLaunchGifts, type LaunchGiftRow } from "@/lib/launch-gift.functions";
import { grantLifetimeAccess, listBetaFeedback, listBetaTesters, type BetaFeedbackRow, type BetaTesterRow } from "@/lib/beta.functions";
import { BETA_ITEMS, BETA_WINDOW } from "@/lib/beta";
import { TIER_LABEL } from "@/lib/plans";
import { logBadgeEvent } from "@/lib/badge-events";
import { BLUEPRINT_GUIDES, CHEAT_SHEETS, type Guide } from "@/lib/guides";
import {
  contractLink, deleteContract, emptyParty, getContract, isValidEmail, listContracts, listReceivedContracts, loadCompanyTemplates, reopenContract, saveCompanyTemplate, saveContract, sendContract, signContract,
  type Contract, type ContractParty, type ReceivedContract,
} from "@/lib/contracts";

type View = "blueprints" | "guides" | "contracts" | "vault" | "gifts" | "beta";

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
export function Contracts({ userId, unlocked, onUpgrade, company = false }: { userId: string; unlocked: boolean; onUpgrade: () => void; /** Admin → Company Contracts: the LLC's own agreements and templates. */ company?: boolean }) {
  const [view, setView] = useState<View>("blueprints");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [received, setReceived] = useState<ReceivedContract[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  /** Company templates with any wording a super admin saved in place of the original. */
  const companyBlueprints = useMemo(() => COMPANY_BLUEPRINTS.map((bp) => templates[bp.id] ? { ...bp, body: georgiaLaw(templates[bp.id]!) } : bp), [templates]);
  const blueprintFor = (id: string) => (company ? companyBlueprints.find((b) => b.id === id) : undefined) ?? blueprintById(id);

  const load = async () => {
    setLoading(true);
    if (company) void loadCompanyTemplates().then(setTemplates).catch(() => {});
    // Everyone loads their own contracts: a $3.99 generated contract is theirs on any plan.
    const [c, r, t] = await Promise.allSettled([listContracts({ company }), company ? Promise.resolve([]) : listReceivedContracts(), company ? Promise.resolve([]) : listTracks()]);
    if (c.status === "fulfilled") setContracts(c.value);
    if (r.status === "fulfilled") setReceived(r.value);
    if (t.status === "fulfilled") setTracks(t.value);
    if (c.status === "rejected" || r.status === "rejected") toast.error("Could not load your contracts.");
    setLoading(false);
  };
  useEffect(() => { void load(); }, [unlocked]);
  // Back from paying for a generated contract: show My Contracts, where the webhook puts it within a few seconds.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (company || q.get("checkout") !== "success" || q.get("tab") !== "learn") return;
    setView("contracts");
    toast.success("Your contract is ready in My Contracts. It can take a few seconds to appear.");
    const t = setTimeout(() => void load(), 6000);
    return () => clearTimeout(t);
  }, []);

  /** A new contract from a blueprint; a Contract Generator draft adds the details and names it filled in. */
  const start = (bp: Blueprint, draft?: GeneratedDraft) => {
    if (!unlocked) { onUpgrade(); return; }
    setEditing({
      blueprint: bp.id, title: bp.name, catalogId: null, fields: { ...initialFields(bp), ...remembered(bp), ...draft?.fields }, body: "", status: "draft", bodyHash: "",
      sentAt: null, completedAt: null, updatedAt: new Date().toISOString(),
      // Company agreements: the founder's printed name is pre-filled for the Company block (3.9).
      parties: bp.roles.map((role, i) => ({ ...emptyParty(role, i === 0), legalName: draft?.parties[role] ?? (company && i === 0 ? COMPANY_SIGNER_NAME : "") })),
      ...(company && { isCompany: true }),
    });
  };

  if (editing) {
    return <ContractEditor userId={userId} initial={editing} tracks={tracks} blueprint={blueprintFor(editing.blueprint)} onClose={() => { setEditing(null); void load(); }} />;
  }

  const open = contracts.filter((c) => c.status !== "signed");
  const signed = contracts.filter((c) => c.status === "signed");

  return (
    <TooltipProvider delayDuration={100}>
      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Contracts">
            {(company
              ? [["blueprints", "Templates", ScrollText], ["contracts", "Drafts & out for signature", FileSignature], ["vault", "Signed", Vault], ["gifts", "Launch gifts", Gift], ["beta", "Beta testers", FlaskConical]] as const
              : [["blueprints", "Contracts", ScrollText], ["guides", "Blueprints", BookOpen], ["contracts", "My Contracts", FileSignature], ["vault", "Signed Vault", Vault]] as const).map(([id, label, Icon]) => (
              <Button key={id} role="tab" aria-selected={view === id} size="sm" variant={view === id ? "default" : "ghost"} onClick={() => setView(id)}>
                <Icon className="h-4 w-4" />{label}
                {id === "contracts" && open.length > 0 && <span className="ml-1 opacity-70">{open.length}</span>}
                {id === "vault" && signed.length + received.length > 0 && <span className="ml-1 opacity-70">{signed.length + received.length}</span>}
              </Button>
            ))}
          </div>
          {!unlocked && <Button size="sm" onClick={onUpgrade}><Lock className="h-4 w-4" />Unlock with Catalog Management</Button>}
        </div>

        {view === "blueprints" && <ContractGenerator blueprints={company ? companyBlueprints : BLUEPRINTS} unlocked={unlocked} company={company} onDraft={start} onUse={(bp) => start(bp)} />}

        {view === "blueprints" && (company
          ? <CompanyTemplates blueprints={companyBlueprints} edited={templates} onUse={start} onSaved={() => void loadCompanyTemplates().then(setTemplates)} />
          : <Blueprints unlocked={unlocked} onUse={start} />)}

        {view === "gifts" && company && <LaunchGifts />}
        {view === "beta" && company && <BetaTesters />}

        {view === "guides" && (!unlocked
          ? <UpgradeLock className="" title="Blueprints" tier="management" onUpgrade={onUpgrade} text="Step-by-step guides to running your music business, from royalty registration to touring, plus home recording cheat sheets for every genre." />
          : <Guides />)}

        {view === "contracts" && (!unlocked && !contracts.length ? (
          <Locked onUpgrade={onUpgrade} text="Build custom contracts from any blueprint, send them for e-signature and keep every signed copy in your vault. Or draft one with the Contract Generator for $3.99." />
        ) : loading ? <Spinner /> : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{company ? "Company agreements in progress and who still needs to sign. Start a new one from a template." : "Drafts and contracts waiting on signatures. Start a new one from any blueprint."}</p>
              <Button onClick={() => setView("blueprints")}><Plus className="h-4 w-4" />{unlocked ? "New contract" : "Generate a contract"}</Button>
            </div>
            {open.length === 0
              ? <Empty icon={FileSignature} text={company ? "No company agreements yet. Pick a template to send the first one." : "No contracts yet. Pick a blueprint to create your first one."} />
              : <ContractList contracts={open} onOpen={setEditing} />}
          </section>
        ))}

        {view === "vault" && (loading ? <Spinner /> : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{company ? "Signed company agreements" : "Your signed contracts"} <span className="opacity-70">{signed.length}</span></h3>
              {!unlocked && !signed.length ? <p className="text-sm text-muted-foreground">Contracts you create with Catalog Management or the Contract Generator are stored here once everyone signs.</p>
                : signed.length === 0 ? <p className="text-sm text-muted-foreground">Fully signed contracts are locked and stored here, ready to download.</p>
                : <ContractList contracts={signed} onOpen={setEditing} />}
            </section>
            {!company && <section className="rounded-2xl border border-border p-5">
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
            </section>}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

/** Details people tend to repeat (governing law, the admin's title) start as whatever this browser last signed with. */
const REMEMBER = ["governingLaw", "signerTitle"] as const;
function remembered(bp: Blueprint): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of REMEMBER) {
    if (!bp.fields.some((f) => f.key === key)) continue;
    try { const v = localStorage.getItem(`cta.contract.${key}`); if (v) out[key] = v; } catch { /* storage blocked */ }
  }
  return out;
}
function remember(fields: Record<string, string>) {
  for (const key of REMEMBER) {
    try { if (fields[key]?.trim()) localStorage.setItem(`cta.contract.${key}`, fields[key]!.trim()); } catch { /* storage blocked */ }
  }
}

/** The blueprint library: search, then one collapsible section per category (BRANDING §3). */
function Blueprints({ unlocked, onUse }: { unlocked: boolean; onUse: (bp: Blueprint) => void }) {
  const [openId, setOpenId] = useState<string>();
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const matches = (bp: Blueprint) => !q || `${bp.name} ${bp.summary} ${bp.category}`.toLowerCase().includes(q);
  const toggle = (cat: string) => setOpenCats((x) => { const n = new Set(x); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  return (
    <section className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{CONTRACT_DISCLAIMER}</p>
      <Input aria-label="Search contracts" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${BLUEPRINTS.length} contracts, e.g. "producer", "photo", "DJ"`} />
      {CATEGORIES.map((cat) => {
        const list = BLUEPRINTS.filter((bp) => bp.category === cat && matches(bp));
        if (!list.length) return null;
        const open = !!q || openCats.has(cat);
        return (
          <div key={cat} className="rounded-2xl border border-border">
            <button type="button" aria-expanded={open} onClick={() => toggle(cat)} className="flex w-full items-center gap-2 p-4 text-left">
              <span className="text-lg font-bold">{cat}</span>
              <span className="truncate text-sm text-muted-foreground">· {list.length} {list.length === 1 ? "contract" : "contracts"}</span>
              <ChevronDown className={`ml-auto h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
                {list.map((bp) => {
                  const expanded = openId === bp.id;
                  return (
                    <article key={bp.id} className={`flex flex-col rounded-2xl border p-5 transition ${expanded ? "border-primary" : "border-border hover:border-primary"}`}>
                      <h3 className="text-lg font-bold">{bp.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{bp.summary}</p>
                      {expanded && (
                        <div className="mt-4 space-y-3 text-sm">
                          <p><span className="font-semibold">When to use it: </span>{bp.whenToUse}</p>
                          <div>
                            <p className="font-semibold">Key terms to watch</p>
                            <ul className="mt-1 space-y-1">{bp.keyTerms.map((k) => <li key={k} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} /><span>{k}</span></li>)}</ul>
                          </div>
                          <p className="text-muted-foreground">Parties: {bp.roles.join(" and ")} · You fill in: {bp.fields.filter((f) => f.required).map((f) => f.label).join(", ") || "nothing, it's all filled in"}</p>
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        <Button size="sm" variant="ghost" onClick={() => { if (!expanded) logBadgeEvent("blueprint_read"); setOpenId(expanded ? undefined : bp.id); }}>{expanded ? "Hide guide" : "Read the guide"}</Button>
                        <Button size="sm" variant="outline" onClick={() => unlocked ? void myBrand("contracts").then((brand) => downloadContractPdf({ title: bp.name, body: renderContract(bp, { ...initialFields(bp), effectiveDate: "" }, []), parties: bp.roles.map((role) => ({ name: "", role, signedAt: null })), status: "draft", brand })) : onUse(bp)}>
                          {unlocked ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}Blank PDF
                        </Button>
                        <Button size="sm" onClick={() => onUse(bp)}>{unlocked ? <PenLine className="h-4 w-4" /> : <Lock className="h-4 w-4" />}Use this contract</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {q && !BLUEPRINTS.some(matches) && <p className="text-sm text-muted-foreground">No contract matches "{query}". Try another word, or start from the closest one and customize the wording.</p>}
    </section>
  );
}

/** Blueprints (business guides) and home recording cheat sheets, in two titled, collapsible groups. */
function Guides() {
  const [openId, setOpenId] = useState<string>();
  const [openGroup, setOpenGroup] = useState<string | undefined>("Blueprints");
  const groups: [string, string, Guide[]][] = [["Blueprints", "Step-by-step guides to running your music business", BLUEPRINT_GUIDES], ["Home recording cheat sheets", "Setup, genre tips and quick fixes", CHEAT_SHEETS]];
  return (
    <section className="space-y-4">
      {groups.map(([name, hint, list]) => {
        const open = openGroup === name;
        return (
          <div key={name} className="rounded-2xl border border-border">
            <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? undefined : name)} className="flex w-full items-center gap-2 p-4 text-left">
              <span className="text-lg font-bold">{name}</span>
              <span className="truncate text-sm text-muted-foreground">· {list.length} · {hint}</span>
              <ChevronDown className={`ml-auto h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
                {list.map((g) => {
                  const expanded = openId === g.id;
                  return (
                    <article key={g.id} className={`flex flex-col rounded-2xl border p-5 transition ${expanded ? "border-primary md:col-span-2" : "border-border hover:border-primary"}`}>
                      <h3 className="text-lg font-bold">{g.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>
                      {expanded && (
                        <div className="mt-4 space-y-4 text-sm">
                          <ol className="space-y-3">
                            {g.steps.map((st, i) => (
                              <li key={st.title} className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                                <span><span className="font-semibold">{st.title}. </span>{st.text}</span>
                              </li>
                            ))}
                          </ol>
                          {g.checklist && (
                            <div>
                              <p className="font-semibold">Checklist</p>
                              <ul className="mt-1 grid gap-1 sm:grid-cols-2">{g.checklist.map((k) => <li key={k} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} /><span>{k}</span></li>)}</ul>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-auto pt-4">
                        <Button size="sm" variant="ghost" onClick={() => { if (!expanded) logBadgeEvent("blueprint_read"); setOpenId(expanded ? undefined : g.id); }}>{expanded ? "Close" : "Read it"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => void import("@/lib/guide-pdf").then((m) => m.downloadGuidePdf(g)).catch(() => toast.error("Couldn't make the PDF. Try again."))}><Download />PDF</Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Admin: the free 3-month Catalog Plus promised in the testimonial release (§11). Lists everyone who fully signed a
 * release; grant it at launch. The server checks the release, the account and that it's granted only once.
 */
/**
 * Beta testers (Phase 4 item 3): signed Beta Tester Agreements with Grant lifetime access, then every item's results
 * from the /beta checklist (worked, didn't work, notes). Super admins only.
 */
function BetaTesters() {
  const list = useServerFn(listBetaTesters);
  const grant = useServerFn(grantLifetimeAccess);
  const feedback = useServerFn(listBetaFeedback);
  const [rows, setRows] = useState<BetaTesterRow[]>();
  const [results, setResults] = useState<BetaFeedbackRow[]>([]);
  const [busy, setBusy] = useState<string>();
  const load = () => Promise.all([
    list().then(setRows).catch((e: Error) => { toast.error(e.message); setRows([]); }),
    feedback().then(setResults).catch(() => setResults([])),
  ]);
  useEffect(() => { void load(); }, []);
  const give = async (r: BetaTesterRow) => {
    if (!await confirmAction({ title: `Give ${r.name} lifetime ${r.agreedTier}?`, text: `Free for life on the account for ${r.email}, as their Beta Tester Agreement says. We email them that it's active.`, action: "Grant lifetime access" })) return;
    setBusy(r.partyId);
    try { const { tier } = await grant({ data: { partyId: r.partyId } }); toast.success(`${r.name} has lifetime ${tier}.`); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't grant lifetime access."); }
    finally { setBusy(undefined); }
  };
  if (!rows) return <Spinner />;
  const byItem = BETA_ITEMS.map((i) => ({ item: i, rows: results.filter((r) => r.itemId === i.id) })).filter((x) => x.rows.length);
  return (
    <section className="space-y-6">
      <p className="text-sm text-muted-foreground">{BETA_WINDOW}. Send each tester the Beta Tester Agreement from Templates, then point them to <a href="/beta" className="font-semibold text-primary underline">/beta</a> for their checklist. Grant lifetime access once the beta is done.</p>
      {rows.length === 0 ? <Empty icon={FlaskConical} text="No fully signed Beta Tester Agreements yet." /> : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.partyId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0"><div className="truncate font-bold">{r.name}</div><div className="text-xs text-muted-foreground">{r.email} · agreed: {r.agreedTier}</div></div>
              {r.lifetime ? <Badge variant="outline" className="border-primary text-primary">Lifetime {r.lifetime}</Badge>
                : !r.hasAccount ? <span className="text-sm text-muted-foreground">No account with this email yet</span>
                : <Button size="sm" disabled={busy === r.partyId} onClick={() => void give(r)}>{busy === r.partyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}Grant lifetime access</Button>}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Checklist results</h3>
        {byItem.length === 0 ? <p className="text-sm text-muted-foreground">Results show here as testers mark items on /beta.</p> : (
          <ul className="grid gap-3">
            {byItem.map(({ item, rows: rs }) => {
              const broken = rs.filter((r) => r.result === "broken");
              return (
                <li key={item.id} className={`rounded-xl border p-4 ${broken.length ? "border-destructive" : "border-border"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{item.title} <span className="text-xs font-normal text-muted-foreground">· {TIER_LABEL[item.tier]}</span></span>
                    <span className="text-sm"><span className="text-primary">{rs.filter((r) => r.result === "worked").length} worked</span> · <span className={broken.length ? "font-semibold text-destructive" : "text-muted-foreground"}>{broken.length} didn't</span></span></div>
                  {rs.filter((r) => r.note).map((r, k) => <p key={k} className="mt-2 text-sm"><span className="font-semibold">{r.name || r.email}:</span> {r.note}</p>)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function LaunchGifts() {
  const list = useServerFn(listLaunchGifts);
  const grant = useServerFn(grantLaunchGift);
  const [rows, setRows] = useState<LaunchGiftRow[]>();
  const [busy, setBusy] = useState<string>();
  const load = () => list().then(setRows).catch((e: Error) => { toast.error(e.message); setRows([]); });
  useEffect(() => { void load(); }, []);
  const give = async (r: LaunchGiftRow) => {
    if (!await confirmAction({ title: `Start ${r.name}'s launch gift?`, text: `Catalog Plus, free for 3 months starting today, on the account for ${r.email}. We email them that it's active. It ends on its own.`, action: "Grant gift" })) return;
    setBusy(r.partyId);
    try { await grant({ data: { partyId: r.partyId } }); toast.success(`Launch gift started for ${r.name}.`); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't grant the gift."); }
    finally { setBusy(undefined); }
  };
  const date = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!rows) return <Spinner />;
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Everyone who fully signed a testimonial release gets 3 months of Catalog Plus free, starting on launch day (release §11). Grant each one on launch day. They need a free account with the email they signed with.</p>
      {rows.length === 0 ? <Empty icon={Gift} text="No fully signed testimonial releases yet." /> : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.partyId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <div className="truncate font-bold">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email} · signed {date(r.signedAt)} · {r.contractTitle}</div>
              </div>
              {r.giftEndsAt ? <Badge variant="outline" className="border-primary text-primary">Gift active · ends {date(r.giftEndsAt)}</Badge>
                : !r.hasAccount ? <span className="text-sm text-muted-foreground">No account with this email yet</span>
                : <Button size="sm" disabled={busy === r.partyId} onClick={() => void give(r)}>{busy === r.partyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}Grant launch gift</Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Admin: company templates. Each can be used as is, or its wording changed for every agreement sent from it later. */
function CompanyTemplates({ blueprints, edited, onUse, onSaved }: { blueprints: Blueprint[]; edited: Record<string, string>; onUse: (bp: Blueprint) => void; onSaved: () => void }) {
  const [editingId, setEditingId] = useState<string>();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const original = (id: string) => COMPANY_BLUEPRINTS.find((b) => b.id === id)!.body;
  const save = async (id: string, body: string) => {
    setBusy(true);
    try {
      await saveCompanyTemplate(id, body === original(id) ? "" : body);
      toast.success(body === original(id) ? "Template reset to the original wording." : "Template saved. New agreements from it use this wording.");
      setEditingId(undefined);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the template."); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{CONTRACT_DISCLAIMER}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {blueprints.map((bp) => (
          <article key={bp.id} className={`flex flex-col rounded-2xl border p-5 ${editingId === bp.id ? "border-primary md:col-span-2" : "border-border"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Company{edited[bp.id] ? " · your wording" : ""}</p>
            <h3 className="mt-1 text-lg font-bold">{bp.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{bp.summary}</p>
            {editingId === bp.id ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Change the terms for every agreement you send from this template from now on. Agreements already sent keep the wording they were signed with. Keep the <code>{"{{…}}"}</code> blanks: they fill in from the details and parties.</p>
                <textarea aria-label={`${bp.name} wording`} rows={22} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-input bg-background p-4 font-mono text-sm leading-relaxed" />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || !text.trim()} onClick={() => void save(bp.id, text)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save template</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setEditingId(undefined)}>Cancel</Button>
                  {edited[bp.id] && <Button variant="ghost" className="ml-auto" disabled={busy} onClick={async () => { if (await confirmAction({ title: "Go back to the original wording?", text: "Your changes to this template are removed. Agreements already sent don't change.", action: "Reset" })) void save(bp.id, original(bp.id)); }}><RotateCcw className="h-4 w-4" />Reset to original</Button>}
                </div>
              </div>
            ) : (
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="ghost" onClick={() => { setText(bp.body); setEditingId(bp.id); }}><PenLine className="h-4 w-4" />Edit terms</Button>
                <Button size="sm" variant="outline" onClick={() => void downloadContractPdf({ title: bp.name, body: renderContract(bp, { ...initialFields(bp), effectiveDate: "" }, []), parties: bp.roles.map((role) => ({ name: "", role, signedAt: null })), status: "draft" })}><Download className="h-4 w-4" />Blank PDF</Button>
                <Button size="sm" onClick={() => onUse(bp)}><FileSignature className="h-4 w-4" />Use this template</Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

const DATE_RANGES = [["7", "Last 7 days"], ["30", "Last 30 days"], ["365", "Last 12 months"], ["all", "Any date"]] as const;

/**
 * Contracts alphabetical by title, grouped by type, with filters for type, date and a search over names, signers and
 * emails (BRANDING.md §3; Admin → Company Contracts, 3.9). Specific choices come first, "All" last.
 */
function ContractList({ contracts, onOpen }: { contracts: Contract[]; onOpen: (c: Contract) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [range, setRange] = useState("all");
  const typeOf = (c: Contract) => blueprintById(c.blueprint)?.name ?? "Custom";
  const types = [...new Set(contracts.map(typeOf))].sort((a, b) => a.localeCompare(b));
  const needle = q.trim().toLowerCase();
  const since = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const shown = contracts
    .filter((c) => type === "all" || typeOf(c) === type)
    .filter((c) => !since || Date.parse(c.updatedAt) >= since)
    .filter((c) => !needle || [c.title, typeOf(c), ...c.parties.flatMap((p) => [p.legalName, p.email, p.role])].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => a.title.localeCompare(b.title));
  const groups = types.map((t) => [t, shown.filter((c) => typeOf(c) === t)] as const).filter(([, list]) => list.length);
  const select = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      {contracts.length > 3 && (
        <div className="flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, signer or email" aria-label="Search contracts" className="h-9 max-w-xs" />
          <select aria-label="Contract type" value={type} onChange={(e) => setType(e.target.value)} className={select}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}<option value="all">All types</option>
          </select>
          <select aria-label="Date" value={range} onChange={(e) => setRange(e.target.value)} className={select}>
            {DATE_RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}
      {groups.length === 0 ? <p className="text-sm text-muted-foreground">No contracts match. Try another search or filter.</p> : groups.map(([t, list]) => (
        <div key={t} className="space-y-2">
          {types.length > 1 && <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t} <span className="opacity-70">{list.length}</span></h4>}
          <ul className="grid gap-3">{list.map((c) => <ContractRow key={c.id} contract={c} onOpen={() => onOpen(c)} />)}</ul>
        </div>
      ))}
    </div>
  );
}

function ContractRow({ contract: c, onOpen }: { contract: Contract; onOpen: () => void }) {
  const done = c.parties.filter((p) => p.signedAt).length;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 transition hover:border-primary">
      <div className="min-w-0">
        <div className="truncate font-bold">{c.title}</div>
        <div className="text-xs text-muted-foreground">{blueprintById(c.blueprint)?.name ?? "Custom"} · {c.parties.map((p) => p.legalName || p.role).join(", ")} · {new Date(c.completedAt ?? c.updatedAt).toLocaleDateString()}</div>
      </div>
      <div className="flex items-center gap-2">
        {c.status !== "draft" && <span className="text-xs text-muted-foreground">{done}/{c.parties.length} signed</span>}
        <Badge variant="outline" className={STATUS[c.status].className}>{STATUS[c.status].label}</Badge>
        <Button size="sm" variant="outline" onClick={onOpen}>{c.status === "draft" ? "Edit" : "Open"}</Button>
      </div>
    </li>
  );
}

function ContractEditor({ userId, initial, tracks, blueprint, onClose }: { userId: string; initial: Contract; tracks: CatalogTrack[]; blueprint?: Blueprint | undefined; onClose: () => void }) {
  const bp = blueprint ?? blueprintById(initial.blueprint) ?? BLUEPRINTS[0]!;
  useEffect(() => { loadWebFont(SIGNATURE_FONT); }, []);
  const [c, setC] = useState<Contract>(initial);
  const [customized, setCustomized] = useState(!!initial.body && initial.body !== renderContract(bp, initial.fields, initial.parties));
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState({ email: "", legalName: "" });
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState<string>();
  const sendInvite = useServerFn(sendContractInvite);
  const privateLink = useServerFn(companySignLink);
  /** Company agreements are signed without an account, through a private link only the server can make. */
  const copyLink = async (p: ContractParty) => {
    try {
      const link = c.isCompany ? (await privateLink({ data: { partyId: p.id!, origin: window.location.origin } })).link : contractLink(p.id!);
      await navigator.clipboard.writeText(link);
      toast.success("Signing link copied.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't copy the link."); }
  };
  const draft = c.status === "draft";

  useEffect(() => {
    void Promise.all([supabase.from("profiles").select("legal_name").eq("id", userId).maybeSingle(), supabase.auth.getUser()]).then(([{ data }, { data: auth }]) => {
      const a = { email: auth.user?.email ?? "", legalName: data?.legal_name ?? "" };
      setAccount(a);
      // Company agreements may come from a department address, so a saved owner email is kept there.
      if (initial.status === "draft") setC((x) => ({ ...x, parties: x.parties.map((p) => p.isOwner ? { ...p, email: x.isCompany ? p.email || a.email : a.email, legalName: p.legalName || a.legalName } : p) }));
    });
  }, [userId]);

  const rendered = useMemo(() => renderContract(bp, c.fields, c.parties), [bp, c.fields, c.parties]);
  const body = customized ? fillBlanks(bp, c.body, c.fields, c.parties) : rendered;
  const owner = c.parties.find((p) => p.isOwner);
  /**
   * You sign in the app with your login email. On a company agreement sent from another (department) address, the
   * owner signs from the private link emailed there instead, like every other company signer.
   */
  const signsHere = !!owner && (!c.isCompany || owner.email.trim().toLowerCase() === account.email.toLowerCase());
  const others = c.parties.filter((p) => !p.isOwner || !signsHere);
  /** What still holds back signing: required details, and each party's legal name and email. Shown only when signing. */
  const missing: Missing[] = draft ? [
    ...missingFields(bp, c.fields).filter((f) => !customized || body.includes(`[${f.label}]`)).map((f) => ({ label: f.label, target: `cf-${f.key}`, section: "details" as const })),
    ...(c.parties.length < 2 ? [{ label: "A second person to sign", target: "cp-add", section: "parties" as const }] : []),
    ...c.parties.flatMap((p, i): Missing[] => [
      ...(!p.legalName.trim() ? [{ label: `${p.isOwner ? "Your" : `${p.role || `Party ${i + 1}`}'s`} legal name`, target: `cp-${i}-name`, section: "parties" as const }] : []),
      ...((!p.isOwner || c.isCompany) && !isValidEmail(p.email) ? [{ label: `${p.role || `Party ${i + 1}`}'s email`, target: `cp-${i}-email`, section: "parties" as const }] : []),
    ]),
  ] : [];
  const [sections, setSections] = useState({ details: true, parties: true, text: true });
  const [showMissing, setShowMissing] = useState(false);
  const goTo = (m: Missing) => {
    setShowMissing(false);
    setSections((x) => ({ ...x, [m.section]: true }));
    window.setTimeout(() => { const el = document.getElementById(m.target); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); }, 150);
  };
  const required = bp.fields.filter((f) => f.required);
  const filled = required.filter((f) => c.fields[f.key]?.trim()).length;

  const setField = (key: string, value: string) => setC((x) => ({ ...x, fields: { ...x.fields, [key]: value } }));
  const setParty = (i: number, patch: Partial<ContractParty>) => setC((x) => ({ ...x, parties: x.parties.map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  const markOwner = (i: number) => setC((x) => ({ ...x, parties: x.parties.map((p, idx) => idx === i
    ? { ...p, isOwner: true, email: account.email, legalName: p.legalName || account.legalName }
    : { ...p, isOwner: false, email: p.isOwner ? "" : p.email }) }));
  const pickSong = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    // A split agreement also takes the song's writers, by legal name, from My Catalog (read only).
    const splits = t && bp.fields.some((f) => f.key === "splits")
      ? t.metadata.writers.filter((w) => w.legalName?.trim()).map((w) => `${w.legalName!.trim()}${w.role ? ` (${w.role})` : ""}: ${w.percentage || "?"}%`).join("\n")
      : "";
    setC((x) => ({ ...x, catalogId: id || null, ...(t && { fields: { ...x.fields, songTitle: t.title, ...(splits && { splits }) }, title: `${bp.name} – ${t.title}` }) }));
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

  const refresh = async () => { const fresh = c.id ? await getContract(c.id) : null; if (fresh) setC(fresh); };

  /**
   * Signing happens at the bottom, after reading: it locks the text (frozen, with its SHA-256) and records your
   * signature. Sending to the others is a separate click afterwards, so nothing goes out by accident.
   */
  const signAndLock = async () => {
    if (missing.length) { setShowMissing(true); return; }
    if (signsHere && typed.trim().toLowerCase() !== owner!.legalName.trim().toLowerCase()) { toast.error(`Type your legal name exactly as listed: ${owner.legalName}`); return; }
    const saved = await save(true);
    if (!saved?.id) return;
    setBusy(true);
    try {
      await sendContract(saved.id);
      const me = signsHere ? saved.parties.find((p) => p.isOwner) : undefined;
      if (me?.id) await signContract(me.id, typed);
      remember(c.fields);
      setTyped("");
      const fresh = await getContract(saved.id);
      if (fresh) setC(fresh);
      toast.success(me ? "Signed. Now send it to the others." : owner ? `Locked. Send it, then sign from the email sent to ${owner.email}.` : "Locked. Now send it for signature.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not sign the contract."); await refresh(); }
    finally { setBusy(false); }
  };

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

  /** Emails everyone who hasn't been sent a request yet, in one click. */
  const unsent = c.status === "sent" ? others.filter((p) => !p.signedAt && !p.invitedAt) : [];
  const sendAll = async () => {
    setSending("all");
    let sent = 0;
    try {
      for (const p of unsent) {
        await sendInvite({ data: { partyId: p.id!, origin: window.location.origin } });
        sent++;
      }
      toast.success(sent === 1 ? `Sent to ${unsent[0]!.email}.` : `Sent to ${sent} people.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the email."); }
    finally { setSending(undefined); await refresh(); }
  };

  const signAsOwner = async (p: ContractParty) => {
    if (!p.id) return;
    if (typed.trim().toLowerCase() !== p.legalName.trim().toLowerCase()) { toast.error("Type your legal name exactly as listed."); return; }
    setBusy(true);
    try { await signContract(p.id, typed); setTyped(""); toast.success("Signed."); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not sign."); }
    finally { setBusy(false); }
  };

  // Company agreements keep the Came Through Audio header; the user's own contracts carry their brand kit (Catalog Management).
  const pdf = async () => downloadContractPdf({ title: c.title, body, bodyHash: c.bodyHash, status: c.status, brand: c.isCompany ? null : await myBrand("contracts"),
    company: c.isCompany ? { signerTitle: c.fields["signerTitle"] || "Founder & CEO" } : undefined,
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
          <ol aria-label="How it works" className="grid gap-2 rounded-xl bg-muted p-4 text-sm sm:grid-cols-5">
            {[["Read it", "Look over the contract below."], ["Fill in your details", "They fill into the contract as you type."], ["Adjust the wording", "Only if you need to; common terms are in."], ["Sign", "Sign at the bottom with your legal name."], ["Send", "Email each party a link to sign."]].map(([t, d], i) => (
              <li key={t} className="flex gap-2 sm:flex-col sm:gap-1">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span><span className="font-semibold">{t}.</span> <span className="text-muted-foreground">{d}</span></span>
              </li>
            ))}
          </ol>
        )}

        {draft && (
          <>
            <Step n={1} title="Details" open={sections.details} onToggle={() => setSections((x) => ({ ...x, details: !x.details }))}
              summary={required.length ? `${filled} of ${required.length} required filled${filled === required.length ? " ✓" : ""}` : "Nothing required · common terms already filled in ✓"}
              hint={required.length ? "Only the fields marked * are needed. Everything else is already filled in with common terms; change anything you like." : "Everything is already filled in with common terms. Change anything you like."}>
              <div className="grid gap-4 sm:grid-cols-2">
                {tracks.length > 0 && bp.fields.some((f) => f.key === "songTitle") && (
                  <Field label="Catalog song" tip="Pick a song from My Catalog to fill in its title.">
                    <select value={c.catalogId ?? ""} onChange={(e) => pickSong(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Not linked to a catalog song</option>
                      {[...tracks].sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </Field>
                )}
                {bp.fields.map((f) => (
                  <Field key={f.key} label={f.label} tip={f.tip} wide={f.multiline} required={f.required}>
                    {f.multiline
                      ? <textarea id={`cf-${f.key}`} rows={3} value={c.fields[f.key] ?? ""} placeholder={f.placeholder ?? f.fallback} onChange={(e) => setField(f.key, e.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
                      : f.date ? <DateInput id={`cf-${f.key}`} field={f} value={c.fields[f.key] ?? ""} onChange={(v) => setField(f.key, v)} />
                      : <Input id={`cf-${f.key}`} value={c.fields[f.key] ?? ""} placeholder={f.placeholder ?? f.fallback} onChange={(e) => setField(f.key, e.target.value)} />}
                  </Field>
                ))}
              </div>
            </Step>

            <Step n={2} title="Who's signing" open={sections.parties} onToggle={() => setSections((x) => ({ ...x, parties: !x.parties }))}
              summary={c.parties.map((p) => p.isOwner ? "You" : p.legalName.trim() || p.role).join(" + ")}
              hint="Use each person's legal name. Mark which one is you; you sign with your account email.">
              <div className="space-y-3">
                {c.parties.map((p, i) => (
                  <div key={p.id ?? i} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end ${p.isOwner ? "border-primary bg-primary/5" : "border-border"}`}>
                    <Field label="Role" tip="This party's role in the deal, for example Artist or Producer.">
                      <Input list={`roles-${bp.id}`} value={p.role} onChange={(e) => setParty(i, { role: e.target.value })} />
                    </Field>
                    <Field label="Legal name" tip="The person's or company's full legal name, exactly as it should appear on the contract." required>
                      <Input id={`cp-${i}-name`} value={p.legalName} onChange={(e) => setParty(i, { legalName: e.target.value })} placeholder="Full legal name" />
                    </Field>
                    <Field label="Email" tip={c.isCompany ? p.isOwner ? "Your email, or a department address such as registrations@camethroughaudio.com. If it isn't your login email, you sign from the link sent there." : "Where the signing link goes. They sign with a code emailed here; no account needed." : "Where the signature request goes. They sign by logging in with this email."} required={!p.isOwner || c.isCompany}>
                      <Input id={`cp-${i}-email`} type="email" value={p.email} disabled={p.isOwner && !c.isCompany} onChange={(e) => setParty(i, { email: e.target.value })} placeholder="name@example.com" />
                    </Field>
                    <div className="flex items-center gap-2 pb-1">
                      <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="owner" checked={p.isOwner} onChange={() => markOwner(i)} className="accent-[var(--primary)]" />Me</label>
                      {c.parties.length > 2 && <Button variant="ghost" size="icon" aria-label={`Remove ${p.role}`} onClick={() => setC({ ...c, parties: c.parties.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
                <datalist id={`roles-${bp.id}`}>{bp.roles.map((r) => <option key={r} value={r} />)}</datalist>
                <Button id="cp-add" variant="outline" size="sm" onClick={() => setC({ ...c, parties: [...c.parties, emptyParty(bp.roles[1])] })}><Plus className="h-4 w-4" />Add party</Button>
              </div>
            </Step>
          </>
        )}

        <Step n={draft ? 3 : undefined} title={draft ? "Read it over, then sign" : "Contract text"} open={sections.text} onToggle={() => setSections((x) => ({ ...x, text: !x.text }))}
          summary="Fills in as you type" hint={draft ? "Fills in as you type. Read it all the way through; your signature goes at the bottom." : c.bodyHash ? `Locked · SHA-256 ${c.bodyHash.slice(0, 16)}…` : undefined}>
          {draft && (
            <div className="mb-3 flex flex-wrap gap-2">
              {!customized
                ? <Button variant="outline" size="sm" onClick={() => { setC({ ...c, body: rendered }); setCustomized(true); }}><PenLine className="h-4 w-4" />Customize wording</Button>
                : <Button variant="ghost" size="sm" onClick={() => setCustomized(false)}><RotateCcw className="h-4 w-4" />Reset to blueprint</Button>}
            </div>
          )}
          {draft && customized
            ? <textarea aria-label="Contract text" rows={22} value={body} onChange={(e) => setC({ ...c, body: e.target.value })} className="w-full rounded-xl border border-input bg-background p-4 font-mono text-sm leading-relaxed" />
            : <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-5 text-sm leading-relaxed">{body}</div>}

          {draft && (
            <div className="mt-5 border-t border-border pt-5">
              {owner && !signsHere ? <p className="text-sm text-muted-foreground">You'll sign from the link emailed to <span className="font-semibold text-foreground">{owner.email || "your department address"}</span> once it's locked and sent.</p>
                : owner ? (
                c.isCompany ? (
                  // Company Name / By / Printed Name / Title, signed right before sending (3.9).
                  <dl className="grid max-w-xl grid-cols-[8rem_1fr] items-center gap-x-3 gap-y-2 rounded-xl border border-border p-4 text-sm">
                    <dt className="font-semibold text-muted-foreground">Company Name</dt><dd>{COMPANY_LEGAL_NAME}</dd>
                    <dt className="font-semibold text-muted-foreground"><label htmlFor="company-sign">By</label></dt>
                    <dd><Input id="company-sign" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={owner.legalName || "Type your legal name to sign"} className="text-2xl" style={{ fontFamily: `"${SIGNATURE_FONT}", cursive` }} /></dd>
                    <dt className="font-semibold text-muted-foreground">Printed Name</dt><dd>{owner.legalName || "Add your legal name in Parties"}</dd>
                    <dt className="font-semibold text-muted-foreground">Title</dt><dd>{c.fields["signerTitle"] || "Founder & CEO"}</dd>
                  </dl>
                ) : (
                <label className="block space-y-1 text-sm"><span className="font-medium">Type your legal name to sign{owner.legalName.trim() && <>: <span className="font-bold">{owner.legalName}</span></>}</span>
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={owner.legalName || "Your legal name"} className="max-w-md text-2xl" style={{ fontFamily: `"${SIGNATURE_FONT}", cursive` }} /></label>)
              ) : <p className="text-sm text-muted-foreground">You're not signing this one. Lock it, then send it to everyone who signs.</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button disabled={busy} onClick={() => void signAndLock()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}{signsHere ? "Sign" : "Lock"}</Button>
                <Button variant="outline" disabled={busy} onClick={() => void save()}><Check className="h-4 w-4" />Save draft</Button>
                {c.id && <Button variant="ghost" className="ml-auto" disabled={busy} onClick={async () => { if (await confirmAction({ title: "Delete this draft?" })) void deleteContract(c.id!).then(onClose); }}><Trash2 className="h-4 w-4" />Delete</Button>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Signing locks the wording and records its fingerprint, so nobody can change it after you sign. You'll send it to the others next.</p>
            </div>
          )}
        </Step>

        {!draft && (
          <Step title="Signatures">
            {unsent.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-primary/5 p-4">
                <p className="text-sm"><span className="font-semibold">Ready to send.</span> {unsent.map((p) => p.legalName).join(", ")} {unsent.length === 1 ? "gets" : "get"} an email to review and sign.</p>
                <Button disabled={!!sending} onClick={() => void sendAll()}>{sending === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Send{unsent.length > 1 ? ` to all ${unsent.length}` : ""}</Button>
              </div>
            )}
            <ul className="space-y-3">
              {c.parties.map((p) => (
                <li key={p.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{p.legalName} <span className="text-sm font-normal text-muted-foreground">· {p.role}{p.isOwner ? " · you" : ""}</span></div>
                      <div className="text-xs text-muted-foreground">{p.signedAt ? `Signed ${new Date(p.signedAt).toLocaleString()}` : p.invitedAt ? `Request sent ${new Date(p.invitedAt).toLocaleDateString()}` : p.email}</div>
                    </div>
                    {p.signedAt ? <span className="flex items-center gap-1 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />Signed</span> : (!p.isOwner || !signsHere) && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => void copyLink(p)}><Copy className="h-4 w-4" />Copy link</Button>
                        <Button size="sm" disabled={sending === p.id} onClick={() => void email(p)}>{sending === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{p.invitedAt ? "Resend" : "Email request"}</Button>
                      </div>
                    )}
                  </div>
                  {p.isOwner && signsHere && !p.signedAt && c.status === "sent" && (
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

      <Dialog open={showMissing} onOpenChange={setShowMissing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Almost there: {missing.length} {missing.length === 1 ? "thing" : "things"} to add</DialogTitle>
            <DialogDescription>Everything else is optional.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {missing.map((m) => (
              <li key={m.target} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{m.label}</span>
                <Button size="sm" variant="ghost" className="text-primary" onClick={() => goTo(m)}>Take me there →</Button>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => setShowMissing(false)}>Keep editing</Button>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

type Missing = { label: string; target: string; section: "details" | "parties" };

/** A titled editor section. With onToggle it collapses to its title and a one-line summary (BRANDING §3). */
function Step({ n, title, hint, summary, open = true, onToggle, children }: { n?: number | undefined; title: string; hint?: string | undefined; summary?: string; open?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  const heading = <>{n && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>}{title}</>;
  return (
    <section className="rounded-2xl border border-border p-5">
      {onToggle ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-2 text-left text-lg font-bold">
          {heading}
          {!open && summary && <span className="ml-1 truncate text-sm font-normal text-muted-foreground">· {summary}</span>}
          <ChevronDown className={`ml-auto h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
        </button>
      ) : <h3 className="flex items-center gap-2 text-lg font-bold">{heading}</h3>}
      {open && <>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        <div className="mt-4">{children}</div>
      </>}
    </section>
  );
}

const DATE_FORMAT = "MMMM d, yyyy";

/** A date field with a calendar beside it. Typing still works, for wording like "Within 6 months of delivery". */
function DateInput({ id, field, value, onChange }: { id?: string; field: BlueprintField; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const many = field.date === "many";
  const last = value.split(";").pop()?.trim() ?? "";
  const shown = parse(last, DATE_FORMAT, new Date());
  const pick = (d: Date | undefined) => {
    if (!d) return;
    const text = format(d, DATE_FORMAT);
    onChange(many && value.trim() && !value.includes(text) ? `${value.trim()}; ${text}` : text);
    if (!many) setOpen(false);
  };
  return (
    <div className="flex gap-2">
      <Input id={id} value={value} placeholder={field.placeholder ?? field.fallback} onChange={(e) => onChange(e.target.value)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={`Pick ${field.label.toLowerCase()} on a calendar`}><CalendarDays className="h-4 w-4" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" captionLayout="dropdown" {...(isValid(shown) && { selected: shown, defaultMonth: shown })} onSelect={pick} />
          {many && <p className="max-w-64 px-3 pb-3 text-xs text-muted-foreground">Pick each date; they're added to the list.</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A labelled form field. Required ones get a * and nothing else: cautions only appear when signing. */
function Field({ label, tip, wide, required, children }: { label: string; tip: string; wide?: boolean | undefined; required?: boolean | undefined; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center text-sm font-medium">
        {label}{required && <span className="ml-0.5 text-primary" aria-label="required">*</span>}
        <InfoTip title={label} text={tip} />
      </span>
      {children}
    </div>
  );
}

function Locked({ text, onUpgrade }: { text: string; onUpgrade: () => void }) {
  return <UpgradeLock className="" title="Custom contracts" tier="management" onUpgrade={onUpgrade} text={text} />;
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
