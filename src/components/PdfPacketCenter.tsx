import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  FileSignature,
  Link2,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBlob } from "@/lib/catalog";
import {
  adminFields,
  packetForms,
  PACKET_STATUS_LABELS,
  placedAnswers,
  type PacketStatus,
} from "@/lib/pdf-packets";
import { SITE_URL } from "@/lib/email-layout";
import { trustedOrigin } from "@/lib/invite-limits";
import type { PdfTemplate } from "@/lib/pdf-templates";
import type { SavedTemplate } from "@/lib/pdf-templates.functions";
import { listPdfTemplates } from "@/lib/pdf-templates.functions";
import {
  counterSignPacket,
  emailPacketCopy,
  emailPacketLink,
  ensureInternshipPacket,
  getPacket,
  getPacketInbox,
  listPackets,
  packetPdf,
  sendPacket,
  setPacketInbox,
  type PacketSummary,
} from "@/lib/pdf-packets.functions";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/resend-events";
import { PdfSignaturePad, type SignatureValue } from "@/components/PdfSignaturePad";

/** The live signing address, so a link copied from an editor preview still opens for the recipient. */
const signingLink = (id: string) =>
  `${typeof window === "undefined" ? SITE_URL : trustedOrigin(window.location.origin, SITE_URL)}/sign/packet/${id}`;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** A bounced or failed signing email is worth noticing, so it is not painted as a quiet success. */
const deliveryTone = (status: DeliveryStatus) =>
  status === "bounced" || status === "failed" || status === "complained"
    ? "text-destructive"
    : status === "delayed"
      ? "text-amber-600"
      : "text-muted-foreground";

const statusStyle = (status: PacketStatus) =>
  status === "completed"
    ? { background: "#FFD70026", color: "#0b0b0b", border: "1px solid #FFD700" }
    : status === "pending_admin"
      ? { background: "#E5E4E2", color: "#0b0b0b", border: "1px solid #0b0b0b22" }
      : { background: "#004AAD12", color: "#004AAD", border: "1px solid #004AAD33" };

/**
 * Admin → PDF Tools → Sent & Inbox (founder, 2026-11-15): send a packet, watch it come back signed, counter-sign it and
 * keep the completed file. The signing page itself is public at /sign/:id; this panel never leaves the admin.
 */
