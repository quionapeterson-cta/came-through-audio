import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAction } from "@/components/ConfirmHost";
import { isValidEmail } from "@/lib/contracts";
import {
  listCompanyEmail,
  sendCompanyEmail,
  type CompanyEmailRow,
} from "@/lib/company-email.functions";
import {
  COMPANY_MAILBOXES,
  COMPANY_MAIL_DAILY_LIMIT,
  type CompanyMailbox,
} from "@/lib/company-email";

/**
 * Admin → Email: correspondence from a company mailbox — admin@ for the company's own letters, support@ for a customer,
 * and so on. Open to every member of staff (the server checks the role), replies go back to the same box, and the footer
 * is transactional. Commercial mail to people who never asked is Outreach, which stays with super admins.
 */
export function CompanyMail() {
  const send = useServerFn(sendCompanyEmail);
  const history = useServerFn(listCompanyEmail);
  const [mailbox, setMailbox] = useState<CompanyMailbox>("admin");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<CompanyEmailRow[]>();
  const load = () =>
    history()
      .then(setSent)
      .catch(() => setSent([]));

  useEffect(() => {
    void history()
      .then(setSent)
      .catch(() => setSent([]));
    // Once on mount: the sent list is a server read, not state anyone else changes.
  }, []);

  const go = async () => {
    if (!isValidEmail(to)) {
      toast.error("Add a valid email address.");
      return;
    }
    if (
      !(await confirmAction({
        title: `Send to ${to}?`,
        text: `"${subject}" from ${COMPANY_MAILBOXES[mailbox]}.`,
        action: "Send email",
      }))
    )
      return;
    setBusy(true);
    try {
      await send({ data: { mailbox, to, ...(cc.trim() ? { cc: cc.trim() } : {}), subject, body } });
      toast.success(`Sent from ${COMPANY_MAILBOXES[mailbox]} to ${to}.`);
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the email.");
    } finally {
      setBusy(false);
    }
  };

  const shortDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="space-y-6">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        Write to someone as the company. Replies come back to the mailbox you send from, the footer
        is transactional, and it's capped at {COMPANY_MAIL_DAILY_LIMIT} a day. A blank line starts a
        new paragraph.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Send from</span>
          <select
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value as CompanyMailbox)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {(Object.keys(COMPANY_MAILBOXES) as CompanyMailbox[]).map((k) => (
              <option key={k} value={k}>
                {COMPANY_MAILBOXES[k]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-muted-foreground">Replies land in this box.</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Their email</span>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@company.com"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Cc (optional)</span>
          <Input type="email" value={cc} onChange={(e) => setCc(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Subject</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Message</span>
        <textarea
          rows={14}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-md border border-input bg-background p-3 text-sm leading-relaxed"
        />
      </label>

      <Button
        disabled={busy || !to.trim() || subject.trim().length < 3 || body.trim().length < 20}
        onClick={() => void go()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send email
      </Button>

      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
          Sent <span className="opacity-70">{sent?.length ?? 0}</span>
        </h3>
        {!sent ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {sent.map((r, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{r.toEmail}</span>{" "}
                  <span className="text-muted-foreground">· {r.subject}</span>
                  {r.fromEmail && (
                    <span className="block text-xs text-muted-foreground">{r.fromEmail}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{shortDate(r.sentAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
