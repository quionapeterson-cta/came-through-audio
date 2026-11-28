import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canReceivePackets,
  canSendPackets,
  canWorkPackets,
  resolveAccess,
  type StaffAccess,
} from "@/lib/departments";
import { emailLayout, escapeHtml, ADMIN_EMAIL, SITE_URL } from "@/lib/email-layout";

/** The company's own mail domain: the only place a signed copy may go besides its signer. */
const COMPANY_MAIL_DOMAIN = "camethroughaudio.com";
import { trustedOrigin } from "@/lib/invite-limits";
import { mailKey, mailboxAddress, resendKey, sendMail } from "@/lib/mailer";
import { packetEmailHtml, packetEmailSubject } from "@/lib/packet-email";
import { DELIVERY_STATUSES, type DeliveryStatus } from "@/lib/resend-events";
import { templateToPdfBytes } from "@/lib/pdf-template-pdf";
import {
  internshipPacketTemplate,
  packetProblems,
  packetForms,
  packetSendForms,
  visibleBlocks,
  type PacketAudit,
  type PacketStatus,
  type PacketValues,
  type SignatureRecord,
} from "@/lib/pdf-packets";
import { sameTemplateBlocks, type PdfTemplate } from "@/lib/pdf-templates";

/**
 * Sent & Inbox (founder, 2026-11-15): sending a packet, the public signing page, the counter-signature and the delivery
 * to the admin inbox. Building, the inbox setting and the counter-signature are a super admin's; HR sends and reads what
 * came back (founder, 2026-11-22). The two public functions go through the database's own `pdf_packet_signing` /
 * `pdf_packet_submit` functions, which see one packet by its unguessable id and nothing else.
 */

const SETTINGS_ID = "pdf_inbox";
const STARTER_NAME = internshipPacketTemplate().name;

type Ctx = { supabase: SupabaseClient; userId: string };

type PacketRow = {
  id: string;
  template_id: string | null;
  title: string;
  snapshot: PdfTemplate;
  recipient_name: string;
  recipient_email: string;
  enabled_forms: string[];
  admin_values: PacketValues;
  values: PacketValues;
  recipient_signature: SignatureRecord | null;
  admin_signature: SignatureRecord | null;
  status: PacketStatus;
  created_by: string;
  sent_at: string;
  recipient_signed_at: string | null;
  admin_signed_at: string | null;
  completed_at: string | null;
  audit: PacketAudit;
};

export type PacketSummary = Pick<
  PacketRow,
  | "id"
  | "title"
  | "recipient_name"
  | "recipient_email"
  | "status"
  | "sent_at"
  | "recipient_signed_at"
  | "admin_signed_at"
  | "completed_at"
> & {
  formCount: number;
  createdBy: string;
  /**
   * The signing email's latest delivery result, or null when nothing went out through the mailer. "accepted" means Resend
   * took it; the webhook moves it to delivered, bounced or failed minutes later.
   */
  email: { status: DeliveryStatus; at: string; note: string | null } | null;
};