export function PdfPacketCenter() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [packets, setPackets] = useState<PacketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inbox, setInbox] = useState("");
  const [inboxSaved, setInboxSaved] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [review, setReview] = useState<{
    id: string;
    title: string;
    recipient: string;
    status: PacketStatus;
  } | null>(null);
  const [sentLink, setSentLink] = useState<{ link: string; emailError: string | null } | null>(
    null,
  );

  const [templateId, setTemplateId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [enabledForms, setEnabledForms] = useState<string[]>([]);
  /**
   * The send form's fields, read when the packet goes out (founder, 2026-11-17) instead of being kept in React state: a
   * native date control owns its own segments, and one the browser never reports must still travel with the packet.
   */
  const prefillForm = useRef<HTMLDivElement | null>(null);
  /** The completed packet whose PDF is being emailed again, and where to. */
  const [sending, setSending] = useState<{ id: string; email: string } | null>(null);
  const [preSign, setPreSign] = useState<SignatureValue | null>(null);
  const [reviewSignature, setReviewSignature] = useState<SignatureValue | null>(null);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );
  const forms = useMemo(() => (template ? packetForms(template as PdfTemplate) : []), [template]);
  const admin = useMemo(() => (template ? adminFields(template as PdfTemplate) : []), [template]);

  async function load() {
    try {
      // The starter packet joins the library once, and an untouched early copy is brought up to the full document.
      await ensureInternshipPacket().catch(() => null);
      const [saved, sent, mail] = await Promise.all([
        listPdfTemplates(),
        listPackets(),
        getPacketInbox().catch(() => ({ email: "" })),
      ]);
      setTemplates(saved);
      setPackets(sent);
      setInbox(mail.email);
      setConfigured("configured" in mail ? Boolean(mail.configured) : true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load sent packets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Resend's webhook lands a second or two after the send, so the list watches for it itself instead of making the
  // founder press Refresh to see "Sent" turn into "Delivered". It stops once every send has settled, or after five
  // minutes if a mail server never answers, so a quiet tab is not left polling forever.
  const unsettled = packets.some(
    (packet) => packet.email?.status === "accepted" || packet.email?.status === "delayed",
  );
  useEffect(() => {
    if (!unsettled) return;
    let ticks = 0;
    const refresh = () => {
      if (document.hidden) return;
      void listPackets()
        .then(setPackets)
        .catch(() => undefined);
    };
    const timer = window.setInterval(() => {
      if (++ticks > 40) {
        window.clearInterval(timer);
        return;
      }
      refresh();
    }, 8000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [unsettled]);

  useEffect(() => {
    if (!template) return;
    setEnabledForms(
      packetForms(template as PdfTemplate)
        .filter((f) => f.optional)
        .map((f) => f.key),
    );
  }, [template]);

  function openSend() {
    const starter =
      templates.find((t) => t.name.startsWith("CTA Internship Onboarding Packet")) ?? templates[0];
    setTemplateId(starter?.id ?? "");
    setRecipientName("");
    setRecipientEmail("");
    setPreSign(null);
    setSentLink(null);
    setSendOpen(true);
  }

  /** The admin answers as they stand in the form right now, read from the fields themselves. */
  function answersFromForm() {
    return placedAnswers(
      admin,
      (id) =>
        prefillForm.current?.querySelector<HTMLInputElement>(`input[name="prefill-${id}"]`)
          ?.value,
    );
  }

  async function send() {
    if (!templateId) {
      toast.error("Choose a template first.");
      return;
    }
    if (!recipientName.trim() || !recipientEmail.includes("@")) {
      toast.error("Add the recipient's name and email.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendPacket({
        data: {
          templateId,
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          enabledForms,
          adminValues: answersFromForm(),
          preSign: preSign ? { ...preSign, name: preSign.name || recipientName } : null,
        },
      });
      setSentLink({ link: result.link, emailError: result.emailError });
      await load();
      toast.success(
        result.emailed
          ? "Packet sent. The signing link is in their inbox."
          : "Packet created. Copy the signing link below.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the packet.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Sends a finished packet's locked PDF again (founder, 2026-11-17), to the recipient or to anyone else who needs a
   * copy now that it is fully executed.
   */
  async function sendCopy(id: string) {
    const to = sending?.email.trim() ?? "";
    if (!to.includes("@")) return;
    setBusy(true);
    try {
      const result = await emailPacketCopy({ data: { id, email: to } });
      if (result.emailed) toast.success(`Signed PDF emailed to ${to}.`);
      else toast.error(result.emailError ?? "The email didn't go out. Download the PDF instead.");
      setSending(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't email the PDF.");
    } finally {
      setBusy(false);
    }
  }

  /** Sends the signing link again, for a first email that bounced or one the recipient never found. */
  async function emailLink(id: string) {
    setBusy(true);
    try {
      const result = await emailPacketLink({ data: { id } });
      if (result.emailed) toast.success("Signing link emailed.");
      else toast.error(result.emailError ?? "The email didn't go out. Copy the link instead.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't email the signing link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Signing link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it.");
    }
  }

  async function download(id: string) {
    try {
      const { fileName, pdf } = await packetPdf({ data: { id } });
      const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
      saveBlob(new Blob([bytes], { type: "application/pdf" }), fileName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't build the PDF.");
    }
  }

  async function openReview(id: string) {
    try {
      const row = await getPacket({ data: { id } });
      setReview({
        id: row.id,
        title: row.title,
        recipient: row.recipient_name,
        status: row.status,
      });
      setReviewSignature(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open the packet.");
    }
  }

  async function counterSign() {
    if (!review || !reviewSignature) {
      toast.error("Add the company signature first.");
      return;
    }
    setBusy(true);
    try {
      const result = await counterSignPacket({
        data: { id: review.id, signature: reviewSignature },
      });
      toast.success(
        result.emailed
          ? "Counter-signed and fully executed. The PDF is in the admin inbox."
          : "Counter-signed and fully executed. Email delivery is not connected; download the PDF instead.",
      );
      setReview(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't counter-sign.");
    } finally {
      setBusy(false);
    }
  }

  const open = packets.filter((p) => p.status === "sent" || p.status === "pending_admin");
  const completed = packets.filter((p) => p.status === "completed");

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sent packets…
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Sent &amp; Inbox</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Send a packet for signature, counter-sign it when it comes back, and keep the locked PDF
            with its audit certificate. The recipient only ever sees their own signing page.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw /> Refresh
          </Button>
          <Button onClick={openSend} disabled={!templates.length}>
            <Send /> Send a packet
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="packet-inbox">Admin notification email</Label>
          <Input
            id="packet-inbox"
            value={inbox}
            onChange={(e) => {
              setInbox(e.target.value);
              setInboxSaved(false);
            }}
            placeholder="admin@camethroughaudio.com"
            className="mt-1"
          />
        </div>
        <Button
          variant="outline"
          disabled={!inbox.includes("@")}
          onClick={async () => {
            try {
              await setPacketInbox({ data: { email: inbox.trim() } });
              setInboxSaved(true);
              toast.success("Completed packets go to this inbox.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't save the email.");
            }
          }}
        >
          <Mail /> {inboxSaved ? "Saved" : "Save email"}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Every fully executed PDF is emailed here as an attachment and kept under Completed.
        </p>
      </div>

      {!packets.length ? (
        <p className="text-sm text-muted-foreground">
          Nothing sent yet. Send the internship packet, or any template in the library.
        </p>
      ) : null}

      <div className="space-y-2">
        {open.map((packet) => (
          <article key={packet.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{packet.title}</p>
                <p className="text-xs text-muted-foreground">
                  {packet.recipient_name} · {packet.recipient_email} · sent {when(packet.sent_at)} ·{" "}
                  {packet.formCount} form{packet.formCount === 1 ? "" : "s"}
                </p>
                {packet.email ? (
                  <p className={`text-xs ${deliveryTone(packet.email.status)}`}>
                    <Mail className="mr-1 inline h-3 w-3" />
                    Email {DELIVERY_LABELS[packet.email.status].toLowerCase()} ·{" "}
                    {when(packet.email.at)}
                    {packet.email.note ? ` · ${packet.email.note}` : ""}
                  </p>
                ) : null}
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={statusStyle(packet.status)}
              >
                {PACKET_STATUS_LABELS[packet.status]}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy(signingLink(packet.id))}>
                <Copy /> Copy link
              </Button>
              {!packet.recipient_signed_at ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void emailLink(packet.id)}
                >
                  <Mail /> {packet.email ? "Email link again" : "Email link"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(signingLink(packet.id), "_blank", "noopener")}
              >
                <ArrowUpRight /> Open signing page
              </Button>
              {packet.status === "pending_admin" ? (
                <Button size="sm" onClick={() => void openReview(packet.id)}>
                  <FileSignature /> Review &amp; counter-sign
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => void download(packet.id)}>
                <Download /> PDF
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Completed packets
        </p>
        {!completed.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            A packet moves here once both signatures are in.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {completed.map((packet) => (
              <li
                key={packet.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{packet.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {packet.recipient_name} · executed {when(packet.completed_at)}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={statusStyle("completed")}
                  >
                    <Check className="mr-1 inline h-3 w-3" /> Fully executed
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      setSending((current) =>
                        current?.id === packet.id
                          ? null
                          : { id: packet.id, email: packet.recipient_email },
                      )
                    }
                  >
                    <Send /> Send
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void download(packet.id)}>
                    <Download /> PDF
                  </Button>
                </span>
                {sending?.id === packet.id ? (
                  <div className="mt-1 flex w-full flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-2">
                    <div className="min-w-[220px] flex-1">
                      <Label htmlFor={`send-to-${packet.id}`}>Email the signed PDF to</Label>
                      <Input
                        id={`send-to-${packet.id}`}
                        type="email"
                        value={sending.email}
                        onChange={(e) =>
                          setSending({ id: packet.id, email: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={busy || !sending.email.includes("@")}
                      onClick={() => void sendCopy(packet.id)}
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Mail />} Send PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSending(null)}>
                      <X /> Cancel
                    </Button>
                    <p className="w-full text-xs text-muted-foreground">
                      The locked PDF goes out with its execution audit certificate, and the send is
                      recorded with its delivery result.
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {sendOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold">Send a packet</h4>
                <p className="text-sm text-muted-foreground">
                  The recipient gets a private link. Forms you switch off never appear on their page
                  or in the final PDF.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close"
                onClick={() => setSendOpen(false)}
              >
                <X />
              </Button>
            </div>

            {sentLink ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold">Packet created.</p>
                <p className="text-sm text-muted-foreground">
                  {sentLink.emailError
                    ? sentLink.emailError
                    : "The signing email is on its way. You can also copy the link:"}
                </p>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
                  <Link2 className="h-4 w-4 shrink-0 text-primary" />
                  <code className="min-w-0 flex-1 break-all text-xs">{sentLink.link}</code>
                  <Button size="sm" variant="outline" onClick={() => void copy(sentLink.link)}>
                    <Copy /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(sentLink.link, "_blank", "noopener")}
                  >
                    <ArrowUpRight /> Open
                  </Button>
                </div>
                <Button className="w-full" onClick={() => setSendOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="packet-template">Template</Label>
                  <select
                    id="packet-template"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="packet-name">Recipient name</Label>
                    <Input
                      id="packet-name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="mt-1"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor="packet-email">Recipient email</Label>
                    <Input
                      id="packet-email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="mt-1"
                      maxLength={200}
                    />
                  </div>
                </div>

                {forms.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Forms in this packet
                    </p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {forms.map((form) => (
                        <label key={form.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={enabledForms.includes(form.key)}
                            disabled={!form.optional}
                            onChange={(e) =>
                              setEnabledForms((current) =>
                                e.target.checked
                                  ? [...current, form.key]
                                  : current.filter((key) => key !== form.key),
                              )
                            }
                          />
                          {form.title}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {admin.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pre-fill the admin fields
                    </p>
                    <div ref={prefillForm} className="mt-2 grid gap-2 sm:grid-cols-2">
                      {admin.map((field) => (
                        <div key={field.id}>
                          <Label htmlFor={`prefill-${field.id}`}>{field.label}</Label>
                          {/* Uncontrolled on purpose (founder, 2026-11-17): the field, not a copy of it, is what is sent. */}
                          <Input
                            id={`prefill-${field.id}`}
                            name={`prefill-${field.id}`}
                            type={field.type === "date" ? "date" : "text"}
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={!!preSign}
                      onChange={(e) =>
                        setPreSign(
                          e.target.checked
                            ? {
                                kind: "type",
                                data: "Came Through Audio",
                                name: "Came Through Audio",
                              }
                            : null,
                        )
                      }
                    />
                    Counter-sign now
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pre-signing marks the packet fully executed the moment the recipient signs.
                    Leave it off to review and sign after they do.
                  </p>
                  {preSign ? (
                    <div className="mt-3">
                      <PdfSignaturePad
                        value={preSign}
                        onChange={(v) => setPreSign(v)}
                        label="Company representative"
                        name="Came Through Audio"
                      />
                    </div>
                  ) : null}
                </div>

                {!configured ? (
                  <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Email sending isn't connected yet, so nothing will land in an inbox. The packet
                    is still created and its signing link is shown here to copy.
                  </p>
                ) : null}

                <Button className="w-full" onClick={() => void send()} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Send for signature
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {review ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold">Counter-sign</h4>
                <p className="text-sm text-muted-foreground">
                  {review.title} · {review.recipient}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close"
                onClick={() => setReview(null)}
              >
                <X />
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <Lock className="h-4 w-4" /> The recipient has signed. Your signature stamps the Gold
              verification seal and the audit certificate, and sends the final PDF to the admin
              inbox.
            </p>
            <div className="mt-4">
              <PdfSignaturePad
                value={reviewSignature}
                onChange={setReviewSignature}
                label="Company representative"
                name="Came Through Audio"
              />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => void counterSign()}
              disabled={busy || !reviewSignature}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Counter-sign &amp;
              deliver
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
