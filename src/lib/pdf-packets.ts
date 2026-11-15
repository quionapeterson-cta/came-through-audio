/**
 * E-sign packets (founder, 2026-11-15): a template an admin sends to one person, filled on a signing page, then
 * counter-signed and archived. This module is the pure half — which forms are switched on, what a recipient still has to
 * fill, what the audit certificate says — so the studio, the signing page, the PDF and the server all agree, and the
 * rules can be tested without a database or a browser.
 */
import {
  newId,
  type CheckOption,
  type FillableField,
  type PdfTemplate,
  type TemplateBlock,
} from "./pdf-templates";

export const PACKET_STATUSES = ["sent", "pending_admin", "completed", "void"] as const;
export type PacketStatus = (typeof PACKET_STATUSES)[number];

export const PACKET_STATUS_LABELS: Record<PacketStatus, string> = {
  sent: "Waiting on recipient",
  pending_admin: "Pending admin counter-sign",
  completed: "Fully executed",
  void: "Void",
};

/** What a field or checkbox group holds: text for a field, the ticked option ids for a group. */
export type PacketValues = Record<string, string | string[]>;

export type SignatureRecord = {
  kind: "draw" | "type";
  /** A PNG data URL when drawn, or the typed name. */
  data: string;
  name: string;
  signedAt: string;
  device?: string;
  ip?: string;
  role: "recipient" | "admin";
};

export type PacketAudit = {
  sentAt?: string;
  sentBy?: string;
  recipientSignedAt?: string;
  adminSignedAt?: string;
  recipientEmail?: string;
  recipientName?: string;
  adminEmail?: string;
  adminName?: string;
  recipientIp?: string;
  recipientDevice?: string;
  adminIp?: string;
  adminDevice?: string;
  /** SHA-256 of the snapshot, the values and both signatures, so the certificate names exactly what was signed. */
  hash?: string;
};

/** The forms a packet can switch on: one per section that carries a formKey. */
export function packetForms(
  template: PdfTemplate,
): { key: string; title: string; optional: boolean }[] {
  return template.blocks.flatMap((block) =>
    block.kind === "section" && block.formKey
      ? [{ key: block.formKey, title: block.title, optional: block.optional !== false }]
      : [],
  );
}

/**
 * The blocks that print for one recipient. A switched-off form takes its section, its fields and everything after it
 * with it, up to the next section — so a form is never half-sent.
 */
export function visibleBlocks(template: PdfTemplate, enabledForms: string[]): TemplateBlock[] {
  const enabled = new Set(enabledForms);
  const blocks: TemplateBlock[] = [];
  let printing = true;
  for (const block of template.blocks) {
    if (block.kind === "section") {
      printing = !block.formKey || !block.optional || enabled.has(block.formKey);
      if (!printing) continue;
    }
    if (printing) blocks.push(block);
  }
  return blocks;
}

/** Every field the recipient fills, in reading order, on the forms that are switched on. */
export function recipientFields(template: PdfTemplate, enabledForms: string[]): FillableField[] {
  return visibleBlocks(template, enabledForms).flatMap((block) =>
    block.kind === "fields" && block.role === "recipient" ? block.fields : [],
  );
}

/** Every field the admin fills before sending. */
export function adminFields(template: PdfTemplate): FillableField[] {
  return template.blocks.flatMap((block) =>
    block.kind === "fields" && block.role === "admin" ? block.fields : [],
  );
}

/** Checkbox groups the recipient ticks, on the forms that are switched on. */
export function recipientCheckboxes(
  template: PdfTemplate,
  enabledForms: string[],
): { block: Extract<TemplateBlock, { kind: "checkboxes" }> }[] {
  return visibleBlocks(template, enabledForms).flatMap((block) =>
    block.kind === "checkboxes" && block.role === "recipient" ? [{ block }] : [],
  );
}

/** True when the recipient's signature block is required: every recipient signature on a switched-on form is. */
export function recipientNeedsSignature(template: PdfTemplate, enabledForms: string[]): boolean {
  return visibleBlocks(template, enabledForms).some(
    (block) => block.kind === "signature" && block.role === "recipient",
  );
}