const emailSchema = z.string().trim().email().max(200);
const signatureSchema = z.object({
  kind: z.enum(["draw", "type"]),
  data: z.string().min(1).max(900_000),
  name: z.string().trim().min(1).max(120),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

/** The caller's staff access, resolved from the same roles rows `public.in_department` reads. */
async function packetAccess(context: Ctx) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role, departments")
    .eq("user_id", context.userId);
  return resolveAccess((roles ?? []) as { role: string; departments?: string[] | null }[]);
}

/**
 * Who may work a packet beyond sending (founder, 2026-11-22): a super admin alone reads a sent packet, builds one, sets
 * the reply inbox and counter-signs. HR sends and stops there, so every one of those calls refuses HR here as well as
 * in the database (migration 20261122200000).
 */
async function requirePacketAccess(context: Ctx): Promise<void> {
  if (!canWorkPackets(await packetAccess(context)))
    throw new Error("Only a super admin can work signature packets.");
}

/**
 * Who may send a packet (founder, 2026-11-19, narrowed 2026-11-22): a super admin or HR. Building, the reply inbox and
 * the counter-signature stay on `requirePacketAccess`. The access comes back so a send can ask the narrower question too
 * — HR may not attach a company signature while sending.
 */
async function requirePacketSender(context: Ctx): Promise<StaffAccess> {
  const access = await packetAccess(context);
  if (!access || !canSendPackets(access))
    throw new Error("Only a super admin or HR can send a packet.");
  return access;
}

/**
 * Who may read Sent & Inbox (founder, 2026-11-22): a super admin or HR. HR receives a packet as well as sending one, so
 * the list, one packet and its locked PDF are theirs too; building and counter-signing are not.
 */
async function requirePacketReader(context: Ctx): Promise<void> {
  if (!canReceivePackets(await packetAccess(context)))
    throw new Error("Only a super admin or HR can open sent packets.");
}

const origin = () => {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
};

const requestMeta = () => {
  try {
    const headers = getRequest().headers;
    // Behind a proxy the client's address can arrive in any of these; a signed certificate must not print "—" just
    // because the edge used a different name than the one we asked for first.
    const ip = ["x-forwarded-for", "cf-connecting-ip", "x-real-ip", "true-client-ip"]
      .map((name) => (headers.get(name) ?? "").split(",")[0]!.trim())
      .find(Boolean);
    return {
      ip,
      device: (headers.get("user-agent") ?? "").slice(0, 240) || undefined,
    };
  } catch {
    return { ip: undefined, device: undefined };
  }
};

/** SHA-256 of exactly what was signed, printed on the audit certificate. */
async function documentHash(parts: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** The packet as a locked PDF: the switched-on forms, the answers, both signatures and the audit certificate. */
async function buildPacketPdf(row: {
  title: string;
  snapshot: PdfTemplate;
  enabled_forms: string[];
  admin_values: PacketValues;
  values: PacketValues;
  recipient_signature: SignatureRecord | null;
  admin_signature: SignatureRecord | null;
  audit: PacketAudit;
  recipient_name: string;
  recipient_email: string;
  sent_at: string;
  recipient_signed_at: string | null;
  admin_signed_at: string | null;
}): Promise<Uint8Array> {
  const template: PdfTemplate = { ...row.snapshot, name: row.title };
  return templateToPdfBytes(
    template,
    {},
    {
      blocks: visibleBlocks(template, row.enabled_forms),
      // Seal artwork is a public asset of the live site, so the same address the signing link uses serves it.
      artBase: publicOrigin(),
      values: { ...row.admin_values, ...row.values },
      signatures: { recipient: row.recipient_signature, admin: row.admin_signature },
      audit: {
        ...row.audit,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        sentAt: row.audit.sentAt ?? row.sent_at,
        ...(row.recipient_signed_at ? { recipientSignedAt: row.recipient_signed_at } : {}),
        ...(row.admin_signed_at ? { adminSignedAt: row.admin_signed_at } : {}),
        hash: await documentHash({
          snapshot: row.snapshot,
          enabledForms: row.enabled_forms,
          values: { ...row.admin_values, ...row.values },
          recipient: row.recipient_signature,
          admin: row.admin_signature,
        }),
      },
    },
  );
}

const packetFileName = (title: string) =>
  `${title.replace(/[^\w -]+/g, "").trim() || "packet"}.pdf`;

/**
 * The address a signing link is safe to use from: our live site, never an editor preview. A preview host asks the
 * recipient to sign in to Lovable and then shows them a permission page, which is not a signature page.
 */
const publicOrigin = () => trustedOrigin(origin(), SITE_URL);

async function packetEmailLink(id: string) {
  return `${publicOrigin()}/sign/packet/${id}`;
}

async function sendMailSafely(input: Parameters<typeof sendMail>[0]) {
  try {
    return await sendMail(input);
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "send-failed" } as Awaited<
      ReturnType<typeof sendMail>
    >;
  }
}

/** The one sentence staff read when a signing email doesn't go out. */
function emailErrorText(result: Awaited<ReturnType<typeof sendMail>>) {
  if (result.ok) return null;
  if (result.detail === "no-key")
    return "Email sending isn't switched on yet. The link is ready to copy instead.";
  if (result.status === 401 || result.status === 403)
    return "The sending key was refused, or camethroughaudio.com isn't verified with the email service. Copy the link instead.";
  if (result.status === 429)
    return "The email service's rate limit was hit. Wait a minute and try again, or copy the link.";
  return `The email could not be sent (${result.status ?? result.detail ?? "network"}). Copy the link instead.`;
}

/**
 * Writes the signing email into the same delivery log as every other PDF email, linked to its packet, so Resend's webhook
 * can mark it delivered or bounced and the sent list can show what happened. Logging never blocks a send.
 */
async function recordPacketEmail(
  context: Ctx,
  packet: { id: string; title: string; recipient_email: string },
  result: Awaited<ReturnType<typeof sendMail>>,
  message: { subject: string; fileName: string; to: string } = {
    subject: packetEmailSubject(packet.title),
    fileName: "Signing link",
    to: packet.recipient_email,
  },
) {
  const { error } = await context.supabase.from("pdf_email_sends" as never).insert({
    packet_id: packet.id,
    resend_id: result.id ?? null,
    sent_by: context.userId,
    mailbox: "admin",
    recipients: [message.to],
    subject: message.subject,
    file_name: message.fileName,
    status: result.ok ? "accepted" : "failed",
    bounce_message: result.ok ? null : (result.detail ?? "send-failed").slice(0, 500),
  } as never);
  if (error) console.error("[packets] couldn't record the email result", error.message);
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Starter packet                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Adds the internship packet to the library the first time an admin opens Sent & Inbox. Idempotent by name. */
export const ensureInternshipPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; created: boolean }> => {
    await requirePacketAccess(context);
    // The starter is the built-in document, never anything the browser sends, so it seeds on the service client: the
    // library needs it before a packet can be sent, while changing the library itself stays with a super admin.
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: existing } = await db
      .from("pdf_templates" as never)
      .select("*")
      .eq("name", STARTER_NAME)
      .maybeSingle();
    const template = internshipPacketTemplate();
    if (existing) {
      const row = existing as {
        id: string;
        blocks: unknown[];
        created_at: string;
        updated_at: string;
      };
      // A copy nobody has saved yet follows the built-in document (the first seed was a short summary of it). Once an
      // admin has saved their own version, `updated_at` moves and their copy is never overwritten. The comparison ignores
      // the ids a built template makes fresh each time and jsonb's own key order, so an unchanged starter is left alone
      // instead of being rewritten (with new field ids) on every visit.
      const untouched = row.created_at === row.updated_at;
      if (untouched && !sameTemplateBlocks(row.blocks, template.blocks)) {
        const { error: refreshError } = await db
          .from("pdf_templates" as never)
          .update({ blocks: template.blocks, updated_by: context.userId } as never)
          .eq("id", row.id);
        if (refreshError) throw new Error("Couldn't update the internship packet.");
        return { id: row.id, created: false };
      }
      return { id: row.id, created: false };
    }
    const { data, error } = await db
      .from("pdf_templates" as never)
      .insert({
        name: template.name,
        tier: template.tier,
        blocks: template.blocks,
        source: "built",
        created_by: context.userId,
        updated_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("Couldn't add the internship packet to the library.");
    return { id: (data as { id: string }).id, created: true };
  });

/* ------------------------------------------------------------------------------------------------------------------ */
/* Settings                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

export const getPacketInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ email: string; configured: boolean }> => {
    await requirePacketAccess(context);
    const { data } = await context.supabase
      .from("site_settings" as never)
      .select("content")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    const email = (data as { content?: { email?: string } } | null)?.content?.email;
    return {
      email: typeof email === "string" && email.includes("@") ? email : ADMIN_EMAIL,
      // Whether a sending key exists at all — never the key itself. The panel warns before a send, not after.
      configured: Boolean(resendKey()),
    };
  });

export const setPacketInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePacketAccess(context);
    const { error } = await context.supabase.from("site_settings" as never).upsert({
      id: SETTINGS_ID,
      content: { email: data.email, updatedBy: context.userId },
      updated_at: new Date().toISOString(),
    } as never);
    if (error) throw new Error("Couldn't save the notification email.");
    return { email: data.email };
  });

/* ------------------------------------------------------------------------------------------------------------------ */
/* Send                                                                                                               */
/* ------------------------------------------------------------------------------------------------------------------ */

const sendInput = z.object({
  templateId: z.string().uuid(),
  recipientName: z.string().trim().min(1, "Add the recipient's name.").max(120),
  recipientEmail: emailSchema,
  enabledForms: z.array(z.string().max(40)).max(30),
  adminValues: z.record(z.string(), z.string().max(2000)).default({}),
  preSign: z
    .object({
      kind: z.enum(["draw", "type"]),
      data: z.string().min(1).max(900_000),
      name: z.string().trim().min(1).max(120),
      size: z.enum(["sm", "md", "lg"]).optional(),
    })
    .nullable()
    .default(null),
  title: z.string().trim().max(140).optional(),
});

export const sendPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendInput.parse(d))
  .handler(async ({ data, context }) => {
    const access = await requirePacketSender(context);
    // Counter-signing while sending is still counter-signing: HR sends, and the company's signature stays a super
    // admin's, so a pre-signature posted past the hidden checkbox is refused here.
    if (data.preSign && !canWorkPackets(access))
      throw new Error("Only a super admin can counter-sign a packet.");
    const { data: row, error } = await context.supabase
      .from("pdf_templates" as never)
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error || !row) throw new Error("That template is no longer in the library.");
    const template = row as { name: string; blocks: PdfTemplate["blocks"] };
    const snapshot: PdfTemplate = {
      name: data.title?.trim() || template.name,
      tier: "platinum",
      blocks: template.blocks,
      source: "built",
    };
    // A template built as one letter or agreement has no switchable forms and is sent whole, so an empty list is only a
    // mistake when the template offered forms and none were kept.
    const { forms: finalForms, error: formError } = packetSendForms(snapshot, data.enabledForms);
    if (formError) throw new Error(formError);

    const meta = requestMeta();
    const signature: SignatureRecord | null = data.preSign
      ? {
          ...data.preSign,
          role: "admin",
          signedAt: new Date().toISOString(),
          ...(meta.ip ? { ip: meta.ip } : {}),
          ...(meta.device ? { device: meta.device } : {}),
        }
      : null;
    const now = new Date().toISOString();
    const audit: PacketAudit = {
      sentAt: now,
      sentBy: context.userId,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      ...(signature
        ? {
            adminSignedAt: signature.signedAt,
            adminEmail: ADMIN_EMAIL,
            adminDevice: signature.device,
            adminIp: signature.ip,
          }
        : {}),
    };

    const { data: inserted, error: insertError } = await context.supabase
      .from("pdf_packets" as never)
      .insert({
        template_id: data.templateId,
        title: snapshot.name,
        snapshot,
        recipient_name: data.recipientName,
        recipient_email: data.recipientEmail,
        enabled_forms: finalForms,
        admin_values: data.adminValues,
        admin_signature: signature,
        // A pre-signature is the company's half only: the packet is still waiting on the recipient, and it completes when
        // their signature lands (the submit RPC sees the admin signature and closes it then).
        status: "sent",
        completed_at: null,
        admin_signed_at: signature ? now : null,
        created_by: context.userId,
        audit,
      } as never)
      .select("*")
      .single();
    if (insertError)
      throw new Error("Couldn't create the packet. Has migration 20261115230000 been run?");

    const packet = inserted as PacketRow;
    const link = await packetEmailLink(packet.id);
    const res = await sendMailSafely({
      from: "admin",
      replyTo: mailboxAddress("admin"),
      to: [data.recipientEmail],
      subject: packetEmailSubject(snapshot.name),
      html: packetEmailHtml({
        title: snapshot.name,
        recipientName: data.recipientName,
        link,
      }),
      key: mailKey("pdf", "packet", packet.id, data.recipientEmail),
    });
    await recordPacketEmail(context, packet, res);

    return {
      id: packet.id,
      link,
      emailed: res.ok,
      emailError: emailErrorText(res),
    };
  });

