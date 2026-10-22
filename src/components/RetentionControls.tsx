import { useState } from "react";
import { CalendarClock, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmAction } from "@/components/ConfirmHost";
import { openCheckout } from "@/lib/checkout";
import { needMoreTime, resumeNow, setPlanCancelling } from "@/lib/retention.functions";
import { hasTier, TIER_LABEL, type Tier } from "@/lib/plans";
import { currentPause, extendedRenewal, offers, PAUSE_MONTHS, pauseSpan, renewalDate, VAULT_PRICE, type Lapse, type Pause, type PlanSub } from "@/lib/retention";

const longDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const money = (n: number) => `$${n.toFixed(2)}`;

type Props = { tier: Tier; sub: PlanSub | null; lapse: Lapse | null; pauses: Pause[]; onChanged: () => void };

/**
 * Profile's plan controls (PLAN-catalog-emptying §9–12): Need more time, Pause with the Vault fee, Resume now and
 * Cancel plan, which always shows the offers first. The server re-checks every rule.
 */
export function RetentionControls({ tier, sub, lapse, pauses, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const o = offers(sub, lapse, pauses);
  const pause = currentPause(pauses);
  const renews = sub ? renewalDate(sub) : null;

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await fn(); toast.success(done); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That didn't go through. Contact support and we'll help right away."); }
    finally { setBusy(false); }
  }

  async function extend() {
    const until = sub ? extendedRenewal(sub) : lapse ? new Date(new Date(lapse.empty_after).getTime() + 30 * 86_400_000) : null;
    if (!until || !(await confirmAction({ tone: "primary", action: "Give me 30 days", cancel: "Not now",
      title: sub ? `Move your renewal to ${longDate(until)}?` : `Keep your catalog until ${longDate(until)}?`,
      text: sub ? "30 more days with full access, free. Nothing is charged until then. Need more time can be used once every 12 months."
        : "Your catalog stays read-only for 30 more days, so you can download it or renew. Need more time can be used once every 12 months." }))) return;
    await act(() => needMoreTime(), sub ? `Your plan now renews on ${longDate(until)}.` : `Your catalog is kept until ${longDate(until)}.`);
  }

  async function resume() {
    if (!pause) return;
    const started = new Date(pause.starts_at) <= new Date();
    if (!(await confirmAction({ tone: "primary", action: "Resume now", cancel: "Stay paused",
      title: started ? "Resume your plan today?" : "Call off your pause?",
      text: started ? "Your plan renews today and the card on file is charged. The Vault fee isn't refunded." : `Your plan renews on its original date, ${longDate(pause.starts_at)}. The Vault fee isn't refunded.` }))) return;
    await act(() => resumeNow(), started ? "Welcome back. Your plan is renewing now." : "Pause called off.");
  }

  async function keep() { await act(() => setPlanCancelling({ data: { cancel: false } }), "Your plan will renew as usual."); }

  return (
    <>
      {pause && <p className="w-full rounded-lg border border-primary/40 bg-accent/30 p-3 text-sm">
        <PauseCircle className="mr-1 inline h-4 w-4 text-primary" />
        {new Date(pause.starts_at) > new Date() ? `Paused from ${longDate(pause.starts_at)} to ${longDate(pause.ends_at)}.` : `Paused until ${longDate(pause.ends_at)}.`}{" "}
        <span className="text-muted-foreground">Your catalog is read-only while paused.</span>
      </p>}
      {o.canExtend && <Button variant="outline" disabled={busy} onClick={() => void extend()}><CalendarClock />Need more time</Button>}
      {o.canPause && <Button variant="outline" disabled={busy} onClick={() => setPauseOpen(true)}><PauseCircle />Pause</Button>}
      {pause && <Button disabled={busy} onClick={() => void resume()}><PlayCircle />Resume now</Button>}
      {sub && !sub.cancel_at_period_end && !pause && <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}><XCircle />Cancel plan</Button>}
      {sub?.cancel_at_period_end && <Button variant="outline" disabled={busy} onClick={() => void keep()}>Keep my plan</Button>}
      {sub && !o.inWindow && !pause && renews && <p className="w-full text-xs text-muted-foreground">Need more time and Pause open 30 days before your renewal on {longDate(renews)}.</p>}

      <PauseDialog open={pauseOpen} onOpenChange={setPauseOpen} sub={sub} />
      <CancelPlanDialog open={cancelOpen} onOpenChange={setCancelOpen} tier={tier} sub={sub} offers={o}
        onExtend={() => { setCancelOpen(false); void extend(); }} onPause={() => { setCancelOpen(false); setPauseOpen(true); }}
        onCancelled={() => { setCancelOpen(false); onChanged(); }} />
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
        <p className="text-sm">Paused from <b>{longDate(span.starts)}</b> to <b>{longDate(span.ends)}</b>.{sub ? " Your plan then resumes and renews automatically. Resume now in Profile ends it early." : " After that, renew to keep your catalog."}</p>
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