/** How far the recipient has got, for the progress bar and the server's own check. */
export function packetProgress(
  template: PdfTemplate,
  enabledForms: string[],
  values: PacketValues,
): { required: number; done: number } {
  const fields = recipientFields(template, enabledForms).filter((f) => f.required);
  const groups = recipientCheckboxes(template, enabledForms).filter(({ block }) => block.required);
  const sign = recipientNeedsSignature(template, enabledForms);
  const required = fields.length + groups.length + (sign ? 1 : 0);
  let done = 0;
  for (const field of fields) if ((values[field.id] as string | undefined)?.trim()) done++;
  for (const { block } of groups) if ((values[block.id] as string[] | undefined)?.length) done++;
  if (sign && values["__signature"]) done++;
  return { required, done: Math.min(done, required) };
}

/** The reasons a submission is refused, in the words the signing page shows. */
export function packetProblems(
  template: PdfTemplate,
  enabledForms: string[],
  values: PacketValues,
): string[] {
  const problems: string[] = [];
  for (const field of recipientFields(template, enabledForms)) {
    if (field.required && !(values[field.id] as string | undefined)?.trim()) {
      problems.push(`${field.label} is required.`);
    }
  }
  for (const { block } of recipientCheckboxes(template, enabledForms)) {
    if (block.required && !(values[block.id] as string[] | undefined)?.length) {
      problems.push(`Choose at least one option for ${block.heading}.`);
    }
  }
  if (recipientNeedsSignature(template, enabledForms) && !values["__signature"]) {
    problems.push("Add your signature.");
  }
  return problems;
}

/** A packet's title is its template's name unless the sender names it something else. */
export const packetTitle = (template: PdfTemplate, fallback = "Signature packet") =>
  template.name.trim() || fallback;

export const packetToken = () => crypto.randomUUID();

const field = (
  label: string,
  options: Partial<Omit<FillableField, "label">> = {},
): FillableField => ({
  id: newId(),
  label,
  type: "text",
  role: "recipient",
  required: false,
  ...options,
});

const check = (label: string): CheckOption => ({ id: newId(), label });

const section = (
  title: string,
  subtitle: string,
  formKey?: string,
  optional = true,
): TemplateBlock => ({
  id: newId(),
  kind: "section",
  title,
  subtitle,
  optional,
  ...(formKey ? { formKey } : {}),
});

const clause = (heading: string, body: string): TemplateBlock => ({
  id: newId(),
  kind: "clause",
  heading,
  body,
  help: "",
});

const fields = (
  heading: string,
  list: FillableField[],
  role: FillableField["role"] = "recipient",
): TemplateBlock => ({
  id: newId(),
  kind: "fields",
  heading,
  role,
  fields: list.map((f) => ({ ...f, role })),
});

const boxes = (
  heading: string,
  options: CheckOption[],
  mode: "single" | "multi" = "multi",
  required = false,
): TemplateBlock => ({
  id: newId(),
  kind: "checkboxes",
  heading,
  role: "recipient",
  mode,
  options,
  required,
});

const sign = (heading: string, role: "recipient" | "admin"): TemplateBlock => ({
  id: newId(),
  kind: "signature",
  heading,
  role,
  showDate: true,
});

/**
 * The packet an admin sends on someone's first day. The wording is the company's own policy language; every personal
 * detail, date and system name is a fillable field, so nothing is baked in as if it were decided.
 */