/**
 * Sends the signing link again (founder, 2026-11-15). A first send that bounced, or an inbox that lost it, is the same
 * click: a fresh mail run with its own idempotency key, so it is never swallowed as a duplicate of the first.
 */
export const emailPacketLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePacketSender(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That packet no longer exists.");
    const packet = row as PacketRow;
    if (packet.status === "void") throw new Error("This packet was withdrawn.");
    if (packet.recipient_signed_at)
      throw new Error("They've already signed, so there's no signing link left to send.");

    const link = await packetEmailLink(packet.id);
    const res = await sendMailSafely({
      from: "admin",
      replyTo: mailboxAddress("admin"),
      to: [packet.recipient_email],
      subject: packetEmailSubject(packet.title),
      html: packetEmailHtml({
        title: packet.title,
        recipientName: packet.recipient_name,
        link,
      }),
      key: mailKey(
        "pdf",
        "packet",
        packet.id,
        packet.recipient_email,
        "again",
        crypto.randomUUID(),
      ),
    });
    await recordPacketEmail(context, packet, res);
    return { emailed: res.ok, emailError: emailErrorText(res), link };
  });

/* ------------------------------------------------------------------------------------------------------------------ */
/* List, open, counter-sign                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

export const listPackets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PacketSummary[]> => {
    await requirePacketReader(context);
    const { data, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Couldn't load sent packets. Run migration 20261115230000 first.");
    const rows = (data ?? []) as unknown as PacketRow[];
    // The newest delivery result per packet, so the row can say Delivered, Bounced or Failed instead of guessing. A
    // database without migration 20261116120000 simply shows no delivery state.
    const latest = new Map<string, { status: DeliveryStatus; at: string; note: string | null }>();
    if (rows.length) {
      const { data: sends } = await context.supabase
        .from("pdf_email_sends" as never)
        .select("packet_id, status, bounce_message, created_at")
        .in(
          "packet_id",
          rows.map((row) => row.id),
        )
        .order("created_at", { ascending: false });
      for (const send of (sends ?? []) as unknown as {
        packet_id: string | null;
        status: string;
        bounce_message: string | null;
        created_at: string;
      }[]) {
        if (!send.packet_id || latest.has(send.packet_id)) continue;
        if (!(DELIVERY_STATUSES as readonly string[]).includes(send.status)) continue;
        latest.set(send.packet_id, {
          status: send.status as DeliveryStatus,
          at: send.created_at,
          note: send.bounce_message,
        });
      }
    }
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      recipient_name: row.recipient_name,
      recipient_email: row.recipient_email,
      status: row.status,
      sent_at: row.sent_at,
      recipient_signed_at: row.recipient_signed_at,
      admin_signed_at: row.admin_signed_at,
      completed_at: row.completed_at,
      formCount: packetForms(row.snapshot).filter((f) => row.enabled_forms.includes(f.key)).length,
      createdBy: row.created_by,
      email: latest.get(row.id) ?? null,
    }));
  });

export const getPacket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePacketReader(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That packet no longer exists.");
    return row as unknown as PacketRow;
  });

/**
 * Sends the final PDF to the configured admin inbox and returns whether the mail went out. `repeat` marks a copy sent
 * again after the packet was already delivered: it goes into its own idempotency key, so the provider sends it instead
 * of swallowing it as a duplicate of the first email.
 */
