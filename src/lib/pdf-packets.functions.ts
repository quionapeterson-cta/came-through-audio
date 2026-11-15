import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailLayout, escapeHtml, ADMIN_EMAIL } from "@/lib/email-layout";
import { mailKey, mailboxAddress, sendMail } from "@/lib/mailer";
import { templateToPdfBytes } from "@/lib/pdf-template-pdf";
import {
  internshipPacketTemplate,
  packetProblems,
  packetForms,
  visibleBlocks,
  type PacketAudit,
  type PacketStatus,
  type PacketValues,
  type SignatureRecord,
} from "@/lib/pdf-packets";
import type { PdfTemplate } from "@/lib/pdf-templates";

/**
 * Sent & Inbox (founder, 2026-11-15): sending a packet, the public signing page, the counter-signature and the delivery
 * to the admin inbox. Staff functions run on the signed-in staff member's session; the two public functions go through
 * the database's own `pdf_packet_signing` / `pdf_packet_submit` functions, which see one packet by its unguessable id and
 * nothing else.
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
> & { formCount: number; createdBy: string };

const emailSchema = z.string().trim().email().max(200);
const signatureSchema = z.object({
  kind: z.enum(["draw", "type"]),
  data: z.string().min(1).max(900_000),
  name: z.string().trim().min(1).max(120),
});

async function requireStaff(context: Ctx): Promise<void> {
  const { data } = await context.supabase.rpc(
    "is_staff" as never,
    { _user_id: context.userId } as never,
  );
  if (!data) throw new Error("Only staff can send signature packets.");
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
    return {
      ip: (headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || undefined,
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

async function packetEmailLink(id: string) {
  return `${origin()}/sign/packet/${id}`;
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

/* ------------------------------------------------------------------------------------------------------------------ */
/* Starter packet                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Adds the internship packet to the library the first time an admin opens Sent & Inbox. Idempotent by name. */
export const ensureInternshipPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; created: boolean }> => {
    await requireStaff(context);
    const { data: existing } = await context.supabase
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
      // admin has saved their own version, `updated_at` moves and their copy is never overwritten.
      const untouched = row.created_at === row.updated_at;
      if (untouched && JSON.stringify(row.blocks) !== JSON.stringify(template.blocks)) {
        const { error: refreshError } = await context.supabase
          .from("pdf_templates" as never)
          .update({ blocks: template.blocks, updated_by: context.userId } as never)
          .eq("id", row.id);
        if (refreshError) throw new Error("Couldn't update the internship packet.");
        return { id: row.id, created: false };
      }
      return { id: row.id, created: false };
    }
    const { data, error } = await context.supabase
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
  .handler(async ({ context }): Promise<{ email: string }> => {
    await requireStaff(context);
    const { data } = await context.supabase
      .from("site_settings" as never)
      .select("content")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    const email = (data as { content?: { email?: string } } | null)?.content?.email;
    return { email: typeof email === "string" && email.includes("@") ? email : ADMIN_EMAIL };
  });

export const setPacketInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: emailSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
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
    })
    .nullable()
    .default(null),
  title: z.string().trim().max(140).optional(),
});

export const sendPacket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
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
    const forms = packetForms(snapshot).map((f) => f.key);
    const finalForms = data.enabledForms.filter((key) => forms.includes(key));
    if (!finalForms.length) throw new Error("Keep at least one form in the packet.");

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
        status: signature ? "completed" : "sent",
        completed_at: signature ? now : null,
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
      subject: `Signature needed: ${snapshot.name}`,
      html: emailLayout(
        `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Came Through Audio</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(snapshot.name)}</h1>
<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(data.recipientName.split(" ")[0] || data.recipientName)},</p>
<p style="font-size:15px;line-height:1.6">Your signature is needed on this packet. Open your own signing page, fill in what applies to you and sign — it takes a few minutes, nothing to install.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#004AAD;color:#FFFFFF;padding:12px 22px;border-radius:6px;font-weight:700;text-decoration:none">Review &amp; sign</a></p>
<p style="font-size:13px;line-height:1.6;color:#555">If the button doesn't open, paste this link into your browser:<br><span style="word-break:break-all">${link}</span></p>`,
        { reason: "You're receiving this because Came Through Audio sent you a document to sign." },
      ),
      key: mailKey("pdf", "packet", packet.id, data.recipientEmail),
    });

    return {
      id: packet.id,
      link,
      emailed: res.ok,
      emailError: res.ok
        ? null
        : res.detail === "no-key"
          ? "Email sending isn't switched on yet. The link is ready to copy instead."
          : `The email could not be sent (${res.status ?? res.detail ?? "network"}). Copy the link instead.`,
    };
  });

/* ------------------------------------------------------------------------------------------------------------------ */
/* List, open, counter-sign                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

export const listPackets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PacketSummary[]> => {
    await requireStaff(context);
    const { data, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Couldn't load sent packets. Run migration 20261115230000 first.");
    return ((data ?? []) as unknown as PacketRow[]).map((row) => ({
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
    }));
  });

export const getPacket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { data: row, error } = await context.supabase
      .from("pdf_packets" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("That packet no longer exists.");
    return row as unknown as PacketRow;
  });

/** Sends the final PDF to the configured admin inbox and returns whether the mail went out. */
async function deliverCompleted(packet: PacketRow, link: string, to: string = ADMIN_EMAIL) {
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
<p style="font-size:15px;line-height:1.6">The locked PDF is attached, with its execution audit certificate. A copy is kept in Admin → PDF Tools → Sent &amp; Inbox → Completed.</p>
<p style="margin:20px 0"><a href="${link}" style="background:#004AAD;color:#FFFFFF;padding:11px 20px;border-radius:6px;font-weight:700;text-decoration:none">Open the packet</a></p>`,
      { reason: "You're receiving this because a packet was completed in Came Through Audio." },
    ),
    attachments: [{ filename, content: toBase64(pdf) }],
    key: mailKey("pdf", "packet-complete", packet.id),
  });
  return {
    emailed: res.ok,
    emailError: res.ok ? null : (res.detail ?? "send-failed"),
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
    await requireStaff(context);
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
    return { ok: true, link, emailed: delivery.emailed, emailError: delivery.emailError };
  });

export const packetPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
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
        const link = `${origin()}/sign/packet/${result.id}`;
        emailed = (await deliverCompleted(row, link)).emailed;
      } catch (error) {
        console.error("[packets] completed delivery failed", error);
        emailed = false;
      }
    }
    return { status: result.status, completed: result.completed, emailed };
  });