export function internshipPacketTemplate(): PdfTemplate {
  return {
    name: "CTA Internship Onboarding Packet (Forms 1–8)",
    tier: "platinum",
    source: "built",
    blocks: [
      { id: newId(), kind: "header", background: "dark", showTagline: true },
      section(
        "Internship Onboarding Packet",
        "Came Through Audio · Confidential",
        undefined,
        false,
      ),
      clause(
        "Welcome",
        "CAME THROUGH AUDIO\nWE BUILD CAREERS. WE OWN THE SOUND. · CONFIDENTIAL\n\nThis packet covers your internship with Came Through Audio. Read each form, fill in what applies to you, and sign once. Forms that do not apply to your placement can be switched off before this packet is sent.",
      ),
      fields(
        "Intern",
        [
          field("Full legal name", { required: true }),
          field("Preferred name"),
          field("Email", { required: true }),
          field("Phone"),
          field("School or program"),
          field("Program coordinator"),
        ],
        "recipient",
      ),
      fields(
        "Placement (filled by Came Through Audio)",
        [
          field("Start date", { type: "date", role: "admin" }),
          field("End date", { type: "date", role: "admin" }),
          field("Supervisor", { role: "admin" }),
          field("Department", { role: "admin" }),
        ],
        "admin",
      ),
      clause(
        "Quick index",
        "Form 1 — Internship Agreement & Learning Plan\nForm 2 — Confidentiality & Non-Disclosure Agreement (NDA)\nForm 3 — Technology, System Access & Information Security Agreement\nForm 4 — Intellectual Property & Work Product Agreement\nForm 5 — Social Media, Public Communication & Brand Use Policy\nForm 6 — Photo / Video / Likeness Release\nForm 7 — Company Property / Equipment Checkout & Return\nForm 8 — Internship Exit / Offboarding Checklist & Reflection\nOrientation — 40-Minute Follow-Along Sheet",
      ),

      section("Form 1 — Internship Agreement & Learning Plan", "Learning first", "form1"),
      clause(
        "The placement",
        "This internship is a learning placement. Came Through Audio will give you supervised, real work in the areas named below, and you agree to take part in good faith, follow lawful instructions, and keep the team informed when something affects your availability.",
      ),
      fields("Learning plan", [
        field("Learning goals", { type: "textarea", required: true }),
        field("Skills you want to build", { type: "textarea" }),
        field("Days and hours agreed", { required: true }),
        field("Academic credit required?", { required: true }),
      ]),
      boxes(
        "Academic credit",
        [check("Yes"), check("No"), check("Not applicable")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Came Through Audio supervisor", "admin"),

      section(
        "Form 2 — Confidentiality & Non-Disclosure Agreement (NDA)",
        "What stays inside",
        "form2",
      ),
      clause(
        "Confidential information",
        "During your internship you may see material that is not public: unreleased music and metadata, client and artist information, pricing and plans, internal documents and systems. Keep it confidential while you are here and after you leave, use it only for the work you have been asked to do, and do not copy or share it outside the company.",
      ),
      clause(
        "What this does not cover",
        "This does not stop you from discussing your own pay, hours or working conditions, and it does not cover information that is already public or that you are required by law to disclose.",
      ),
      boxes(
        "I have read and agree to the confidentiality terms",
        [check("I agree")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Came Through Audio representative", "admin"),

      section(
        "Form 3 — Technology, System Access & Information Security Agreement",
        "Accounts, devices and access",
        "form3",
      ),
      clause(
        "Access",
        "Came Through Audio may give you accounts and access needed for your work. Use them only for that work, keep your sign-in details to yourself, and tell your supervisor straight away if a device is lost or you think an account has been used by someone else. Access ends when the internship ends.",
      ),
      fields("Systems and access", [
        field("Approved systems", { type: "textarea", required: true }),
        field("Device used", { required: true }),
      ]),
      boxes(
        "I agree to the information security terms",
        [
          check("I agree"),
          check("I will report a lost device or suspected compromise immediately"),
        ],
        "multi",
        true,
      ),
      sign("Intern signature", "recipient"),

      section(
        "Form 4 — Intellectual Property & Work Product Agreement",
        "What you make here",
        "form4",
      ),
      clause(
        "Work product",
        "Work you create for Came Through Audio within your internship — documents, designs, copy, recordings, code and similar material — belongs to the company, and you will sign anything reasonable needed to record that. Nothing in this form takes away work you created before the internship or independently of it.",
      ),
      fields("Prior work", [
        field("Any prior work you are bringing with you (describe, or write none)", {
          type: "textarea",
        }),
      ]),
      boxes("I agree to the work product terms", [check("I agree")], "single", true),
      sign("Intern signature", "recipient"),
      sign("Came Through Audio representative", "admin"),

      section(
        "Form 5 — Social Media, Public Communication & Brand Use Policy",
        "Speaking in public",
        "form5",
      ),
      clause(
        "Brand voice",
        "You may be asked to help with public communication. Only post from company accounts when you have been asked to, follow the brand guide, and do not announce releases, partnerships, client work or internal news before the company does. On your own accounts, you may say you intern here; do not present yourself as speaking for Came Through Audio.",
      ),
      boxes("I have read the public communication policy", [check("I agree")], "single", true),
      sign("Intern signature", "recipient"),

      section(
        "Form 6 — Photo / Video / Likeness Release",
        "Photos, video and your likeness",
        "form6",
      ),
      clause(
        "Release",
        "Came Through Audio may take photos and video during intern activities and use them to describe its internship program — on its website, social channels and printed material — without payment. This is a permission, not an obligation: you can decline now, and you can withdraw it later for future use by writing to the team.",
      ),
      boxes("Permission", [check("I give permission"), check("I decline")], "single", true),
      fields("If a parent or guardian is required", [
        field("Parent / guardian name"),
        field("Relationship"),
      ]),
      sign("Intern signature", "recipient"),
      sign("Parent / guardian signature (if under 18)", "recipient"),

      section(
        "Form 7 — Company Property / Equipment Checkout & Return",
        "Issued and returned",
        "form7",
      ),
      clause(
        "Equipment",
        "Anything issued to you for the internship stays company property. Return each item in the condition you received it, ordinary wear aside, by the date agreed. If something is damaged or lost, tell your supervisor rather than replacing it yourself.",
      ),
      fields("Issued", [
        field("Item and asset tag", { required: true }),
        field("Date issued", { type: "date" }),
        field("Issued by", { role: "admin" }),
      ]),
      fields("Returned", [
        field("Date returned", { type: "date" }),
        field("Condition on return", { type: "textarea" }),
        field("Received by", { role: "admin" }),
      ]),
      sign("Intern signature", "recipient"),
      sign("Came Through Audio representative", "admin"),

      section(
        "Form 8 — Internship Exit / Offboarding Checklist & Reflection",
        "Closing out",
        "form8",
      ),
      clause(
        "Before you go",
        "On your last day, hand back equipment and access, return any company documents, and complete this reflection. Your supervisor confirms the checklist; it is a record of what was finished, not a reference or a promise of employment.",
      ),
      boxes("Offboarding checklist", [
        check("Equipment returned"),
        check("Accounts and access ended"),
        check("Company documents returned"),
        check("Handover notes completed"),
        check("Exit conversation held"),
      ]),
      fields("Reflection", [
        field("What you learned", { type: "textarea" }),
        field("What would have helped", { type: "textarea" }),
      ]),
      sign("Intern signature", "recipient"),
      sign("Came Through Audio supervisor", "admin"),

      section("40-Minute Orientation Follow-Along Sheet", "Timestamped check-off", "orientation"),
      clause(
        "How to use this sheet",
        "Mark each section as the orientation covers it. The timings are a guide for the session, not a deadline.",
      ),
      boxes("Session check-off", [
        check("00–05 · Welcome, mission and how the team works"),
        check("05–15 · Systems access and where work lives"),
        check("15–25 · Communication, hours and who to ask"),
        check("25–32 · Confidentiality, security and brand basics"),
        check("32–38 · Your learning plan and first-week goals"),
        check("38–40 · Questions and next steps"),
      ]),
      fields("Intern", [field("Initials"), field("Notes", { type: "textarea" })]),
      sign("Intern signature", "recipient"),
      sign("Orientation lead", "admin"),
      { id: newId(), kind: "seal", tier: "platinum", label: "CTA VERIFIED" },
    ],
  };
}