async function deliverCompleted(
  packet: PacketRow,
  link: string,
  to: string = ADMIN_EMAIL,
  repeat?: string,
) {
  const pdf = await buildPacketPdf(packet);
  const filename = packetFileName(packet.title);
  const res = await sendMailSafely({
    from: "admin",
    replyTo: mailboxAddress("admin"),
    to: [to],
    subject: `Signed: ${packet.title} — ${packet.recipient_name}`,
    html: emailLayout(
      `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Completed packet</p>
<h1 style="font-size:22px;margin:8px 0 12px">${escapeHtml(packet.title)}</h1>
<p style="font-size:15px;line-height:1.6"><b>${escapeHtml(packet.recipient_name)}</b> (${escapeHtml(packet.recipient_email)}) signed, and the company counter-signature is on the document.</p>
<p style="font-size:15px;line-height:1.6">The locked PDF is attached, with its execution audit certificate.</p>
<p style="margin:20px 0"><a href="${link}" style="background:#004AAD;color:#FFFFFF;padding:11px 20px;border-radius:6px;font-weight:700;text-decoration:none">Open the packet</a></p>`,
      { reason: "You're receiving this because a packet was completed in Came Through Audio." },
    ),
    attachments: [{ filename, content: toBase64(pdf) }],
    key: mailKey("pdf", "packet-complete", packet.id, ...(repeat ? [repeat] : [])),
  });
  return {
    emailed: res.ok,
    resendId: res.id,
    // A staff member reads this, so it is our own sentence and never the provider's raw reply.
    emailError: res.ok
      ? null
      : (emailErrorText(res) ?? "The email could not be sent. Copy the link instead."),
    pdfBase64: toBase64(pdf),
  };
}

