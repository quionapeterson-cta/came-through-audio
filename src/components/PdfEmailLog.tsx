import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPdfEmails, type PdfEmailSend } from "@/lib/pdf-email-log.functions";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/resend-events";

/** Green only for delivered; a bounce or a failure reads as a problem, a delay as "not yet". */
const STATUS_CLASS: Record<DeliveryStatus, string> = {
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  accepted: "bg-muted text-muted-foreground",
  delayed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bounced: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  complained: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Recent PDF emails (founder, 2026-11-15): the app can only say Resend accepted a message, so this panel shows what the
 * recipient's server did with it — delivered, bounced with the reason, delayed or failed. It is the answer to "I sent it,
 * did they get it?" without opening the Resend dashboard.
 */
export function PdfEmailLog({ refreshKey = 0 }: { refreshKey?: number }) {
  const load = useServerFn(listPdfEmails);
  const [sends, setSends] = useState<PdfEmailSend[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void load()
      .then((rows) => {
        if (!alive) return;
        setSends(rows);
        setError("");
      })
      .catch(
        (e: unknown) =>
          alive && setError(e instanceof Error ? e.message : "Couldn't load delivery results."),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold">Recent PDF emails</h2>
      <p className="text-sm text-muted-foreground">
        Whether the recipient&apos;s mail server took each document. “Sent” means Resend accepted
        it; the result below is what came back.
      </p>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {loading && !sends ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading deliveries…
        </p>
      ) : null}

      {!loading && !error && sends?.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No emails sent yet. Each one you send will show here with what the recipient&apos;s server
          did with it.
        </p>
      ) : null}

      <ul className="mt-2 divide-y divide-border">
        {(sends ?? []).map((send) => (
          <li key={send.id} className="flex flex-wrap items-start gap-3 py-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-semibold">{send.subject}</p>
              <p className="break-all text-xs text-muted-foreground">
                To {send.recipients.join(", ")} · {send.fileName} · {when(send.sentAt)}
                {send.sentBy ? ` · ${send.sentBy}` : ""}
              </p>
              {send.status !== "delivered" &&
              send.status !== "accepted" &&
              (send.bounceMessage || send.bounceType) ? (
                <p className="mt-1 text-xs text-destructive">
                  {send.bounceType ? `${send.bounceType}: ` : ""}
                  {send.bounceMessage ?? "The recipient's server refused it."}
                </p>
              ) : null}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[send.status]}`}
            >
              {DELIVERY_LABELS[send.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
