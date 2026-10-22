import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, CreditCard, PauseCircle, PlayCircle, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmAction } from "@/components/ConfirmHost";
import { openBilling, openCheckout } from "@/lib/checkout";
import { needMoreTime, resumeNow, setPlanCancelling } from "@/lib/retention.functions";
import { hasTier, PLAN_TIERS, TIER_LABEL, type Tier } from "@/lib/plans";
import { canRenewEarly, currentPause, earlyRenewalTarget, extendedRenewal, inGrace, offers, renewalDate, PAUSE_MONTHS, pauseSpan, VAULT_PRICE, type Lapse, type Pause, type PlanSub } from "@/lib/retention";

const longDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const money = (n: number) => `$${n.toFixed(2)}`;

type Account = { sub: PlanSub | null; lapse: Lapse | null; pauses: Pause[]; onChanged: () => void };

/**
 * Need more time, Pause and Resume, shared by Profile and the workspace banner. They're plan B (PLAN-catalog-emptying
 * §9–12): offered when someone tries to cancel, when a renewal payment fails, and in the countdown after a plan ends.
 * The server re-checks every rule.
 */
function useRetention({ sub, lapse, pauses, onChanged }: Account) {
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const o = offers(sub, lapse, pauses);
  const pause = currentPause(pauses);

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await fn(); toast.success(done); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That didn't go through. Contact support and we'll help right away."); }
    finally { setBusy(false); }
  }

  async function extend() {
    const until = sub?.stripe_subscription_id ? extendedRenewal(sub) : lapse ? new Date(new Date(lapse.empty_after).getTime() + 30 * 86_400_000) : null;
    const plan = !!sub?.stripe_subscription_id;
    if (!until || !(await confirmAction({ tone: "primary", action: "Give me 30 days", cancel: "Not now",
      title: plan ? `Move your renewal to ${longDate(until)}?` : `Keep your catalog until ${longDate(until)}?`,
      text: plan ? "30 more days with full access, free. Nothing is charged until then. Need more time can be used once every 12 months."
        : "Your catalog stays read-only for 30 more days, so you can download it or renew. Need more time can be used once every 12 months." }))) return;
    await act(() => needMoreTime(), plan ? `Your plan now renews on ${longDate(until)}.` : `Your catalog is kept until ${longDate(until)}.`);
  }

  async function resume() {
    if (!pause) return;
    const started = new Date(pause.starts_at) <= new Date();
    if (!(await confirmAction({ tone: "primary", action: "Resume now", cancel: "Stay paused",
      title: started ? "Resume your plan today?" : "Call off your pause?",
      text: started ? "Your plan renews today and the card on file is charged. The Vault fee isn't refunded." : `Your plan renews on its original date, ${longDate(pause.starts_at)}. The Vault fee isn't refunded.` }))) return;
    await act(() => resumeNow(), started ? "Welcome back. Your plan is renewing now." : "Pause called off.");
  }

  async function updateCard() {
    try { await openBilling(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Billing couldn't open. Contact support and we'll help right away."); }
  }

  const pauseDialog = <PauseDialog open={pauseOpen} onOpenChange={setPauseOpen} sub={sub} />;
  return { o, pause, busy, act, extend, resume, updateCard, openPause: () => setPauseOpen(true), pauseDialog };
}

/** Plan B buttons: Need more time and Pause, when they're available. */
function OfferButtons({ r }: { r: ReturnType<typeof useRetention> }) {
  return <>
    {r.o.canExtend && <Button variant="outline" disabled={r.busy} onClick={() => void r.extend()}><CalendarClock />Need more time</Button>}
    {r.o.canPause && <Button variant="outline" disabled={r.busy} onClick={r.openPause}><PauseCircle />Pause</Button>}
  </>;
}

/** While a renewal payment is failing: Update card first, then Need more time and Pause. */
function FailingNotice({ r, children }: { r: ReturnType<typeof useRetention>; children?: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border-2 border-primary bg-card p-4">
      <TriangleAlert className="h-6 w-6 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Your renewal payment didn't go through.</span>{" "}
        <span className="text-muted-foreground">Update your card to keep your plan. You keep full access while Stripe retries. Need a little longer? Move your renewal back 30 days, or pause.</span></p>
      <Button disabled={r.busy} onClick={() => void r.updateCard()}><CreditCard />Update card</Button>
      <OfferButtons r={r} />
      {children}
    </div>
  );
}

/** The workspace banner for a failing renewal. */
export function FailedRenewalBanner(props: Account) {
  const r = useRetention(props);
  if (!r.o.failing) return null;
  return <div className="mb-6"><FailingNotice r={r}>{r.pauseDialog}</FailingNotice></div>;
}

/** The workspace's grace-period offers (after a plan has ended, before the catalog is emptied). */
export function GraceOffers(props: Account) {
  const r = useRetention(props);
  if (!inGrace(props.lapse) || props.sub?.stripe_subscription_id) return null;
  return <><OfferButtons r={r} />{r.pauseDialog}</>;
}

/**
 * Profile's plan controls: the failing-renewal notice, the countdown offers, Resume now, and Cancel plan, which
 * always shows the offers before cancelling.
 */
export function RetentionControls({ tier, ...account }: Account & { tier: Tier }) {
  const r = useRetention(account);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { sub, lapse } = account;
  const pause = r.pause;
  const ended = !sub?.stripe_subscription_id && inGrace(lapse);
  const renewable = canRenewEarly(sub, account.pauses);

  /** Renew now: pay next year early; the plan then runs a full year past the current renewal date. */
  async function renewNow() {
    const renews = sub && renewalDate(sub);
    const price = PLAN_TIERS.find((p) => p.tier === tier)?.price;
    if (!renews || !price) return;
    if (!(await confirmAction({ tone: "primary", action: `Pay ${price} and renew`, cancel: "Not now",
      title: `Renew ${TIER_LABEL[tier]} now?`,
      text: `You'll pay ${price} today (plus tax where it applies) for your next year. You keep the time you have left, so your plan runs until ${longDate(earlyRenewalTarget(renews))}, with nothing charged on ${longDate(renews)}. Refundable within 30 days of today.` }))) return;
    try { await openCheckout({ kind: "renew" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open. Contact support and we'll help right away."); }
  }
  // The renewal reminder emails link here with ?renew=1.
  useEffect(() => {
    if (!renewable || new URLSearchParams(window.location.search).get("renew") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    void renewNow();
  }, [renewable]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {r.o.failing && <FailingNotice r={r} />}
      {pause && <p className="w-full rounded-lg border border-primary/40 bg-accent/30 p-3 text-sm">
        <PauseCircle className="mr-1 inline h-4 w-4 text-primary" />
        {new Date(pause.starts_at) > new Date() ? `Paused from ${longDate(pause.starts_at)} to ${longDate(pause.ends_at)}.` : `Paused until ${longDate(pause.ends_at)}.`}{" "}
        <span className="text-muted-foreground">Your catalog is read-only while paused.</span>
      </p>}
      {ended && <>
        <p className="w-full text-sm text-muted-foreground">Your plan ended. Your catalog will be emptied on {longDate(lapse!.empty_after)} unless you renew.</p>
        <OfferButtons r={r} />
      </>}
      {renewable && <Button variant="outline" disabled={r.busy} onClick={() => void renewNow()}><RefreshCw />Renew now</Button>}
      {pause && <Button disabled={r.busy} onClick={() => void r.resume()}><PlayCircle />Resume now</Button>}
      {sub?.stripe_subscription_id && !sub.cancel_at_period_end && !pause && <Button variant="ghost" disabled={r.busy} onClick={() => setCancelOpen(true)}><XCircle />Cancel plan</Button>}
      {sub?.cancel_at_period_end && <Button variant="outline" disabled={r.busy} onClick={() => void r.act(() => setPlanCancelling({ data: { cancel: false } }), "Your plan will renew as usual.")}>Keep my plan</Button>}

      {r.pauseDialog}
      <CancelPlanDialog open={cancelOpen} onOpenChange={setCancelOpen} tier={tier} sub={sub} offers={r.o}
        onExtend={() => { setCancelOpen(false); void r.extend(); }} onPause={() => { setCancelOpen(false); r.openPause(); }}
        onCancelled={() => { setCancelOpen(false); account.onChanged(); }} />
    </>
  );
}

/** Pick 1, 2 or 3 months; the Vault fee ($1.99 a month) is paid up front at checkout. */
function PauseDialog({ open, onOpenChange, sub }: { open: boolean; onOpenChange: (o: boolean) => void; sub: PlanSub | null }) {
  const [months, setMonths] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const span = pauseSpan(sub, months);
  async function pay() {
    setBusy(true);
    try { onOpenChange(false); await openCheckout({ kind: "vault", months }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Checkout could not open. Contact support and we'll help right away."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause your plan</DialogTitle>
          <DialogDescription>No plan charge while you're paused. Your catalog is kept safe and read-only: view and download, no adding or editing. Nothing is emptied.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="How long" className="grid grid-cols-3 gap-2">
          {PAUSE_MONTHS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
              className={`rounded-xl border p-3 text-center ${months === m ? "border-2 border-primary bg-accent/30" : "border-border hover:border-primary"}`}>
              <div className="text-lg font-bold">{m} month{m === 1 ? "" : "s"}</div>
              <div className="text-sm text-muted-foreground">{money(VAULT_PRICE * m)}</div>
            </button>
          ))}
        </div>
        <p className="text-sm">Paused from <b>{longDate(span.starts)}</b> to <b>{longDate(span.ends)}</b>.{sub?.stripe_subscription_id ? " Your plan then resumes and renews automatically. Resume now in Profile ends it early." : " After that, renew to keep your catalog."}</p>
        <p className="text-xs text-muted-foreground">Vault fee: {money(VAULT_PRICE)} per month, paid up front. Not refundable once the pause starts. Pause can be used once every 12 months.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button disabled={busy} onClick={() => void pay()}>Pay {money(VAULT_PRICE * months)} and pause</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Before cancelling: Need more time, Pause, a cheaper plan, then Cancel anyway. Offers not available right now are left out. */
function CancelPlanDialog({ open, onOpenChange, tier, sub, offers: o, onExtend, onPause, onCancelled }: {
  open: boolean; onOpenChange: (o: boolean) => void; tier: Tier; sub: PlanSub | null; offers: ReturnType<typeof offers>;
  onExtend: () => void; onPause: () => void; onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const ends = sub?.current_period_end;
  async function switchToPlus() {
    setBusy(true);
    try { await openCheckout({ kind: "plan", priceId: "catalog_plus_yearly" }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Plans couldn't open. Contact support and we'll help right away."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try {
      await setPlanCancelling({ data: { cancel: true } });
      toast.success(ends ? `Cancelled. You keep full access until ${longDate(ends)}.` : "Cancelled.");
      onCancelled();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Cancelling didn't go through. Contact support and we'll help right away."); }
    finally { setBusy(false); }
  }
  const offer = (title: string, text: string, label: string, onClick: () => void) => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
      <div className="min-w-0 flex-1"><div className="font-semibold">{title}</div><div className="text-sm text-muted-foreground">{text}</div></div>
      <Button disabled={busy} onClick={onClick}>{label}</Button>
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Before you go</DialogTitle>
          <DialogDescription>{ends ? `If you cancel, you keep full access until ${longDate(ends)}. Then your catalog stays read-only for 30 days so you can download it, and is emptied after that.` : "If you cancel, your catalog stays read-only for 30 days after your plan ends, then it's emptied."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {o.canExtend && offer("Need more time?", "Move your renewal back 30 days, free, with full access.", "Get 30 days", onExtend)}
          {o.canPause && offer("Take a break", `Pause for 1 to 3 months. No plan charge, catalog kept safe. Vault fee ${money(VAULT_PRICE)} a month.`, "Pause", onPause)}
          {hasTier(tier, "collaborate") && offer(`Switch to ${TIER_LABEL.plus}`, "Keep your catalog, embedding and split sheets for $24.99 a year.", "Switch", () => void switchToPlus())}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep my plan</Button>
          <Button variant="ghost" disabled={busy} onClick={() => void cancel()} className="text-destructive">Cancel anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