/** The admin notification address, read on the staff member's own session. */
async function adminInbox(context: Ctx): Promise<string> {
  const { data } = await context.supabase
    .from("site_settings" as never)
    .select("content")
    .eq("id", SETTINGS_ID)
    .maybeSingle();
  const email = (data as { content?: { email?: string } } | null)?.content?.email;
  return typeof email === "string" && email.includes("@") ? email : ADMIN_EMAIL;
}

export const counterSignPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), signature: signatureSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requirePacketAccess(context);
    const { data: current, error: readError } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !current) throw new Error("That packet no longer exists.");
    const before = current as unknown as PacketRow;
    if (!before.recipient_signed_at)
      throw new Error("The recipient hasn't signed this packet yet.");
    if (before.status === "completed") throw new Error("This packet is already fully executed.");
    const meta = requestMeta();
    const signature: SignatureRecord = {
      ...data.signature,
      role: "admin",
      signedAt: new Date().toISOString(),
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.device ? { device: meta.device } : {}),
    };
    const inboxEmail = await adminInbox(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .update({
        admin_signature: signature,
        admin_signed_at: signature.signedAt,
        admin_user_agent: meta.device ?? null,
        admin_ip: meta.ip ?? null,
        status: "completed",
        completed_at: signature.signedAt,
        audit: {
          ...before.audit,
          adminName: signature.name,
          adminEmail: inboxEmail,
          ...(meta.device ? { adminDevice: meta.device } : {}),
          ...(meta.ip ? { adminIp: meta.ip } : {}),
        },
      } as never)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !row) throw new Error("Couldn't counter-sign this packet.");
    const packet = row as unknown as PacketRow;
    if (packet.status !== "completed")
      throw new Error("That packet isn't ready to counter-sign yet.");
    const link = await packetEmailLink(packet.id);
    const delivery = await deliverCompleted(packet, link, inboxEmail);
    // The executed PDF is as much an email as the signing link, so it gets the same delivery row and bounce report.
    await recordPacketEmail(
      context,
      packet,
      delivery.emailed
        ? { ok: true, ...(delivery.resendId ? { id: delivery.resendId } : {}) }
        : { ok: false, detail: delivery.emailError ?? "send-failed" },
      {
        subject: `Signed: ${packet.title} — ${packet.recipient_name}`,
        fileName: packetFileName(packet.title),
        to: inboxEmail,
      },
    );
    return { ok: true, link, emailed: delivery.emailed, emailError: delivery.emailError };
  });

