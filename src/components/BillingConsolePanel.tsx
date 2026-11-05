import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REFUND_REASON_LABEL, REFUND_REASONS, dollarsToCents, formatUsd, type RefundReason } from "@/lib/billing-console";
import {
  latestPlanCharge, listBillingActions, lookupBillingMember, purchasePaymentInfo, refundLatestPlanCharge, refundPurchase,
  setSubscriptionCancellation,
  type BillingMember, type BillingPurchase, type BillingSubscription, type PaymentInfo, type PlanChargeInfo,
} from "@/lib/billing.functions";

const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't go through.");
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/** Amount, reason and a note, then the one button that actually moves money. */
function RefundBox({ maxCents, needsNote, busy, onCancel, onConfirm }: {
  maxCents: number;
  needsNote: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (cents: number, reason: RefundReason, note: string) => void;
}) {
  const [dollars, setDollars] = useState((maxCents / 100).toFixed(2));
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [note, setNote] = useState("");
  const cents = dollarsToCents(dollars);
  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-muted-foreground">Amount (USD)
          <Input className="mt-1" value={dollars} inputMode="decimal" onChange={(e) => setDollars(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Why
          <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REFUND_REASONS.map((r) => <SelectItem key={r} value={r}>{REFUND_REASON_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Note for the log
          <Input className="mt-1" value={note} placeholder="What they asked for" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Most you can refund here: <b>{formatUsd(maxCents)}</b> — the payment is the ceiling, there is no fixed cap.
        {needsNote ? " This one is past 30 days, so the note is required: a refund is cheaper than a dispute." : " The card is refunded in Stripe; nothing else is typed there."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy || cents === null || (needsNote && !note.trim())} onClick={() => { if (cents) onConfirm(cents, reason, note); }}>
          {busy ? "Refunding…" : cents === null ? "Enter an amount" : `Refund ${formatUsd(cents)}`}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function PurchaseRow({ purchase, member, onDone }: { purchase: BillingPurchase; member: BillingMember; onDone: () => void }) {
  const info = useServerFn(purchasePaymentInfo);
  const refund = useServerFn(refundPurchase);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try { setPayment(await info({ data: { purchaseId: purchase.id } })); } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  async function confirm(cents: number, reason: RefundReason, note: string) {
    setBusy(true);
    try {
      await refund({ data: { purchaseId: purchase.id, amountCents: cents, reason, note: note || undefined, requestId: crypto.randomUUID() } });
      toast.success(`${formatUsd(cents)} refunded to ${member.email}.`);
      setPayment(null);
      onDone();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{purchase.label}</p>
          <p className="text-xs text-muted-foreground">
            {day(purchase.createdAt)}
            {purchase.refundedAt ? " · refunded in full" : purchase.windowDaysLeft > 0 ? ` · ${purchase.windowDaysLeft} day${purchase.windowDaysLeft === 1 ? "" : "s"} of the refund window left` : " · past 30 days, a note is needed"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {purchase.refundedAt ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Refunded</span>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void open()}><Undo2 /> Refund…</Button>
          )}
        </div>
      </div>
      {payment && (
        <RefundBox
          maxCents={Math.max(0, payment.paidCents - payment.refundedCents)}
          needsNote={payment.windowDaysLeft <= 0}
          busy={busy}
          onCancel={() => setPayment(null)}
          onConfirm={(cents, reason, note) => void confirm(cents, reason, note)}
        />
      )}
    </li>
  );
}

function SubscriptionRow({ sub, onDone }: { sub: BillingSubscription; onDone: () => void }) {
  const preview = useServerFn(latestPlanCharge);
  const refund = useServerFn(refundLatestPlanCharge);
  const cancel = useServerFn(setSubscriptionCancellation);
  const [charge, setCharge] = useState<PlanChargeInfo | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await cancel({ data: { subscriptionId: sub.id, cancel: next, requestId: crypto.randomUUID() } });
      toast.success(next ? "The plan stops at its renewal date. They keep it until then." : "The plan renews again.");
      onDone();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  async function openRefund() {
    setBusy(true);
    try { setCharge(await preview({ data: { subscriptionId: sub.id } })); } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  async function confirmRefund(cents: number, reason: RefundReason, note: string) {
    setBusy(true);
    try {
      await refund({ data: { subscriptionId: sub.id, amountCents: cents, reason, note: note || undefined, requestId: crypto.randomUUID() } });
      toast.success(`${formatUsd(cents)} refunded on the last charge.`);
      setCharge(null);
      onDone();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{sub.tier}</p>
          <p className="text-xs text-muted-foreground">
            {sub.status.replace(/_/g, " ")} · {sub.cancelAtPeriodEnd ? `stops ${day(sub.currentPeriodEnd)}` : `renews ${day(sub.currentPeriodEnd)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void openRefund()}>Refund last charge…</Button>
          <Button size="sm" variant={sub.cancelAtPeriodEnd ? "default" : "outline"} disabled={busy} onClick={() => void toggle(!sub.cancelAtPeriodEnd)}>
            {sub.cancelAtPeriodEnd ? "Keep it renewing" : "Stop at renewal"}
          </Button>
        </div>
      </div>
      {charge && (
        <RefundBox
          maxCents={Math.max(0, charge.paidCents - charge.refundedCents)}
          needsNote={charge.windowDaysLeft <= 0}
          busy={busy}
          onCancel={() => setCharge(null)}
          onConfirm={(cents, reason, note) => void confirmRefund(cents, reason, note)}
        />
      )}
    </li>
  );
}

/**
 * Admin → Billing (founder, 2026-11-05): Finance and super admins look a member up by email, refund a payment or stop a
 * plan from renewing, without anyone logging into Stripe. Every action lands in the log at the bottom.
 */
export function BillingConsolePanel({ isSuper }: { isSuper: boolean }) {
  const lookup = useServerFn(lookupBillingMember);
  const listActions = useServerFn(listBillingActions);
  const qc = useQueryClient();
  const log = useQuery({ queryKey: ["billing-actions"], queryFn: () => listActions(), refetchOnWindowFocus: false });
  const [email, setEmail] = useState("");
  const [member, setMember] = useState<BillingMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setSearched(true);
    try {
      setMember(await lookup({ data: { email: email.trim() } }));
    } catch (err) {
      setMember(null);
      toast.error(msg(err));
    } finally { setBusy(false); }
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["billing-actions"] });
    if (member) {
      try { setMember(await lookup({ data: { email: member.email } })); } catch { /* keep what's on screen */ }
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Billing without Stripe</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Look a member up by the email they paid with, then refund a charge or stop a plan from renewing. The card is
          refunded through our Stripe key; nobody needs a dashboard login, and every action below is logged. Refund up to
          what they paid, with no fixed ceiling. Past 30 days it still goes through but needs a note, because a dispute
          costs more than the refund.
          {isSuper ? " As founder, every refund is yours to approve." : ""}
        </p>
        <form onSubmit={(e) => void search(e)} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1 text-xs font-semibold text-muted-foreground">Member's email
            <Input className="mt-1" value={email} placeholder="them@example.com" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button type="submit" disabled={busy || !email.trim()}><Search /> {busy ? "Looking…" : "Find member"}</Button>
        </form>
      </section>

      {searched && !member && !busy && (
        <p className="text-sm text-muted-foreground">No account with that email. Try the address on the receipt.</p>
      )}

      {member && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{member.name}</h3>
              <p className="text-sm text-muted-foreground">{member.email}{member.confirmed ? "" : " · email not confirmed"}</p>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {member.subscriptions.length} plan{member.subscriptions.length === 1 ? "" : "s"} · {member.purchases.length} purchase{member.purchases.length === 1 ? "" : "s"}
            </span>
          </div>

          <h4 className="mt-5 text-sm font-bold">Plans</h4>
          {member.subscriptions.length ? (
            <ul className="mt-2 space-y-2">
              {member.subscriptions.map((s) => <SubscriptionRow key={s.id} sub={s} onDone={() => void refresh()} />)}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">No plan on this account.</p>}

          <h4 className="mt-5 text-sm font-bold">One-time purchases</h4>
          {member.purchases.length ? (
            <ul className="mt-2 space-y-2">
              {member.purchases.map((p) => <PurchaseRow key={p.id} purchase={p} member={member} onDone={() => void refresh()} />)}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">Nothing bought on its own yet.</p>}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">What the team has done</h3>
        <p className="mt-1 text-sm text-muted-foreground">The last 25 billing actions, refusals included, newest first.</p>
        {log.isError ? (
          <p className="mt-3 text-sm text-destructive">Couldn't load the log. Has migration 20261105150000 been run?</p>
        ) : !log.data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {log.data.map((a, i) => (
              <li key={`${a.createdAt}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <b>{a.actorEmail || "someone"}</b>{" "}
                  {a.action === "refund" ? "refunded" : a.action === "cancel_plan" ? "stopped a plan renewing" : "let a plan renew"}
                  {a.amountCents ? ` ${formatUsd(a.amountCents)}` : ""}
                  {a.targetEmail ? ` · ${a.targetEmail}` : ""}
                  {a.status === "failed" ? <span className="text-destructive"> · refused: {a.error ?? "no reason given"}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{a.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