/**
 * Sends a finished packet's locked PDF again (founder, 2026-11-17). Once a packet is fully executed a copy often has to
 * reach someone a second time — the recipient, or a third party they name — so a staff member can send it to any
 * address from Sent & Inbox. Only a completed packet qualifies: an unsigned one still belongs on its signing page.
 */
export const emailPacketCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), email: emailSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePacketSender(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That packet no longer exists.");
    const packet = row as unknown as PacketRow;
    if (packet.status !== "completed")
      throw new Error("Only a fully executed packet can be sent as a PDF.");
    // A signed copy goes back to the person who signed it or to a company mailbox (payroll, legal, the HR file), never
    // to an address typed in from outside, so the copy tool can't carry a signed agreement off the company.
    const to = data.email.trim().toLowerCase();
    const signer = String(packet.recipient_email ?? "").trim().toLowerCase();
    if (to !== signer && !to.endsWith(`@${COMPANY_MAIL_DOMAIN}`))
      throw new Error(
        `A signed copy can go to the signer or a @${COMPANY_MAIL_DOMAIN} address only.`,
      );
    const link = await packetEmailLink(packet.id);
    const delivery = await deliverCompleted(packet, link, data.email, crypto.randomUUID());
    // Every send is a real email, so it gets its own delivery row and bounce report like the completion email.
    await recordPacketEmail(
      context,
      packet,
      delivery.emailed
        ? { ok: true, ...(delivery.resendId ? { id: delivery.resendId } : {}) }
        : { ok: false, detail: delivery.emailError ?? "send-failed" },
      {
        subject: `Signed: ${packet.title} — ${packet.recipient_name}`,
        fileName: packetFileName(packet.title),
        to: data.email,
      },
    );
    return { emailed: delivery.emailed, emailError: delivery.emailError };
  });

export const packetPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requirePacketReader(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That packet no longer exists.");
    const packet = row as unknown as PacketRow;
    const pdf = await buildPacketPdf(packet);
    return { fileName: packetFileName(packet.title), pdf: toBase64(pdf) };
  });

/* ------------------------------------------------------------------------------------------------------------------ */
/* Public signing                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

const signingClient = async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
};

export const getSigningPacket = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const client = await signingClient();
    const { data: packet, error } = await client.rpc(
      "pdf_packet_signing" as never,
      { _id: data.id } as never,
    );
    if (error) {
      console.error("[packets] signing read failed", error.message);
      return null;
    }
    return (packet ?? null) as unknown as {
      id: string;
      title: string;
      snapshot: PdfTemplate;
      recipientName: string;
      enabledForms: string[];
      values: PacketValues;
      adminValues: PacketValues;
      status: PacketStatus;
      sentAt: string;
      recipientSignedAt: string | null;
      adminSignedAt: string | null;
      recipientSignature: SignatureRecord | null;
      adminSignature: SignatureRecord | null;
    } | null;
  });

export const submitSigningPacket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        values: z.record(
          z.string(),
          z.union([z.string().max(4000), z.array(z.string().max(120)).max(60)]),
        ),
        signature: signatureSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const client = await signingClient();
    const { data: existing } = await client.rpc(
      "pdf_packet_signing" as never,
      { _id: data.id } as never,
    );
    const packet = existing as unknown as {
      snapshot: PdfTemplate;
      enabledForms: string[];
      status: PacketStatus;
    } | null;
    if (!packet) throw new Error("This signing link is not valid.");
    if (packet.status !== "sent") throw new Error("This packet has already been signed.");
    // The signature is sent beside the values, so the shared check is told it exists rather than re-deriving it.
    const problems = packetProblems(packet.snapshot, packet.enabledForms, {
      ...data.values,
      __signature: "signed",
    });
    if (problems.length) throw new Error(problems[0]);

    const meta = requestMeta();
    const signature: SignatureRecord = {
      ...data.signature,
      role: "recipient",
      signedAt: new Date().toISOString(),
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.device ? { device: meta.device } : {}),
    };
    const { data: submitted, error } = await client.rpc(
      "pdf_packet_submit" as never,
      {
        _id: data.id,
        _values: data.values,
        _signature: signature,
        _user_agent: meta.device ?? null,
        _ip: meta.ip ?? null,
      } as never,
    );
    if (error) {
      console.error("[packets] submit failed", error.message);
      throw new Error("Couldn't submit your signature. Please try again.");
    }
    const result = submitted as unknown as {
      status: PacketStatus;
      completed: boolean;
      id: string;
      title: string;
      snapshot: PdfTemplate;
      enabledForms: string[];
      values: PacketValues;
      adminValues: PacketValues;
      recipientSignature: SignatureRecord | null;
      adminSignature: SignatureRecord | null;
      recipientName: string;
      recipientEmail: string;
      sentAt: string;
      recipientSignedAt: string | null;
      adminSignedAt: string | null;
    };
    let emailed: boolean | null = null;
    if (result.completed) {
      try {
        const row: PacketRow = {
          id: result.id,
          template_id: null,
          title: result.title,
          snapshot: result.snapshot,
          recipient_name: result.recipientName,
          recipient_email: result.recipientEmail,
          enabled_forms: result.enabledForms,
          admin_values: result.adminValues,
          values: result.values,
          recipient_signature: result.recipientSignature,
          admin_signature: result.adminSignature,
          status: result.status,
          created_by: "",
          sent_at: result.sentAt,
          recipient_signed_at: result.recipientSignedAt,
          admin_signed_at: result.adminSignedAt,
          completed_at: result.adminSignedAt,
          audit: { sentAt: result.sentAt },
        };
        const link = `${publicOrigin()}/sign/packet/${result.id}`;
        emailed = (await deliverCompleted(row, link)).emailed;
      } catch (error) {
        console.error("[packets] completed delivery failed", error);
        emailed = false;
      }
    }
    return { status: result.status, completed: result.completed, emailed };
  });
