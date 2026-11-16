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
  /** A PNG data URL — drawn, or the typed name set in cursive — or, on older packets, the typed name itself. */
  data: string;
  name: string;
  /** How large the signer wants it on the line, for names that need the room. */
  size?: "sm" | "md" | "lg" | undefined;
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
 * The forms a packet actually sends with (founder, 2026-11-16). A template can be a single letter or agreement with no
 * switchable forms at all, and that document still goes out whole: the empty list is only a mistake when the template
 * offered forms and none were kept. A key the snapshot doesn't have is dropped, so a library tab left open while the
 * template changed underneath it can't switch on a form that no longer exists.
 */
export function packetSendForms(
  template: PdfTemplate,
  requested: string[],
): { forms: string[]; error: string | null } {
  const keys = packetForms(template).map((form) => form.key);
  if (!keys.length) return { forms: [], error: null };
  const forms = requested.filter((key) => keys.includes(key));
  return { forms, error: forms.length ? null : "Keep at least one form in the packet." };
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

const sign = (heading: string, role: "recipient" | "admin", noStamp = false): TemplateBlock => ({
  id: newId(),
  kind: "signature",
  heading,
  role,
  showDate: true,
  ...(noStamp ? { noStamp: true } : {}),
});

/**
 * The packet an admin sends on someone's first day. The wording is the company's own policy language; every personal
 * detail, date and system name is a fillable field, so nothing is baked in as if it were decided.
 */
/**
 * The packet an admin sends on someone's first day. The wording is the company's own onboarding document; every personal
 * detail, date, name and system is a fillable field, so nothing is baked in as if it were decided.
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
        "Forms 1–8 + 40-Minute Orientation Follow-Along",
        undefined,
        false,
      ),
      clause(
        "Internal business document",
        "Complete only the forms that apply to the internship. The intern reads each form, fills in the parts that belong to them and signs once at the end. Came Through Audio completes the placement details, the equipment record and the company signatures.\n\nCAME THROUGH AUDIO • WE BUILD CAREERS. WE OWN THE SOUND. • CONFIDENTIAL",
      ),
      clause(
        "Quick index",
        "Form 1 — Internship Agreement & Learning Plan\nForm 2 — Confidentiality & Non-Disclosure Agreement (NDA)\nForm 3 — Technology, System Access & Information Security Agreement\nForm 4 — Intellectual Property & Work Product Agreement\nForm 5 — Social Media, Public Communication & Brand Use Policy\nForm 6 — Photo / Video / Likeness Release\nForm 7 — Company Property / Equipment Checkout & Return\nForm 8 — Internship Exit / Offboarding Checklist\nOrientation Follow-Along Sheet",
      ),
      fields(
        "Placement (filled by Came Through Audio)",
        [
          field("Internship start date", { type: "date", role: "admin" }),
          field("End date", { type: "date", role: "admin" }),
          field("Primary supervisor", { role: "admin" }),
          field("Expected schedule / hours", { role: "admin" }),
          field("Compensation status", { role: "admin" }),
        ],
        "admin",
      ),

      section("Form 1 — Internship Agreement & Learning Plan", "Learning first", "form1"),
      clause(
        "Purpose",
        "This agreement documents the educational internship relationship between Came Through Audio (“Company”) and the Intern. It is intended to establish expectations, learning objectives, supervision, confidentiality, access, and professional conduct. It does not replace applicable federal, state, or local law. If the internship is unpaid, the Company should have the arrangement reviewed by qualified employment counsel before use.",
      ),
      fields("Intern information", [
        field("Intern full legal name", { required: true }),
        field("School / program (if applicable)"),
        field("Email", { required: true }),
        field("Phone"),
        field("Volunteer hours letter (if applicable)"),
      ]),
      boxes(
        "Academic credit required?",
        [check("Yes"), check("No"), check("Not applicable")],
        "single",
        true,
      ),
      boxes("Educational objectives", [
        check("Music production / studio workflow"),
        check("Artist development"),
        check("Label and music-business operations"),
        check("Song registration, metadata, ISRC/UPC and distribution workflow"),
        check("Marketing, content and social media"),
        check("Beat licensing and client workflow"),
        check("Copyright / rights / royalty concepts"),
        check("Project management and professional communication"),
        check("Other (describe in the learning goals below)"),
      ]),
      fields("Learning plan", [
        field("Intern’s primary learning goals", { type: "textarea", required: true }),
      ]),
      clause(
        "Role & supervision",
        "The Intern will perform only duties assigned or approved by the Company and will receive appropriate supervision and feedback. The Intern may ask questions whenever an assignment, access level, client request, or instruction is unclear.",
      ),
      boxes("Professional expectations", [
        check("Be punctual and prepared."),
        check("Communicate promptly about absences, delays, or problems."),
        check("Treat artists, clients, vendors, coworkers, and visitors respectfully."),
        check("Protect confidential information and company property."),
        check(
          "Do not represent the Company or make commitments on its behalf without authorization.",
        ),
        check("Follow file, technology, studio, safety, and communication procedures."),
        check(
          "Ask before accessing, copying, downloading, sending, photographing, posting, or sharing information when unsure.",
        ),
      ]),
      clause(
        "Acknowledgment",
        "I understand that this internship is an educational opportunity and that the actual legal classification of an internship depends on applicable law and the facts of the relationship, not solely on the title of this document.\n\nI have received an explanation of my learning objectives, supervision, schedule, and expectations. I agree to follow the Company’s written policies and procedures provided to me.",
      ),
      boxes(
        "Form 1 acknowledgment",
        [check("I understand and agree to the terms of Form 1.")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "Form 2 — Confidentiality & Non-Disclosure Agreement (NDA)",
        "What stays inside",
        "form2",
      ),
      clause(
        "Agreement",
        "The Intern understands that, during the internship, the Intern may receive or observe confidential or proprietary information belonging to Came Through Audio, its artists, clients, vendors, partners, or other parties. The Intern agrees to use such information only for authorized internship purposes and to protect it from unauthorized access, use, disclosure, copying, or publication.",
      ),
      boxes("Examples of confidential information", [
        check("Unreleased songs, beats, recordings, stems, sessions, lyrics or compositions"),
        check(
          "Artist/client names, contact information, project details or private communications",
        ),
        check(
          "Contracts, split sheets, royalty information, publishing information or negotiations",
        ),
        check("Pricing, proposals, customer information, financial information or business plans"),
        check("Passwords, credentials, access codes and internal systems"),
        check("Marketing strategies, release plans, internal workflows and proprietary templates"),
        check("Trade secrets or other information reasonably understood to be confidential"),
        check(
          "Any information marked “confidential” or that a reasonable person would understand to be private",
        ),
      ]),
      clause(
        "Intern obligations",
        "• I will not disclose confidential information to any person outside the Company unless specifically authorized in writing.\n• I will not upload Company or client information to personal cloud storage, personal email, public AI tools, public websites, social media, messaging groups, or other unauthorized services.\n• I will not screenshot, photograph, record, copy, download, forward, or retain confidential information except as specifically authorized.\n• I will immediately report suspected loss, unauthorized access, accidental disclosure, or misdirected communication to my supervisor.\n• Upon request or at the end of the internship, I will return or securely delete confidential information as directed, subject to any lawful record-retention requirement.",
      ),
      clause(
        "Exclusions",
        "Confidential information does not include information that the Intern can demonstrate was lawfully public before disclosure, becomes public through no breach of this agreement, or was lawfully known to the Intern without a confidentiality obligation. Nothing in this agreement is intended to prevent disclosures protected or required by law.",
      ),
      clause(
        "Duration",
        "The confidentiality obligations apply during the internship and continue afterward to the extent permitted by applicable law and for as long as the information remains confidential or protected.",
      ),
      fields("Intern name on this agreement", [field("Intern name")]),
      boxes(
        "Form 2 acknowledgment",
        [check("I have read and agree to the confidentiality terms.")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "Form 3 — Technology, System Access & Information Security Agreement",
        "Accounts, devices and access",
        "form3",
      ),
      clause(
        "Purpose",
        "This form documents safe use of Company technology, accounts, files, systems, devices, and credentials.",
      ),
      boxes("Access rules", [
        check("I will use only accounts and systems for which I have been authorized."),
        check(
          "I will not share passwords, authentication codes, security keys, or login sessions.",
        ),
        check("I will not use another person’s account or allow another person to use mine."),
        check(
          "I will not attempt to bypass permissions, security controls, paywalls, access restrictions, or monitoring.",
        ),
        check(
          "I will not install software, plugins, extensions, or utilities on Company devices without approval.",
        ),
        check("I will not connect unknown USB drives or storage devices to Company systems."),
        check(
          "I will not transfer Company files to personal devices or personal cloud storage without approval.",
        ),
        check("I will not use Company credentials for personal accounts or services."),
        check("I will lock or sign out of devices when leaving them unattended."),
        check(
          "I will promptly report a lost device, suspicious message, accidental disclosure, or suspected security incident.",
        ),
      ]),
      clause(
        "Least privilege / need to know",
        "I understand that access is granted based on my assigned responsibilities. Having access to one folder, project, or system does not mean I am authorized to access other Company information.",
      ),
      fields(
        "Access assigned by Came Through Audio",
        [
          field("Approved systems / folders", { type: "textarea", role: "admin" }),
          field("Restricted systems / folders (if applicable)", {
            type: "textarea",
            role: "admin",
          }),
        ],
        "admin",
      ),
      clause(
        "End of access",
        "I understand that the Company may change, suspend, or revoke access when business needs, security concerns, or the end of the internship require it. I will return Company devices and follow instructions concerning deletion or return of Company information.",
      ),
      boxes(
        "Form 3 acknowledgment",
        [check("I agree to the access rules and information security terms.")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section("Form 4 — Intellectual Property & Work Product Agreement", "Who owns what", "form4"),
      clause(
        "Purpose",
        "This form addresses ownership and permitted use of materials created, modified, or contributed to during the internship. Specific ownership can depend on the nature of the work and applicable law, so the Company should have this form reviewed by counsel for the internship structure being used.",
      ),
      boxes("Work product examples", [
        check("Social media graphics and marketing assets"),
        check("Research, databases, spreadsheets and reports"),
        check("Written copy, captions, scripts and business documents"),
        check("Templates, workflows and organizational systems"),
        check("Photos, videos or other media created for Company purposes"),
        check("Other creative or operational materials"),
      ]),
      clause(
        "Company and client materials",
        "I understand that Company materials and client materials remain subject to the applicable ownership, license, contract, and confidentiality terms. I will not claim ownership of an artist’s music, recording, artwork, brand, lyrics, beat, session, or other property merely because I had access to it during the internship.",
      ),
      clause(
        "Intern-created work",
        "For work specifically commissioned, assigned, or created for Company purposes, the parties intend that ownership and permitted use will be determined by the written agreement and applicable law. I will provide the Company with copies of assigned work and will not intentionally withhold or delete project files.",
      ),
      fields("Personal pre-existing materials brought into the internship", [
        field("Pre-existing materials", { type: "textarea" }),
      ]),
      clause(
        "Portfolio and personal use",
        "I understand that I may not publish, display, submit, sell, license, or use Company or client materials in a portfolio, reel, social media post, website, school project, competition, or other public/private use without prior written approval.",
      ),
      boxes(
        "Portfolio use approved by the Company?",
        [check("Yes"), check("No"), check("Case-by-case")],
        "single",
        true,
      ),
      fields("Additional terms", [field("Additional terms (if any)", { type: "textarea" })]),
      boxes("Form 4 acknowledgment", [check("I agree to the work product terms.")], "single", true),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "Form 5 — Social Media, Public Communication & Brand Use Policy",
        "What can be said, and where",
        "form5",
      ),
      clause(
        "Core rule",
        "Working with Came Through Audio does not automatically give an Intern permission to post or publicly discuss Company work, artists, clients, releases, studio activity, or internal information.",
      ),
      boxes("Prohibited without written approval", [
        check(
          "Posting unreleased music, beats, stems, lyrics, sessions, artwork or release information",
        ),
        check(
          "Posting screenshots or photographs of Company systems, contracts, schedules, databases or messages",
        ),
        check("Filming artists, clients, sessions, meetings, or visitors without permission"),
        check(
          "Announcing partnerships, releases, pricing, business decisions, or client relationships",
        ),
        check(
          "Using the Came Through Audio name, logo, trademarks, brand assets, or likeness as though authorized",
        ),
        check("Speaking to media or making public statements on behalf of the Company"),
        check("Tagging artists or clients in connection with confidential projects"),
        check(
          "Sharing internal disagreements, private conversations, or non-public business information",
        ),
      ]),
      clause(
        "Authorized content",
        "I may create or publish Company-related content only within the scope specifically approved by my supervisor. Approval may be project-specific and may be withdrawn before publication.",
      ),
      fields("Approved platforms / content scope", [
        field("Approved platforms and content scope", { type: "textarea" }),
      ]),
      clause(
        "Brand representation",
        "When identifying myself as an Intern or participant with Came Through Audio, I will communicate professionally and will not imply that I have authority to negotiate, sign agreements, release music, quote binding prices, or make commitments for the Company unless specifically authorized.",
      ),
      boxes(
        "Form 5 acknowledgment",
        [check("I have read and agree to the public communication policy.")],
        "single",
        true,
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "Form 6 — Photo / Video / Likeness Release",
        "Permission to capture and use",
        "form6",
      ),
      clause(
        "Purpose",
        "This release is intended for situations where Came Through Audio may photograph or record an Intern for Company marketing, educational, behind-the-scenes, website, social media, promotional, or archival purposes.",
      ),
      fields("Intern", [field("Intern name")]),
      clause(
        "Permission",
        "I grant Came Through Audio permission to photograph, record, and/or otherwise capture my image, voice, name, and likeness during approved Company activities for the purposes described above. If I agree, I understand that content may appear on Company-controlled websites, social media, promotional materials, presentations, or similar channels.",
      ),
      boxes(
        "My choice",
        [
          check("I AGREE to the use described above."),
          check("I DO NOT AGREE to the use described above."),
        ],
        "single",
        true,
      ),
      boxes("Limitations / special instructions", [
        check("No name used"),
        check("No voice used"),
        check("No identifiable image used"),
      ]),
      fields("Specific limitation", [field("Specific limitation (if any)", { type: "textarea" })]),
      clause(
        "Release",
        "To the extent permitted by law, I release Came Through Audio and its authorized representatives from claims arising solely from authorized use of the materials consistent with this release. This release does not authorize use of confidential or client materials that have not separately been approved.",
      ),
      sign("Intern signature", "recipient"),
      sign("Parent/Guardian signature (if required)", "recipient", true),
      sign("Company representative", "admin"),

      section(
        "Form 7 — Company Property / Equipment Checkout & Return",
        "Issue, then return",
        "form7",
      ),
      clause(
        "Instructions",
        "Complete this form whenever Company property is issued to an Intern. Update the condition and return section when the property is returned.",
      ),
      fields(
        "Issued property (filled by Came Through Audio)",
        [
          field("Item / equipment", { role: "admin" }),
          field("Brand / model", { role: "admin" }),
          field("Serial / asset number", { role: "admin" }),
          field("Accessories included", { role: "admin" }),
          field("Date issued", { type: "date", role: "admin" }),
          field("Expected return", { type: "date", role: "admin" }),
          field("Condition at issue", { role: "admin" }),
        ],
        "admin",
      ),
      clause(
        "Intern acknowledgment",
        "I acknowledge receipt of the property listed above. I will use it for authorized purposes, take reasonable care of it, and promptly report loss, theft, damage, malfunction, or unauthorized use. I will not loan, sell, modify, or transfer Company property without permission.",
      ),
      boxes(
        "Form 7 acknowledgment",
        [check("I acknowledge receipt of the property described above.")],
        "single",
        true,
      ),
      fields(
        "Return record (filled by Came Through Audio)",
        [
          field("Date returned", { type: "date", role: "admin" }),
          field("Condition at return", { role: "admin" }),
          field("Missing / damage notes", { type: "textarea", role: "admin" }),
          field("Returned to", { role: "admin" }),
        ],
        "admin",
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "Form 8 — Internship Exit / Offboarding Checklist",
        "Complete on the final day",
        "form8",
      ),
      clause(
        "End of access",
        "Complete on the final day of the internship, before access is closed.",
      ),
      boxes("Offboarding checklist", [
        check("Final project assignments reviewed"),
        check("Outstanding tasks transferred or completed"),
        check("Company equipment returned"),
        check("Keys / access cards returned"),
        check("Company email access disabled"),
        check("Drive / cloud / project-management access disabled"),
        check("Studio / facility access disabled"),
        check("Shared credentials reviewed / changed where appropriate"),
        check("Company files returned"),
        check("Company files removed from personal devices/clouds as directed"),
        check("Confidential information reminder completed"),
        check("Portfolio / public-use permissions reviewed"),
        check("Expense / reimbursement items resolved (if applicable)"),
        check("School / academic documentation completed (if applicable)"),
      ]),
      fields("Intern exit reflection", [
        field("What did you learn?", { type: "textarea" }),
        field("What was your strongest contribution?", { type: "textarea" }),
        field("What would you improve?", { type: "textarea" }),
        field("What would you like to learn next?", { type: "textarea" }),
      ]),
      clause(
        "Continuing obligations",
        "I understand that confidentiality, intellectual-property, information-security, and other obligations that by their terms continue after the internship remain applicable after my access to Company systems ends.",
      ),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      section(
        "40-Minute Orientation Follow-Along Sheet",
        "Intern copy • check boxes and write notes as we go",
        "orientation",
      ),
      fields("Orientation", [field("Intern name"), field("Date of orientation", { type: "date" })]),

      clause(
        "0–5 MIN | Welcome + the Came Through Audio mission",
        "• Welcome interns and introduce yourself / leadership.\n• Explain what Came Through Audio does.\n• Explain the mission: WE BUILD CAREERS. WE OWN THE SOUND.\n• Explain how label services, music production, beat licensing and artist development fit together.\n• Explain why the internship exists: learning the real workflow behind a music business.",
      ),
      boxes("Orientation check-off — welcome", [
        check("Welcome and introductions complete"),
        check("Mission explained"),
        check("How the services fit together explained"),
        check("Why the internship exists explained"),
      ]),
      fields("Notes — welcome", [field("Notes", { type: "textarea" })]),

      clause(
        "5–10 MIN | What you will learn",
        "Music production / studio workflow • Artist development • Label operations • Music-business administration • Registration, metadata, ISRC/UPC and distribution • Marketing, content and social media • Beat licensing / client workflow • Rights, royalties and copyright concepts • Project management / professional communication",
      ),
      boxes("Orientation check-off — learning areas", [
        check("Music production / studio workflow"),
        check("Artist development"),
        check("Label operations"),
        check("Music-business administration"),
        check("Registration, metadata, ISRC/UPC and distribution"),
        check("Marketing, content and social media"),
        check("Beat licensing / client workflow"),
        check("Rights, royalties and copyright concepts"),
        check("Project management / professional communication"),
      ]),
      fields("My top 3 learning goals", [
        field("Learning goal 1"),
        field("Learning goal 2"),
        field("Learning goal 3"),
      ]),

      clause(
        "10–15 MIN | Culture + professional expectations",
        "• Be on time and prepared.\n• Communicate early when something changes.\n• Treat everyone respectfully.\n• Ask questions instead of guessing.\n• Meet deadlines or communicate before a deadline is missed.\n• Protect Company/client information.\n• Do not promise clients anything without authorization.\n• Do not represent yourself as speaking for Came Through Audio without authorization.",
      ),
      boxes("Orientation check-off — culture", [
        check("On time and prepared"),
        check("Communicate early"),
        check("Respect for everyone"),
        check("Ask instead of guessing"),
        check("Deadlines and early notice"),
        check("Protect information"),
        check("No promises to clients"),
        check("No speaking for the Company"),
      ]),
      fields("The standard I heard today", [field("The standard I heard today")]),

      clause(
        "15–22 MIN | Confidentiality",
        "• Unreleased music is private.\n• Artist/client information is private.\n• Contracts, splits and royalty information are private.\n• Pricing, financial information and business strategy are private.\n• Passwords and access credentials are private.\n• Screenshots, photos, downloads and forwarding require authorization.\n• When unsure: ASK FIRST.",
      ),
      boxes("Orientation check-off — confidentiality", [
        check("Unreleased music stays private"),
        check("Artist/client information stays private"),
        check("Contracts, splits and royalties stay private"),
        check("Pricing and strategy stay private"),
        check("Passwords and credentials stay private"),
        check("Screenshots, photos, downloads need authorization"),
        check("When unsure, ask first"),
      ]),
      fields("One thing I will remember", [field("One thing I will remember")]),

      clause(
        "22–26 MIN | Technology + access",
        "• Use only the accounts/systems you are authorized to use.\n• Never share passwords or authentication codes.\n• Do not move files to personal cloud storage without approval.\n• Do not install software/plugins without approval.\n• Report suspicious activity, lost devices or accidental disclosures.\n• Access is based on need-to-know.",
      ),
      boxes("Orientation check-off — technology", [
        check("Authorized accounts only"),
        check("No sharing passwords or codes"),
        check("No personal cloud without approval"),
        check("No unapproved software"),
        check("Report incidents and lost devices"),
        check("Access is need-to-know"),
      ]),
      fields("What systems will I use?", [field("Systems I will use", { type: "textarea" })]),

      clause(
        "26–30 MIN | Intellectual property",
        "• Understand the difference between Company property and client/artist property.\n• Do not claim ownership of music merely because you accessed it.\n• Assigned work may be subject to the written work-product terms.\n• Do not put Company/client material in a portfolio without approval.",
      ),
      boxes("Orientation check-off — intellectual property", [
        check("Company and client property are different"),
        check("Access is not ownership"),
        check("Assigned work follows the written terms"),
        check("No portfolio use without approval"),
      ]),
      fields("Question I have about ownership", [
        field("Question about ownership", { type: "textarea" }),
      ]),

      clause(
        "30–34 MIN | Communication + workflow",
        "• Assignment → Instructions → Deadline → Work → Review → Revision → Approval → Completion.\n• Know who assigns work.\n• Know who approves work.\n• Store files where instructed.\n• Use consistent file names.\n• Ask for clarification when needed.",
      ),
      boxes("Orientation check-off — workflow", [
        check("Know the workflow stages"),
        check("Know who assigns work"),
        check("Know who approves work"),
        check("Store files where instructed"),
        check("Use consistent file names"),
        check("Ask for clarification"),
      ]),
      fields("How I should ask for help", [field("How I should ask for help")]),

      clause(
        "34–37 MIN | Safety, boundaries + representation",
        "• No unauthorized releases or uploads.\n• No contract negotiation unless specifically authorized.\n• No legal/financial advice on behalf of the Company.\n• No public statements for the Company without approval.\n• No unauthorized filming or posting.\n• Protect people, property, files and the brand.",
      ),
      boxes("Orientation check-off — boundaries", [
        check("No unauthorized releases or uploads"),
        check("No contract negotiation"),
        check("No legal or financial advice"),
        check("No public statements without approval"),
        check("No unauthorized filming or posting"),
        check("Protect people, property, files and the brand"),
      ]),

      clause(
        "37–40 MIN | Questions + sign-off",
        "Ask: What are you hoping to learn? • What area of the music business interests you most? • What skill do you want to leave with? Confirm Forms 1–8 are completed as applicable, then confirm the access level and the first assignment.",
      ),
      fields("First assignment and sign-off", [
        field("My first assignment", { type: "textarea" }),
        field("Supervisor"),
        field("Due date", { type: "date" }),
        field("Intern initials"),
      ]),
      boxes("Orientation completion", [
        check("I attended the orientation and had an opportunity to ask questions."),
        check("I understand that confidential Company/client information must be protected."),
        check("I understand that access is limited to what I am authorized to use."),
        check(
          "I must ask before posting, sharing, copying, downloading, photographing, or releasing Company/client information.",
        ),
        check("I know who my supervisor is and how to ask for help."),
      ]),
      sign("Intern signature", "recipient"),
      sign("Company representative", "admin"),

      { id: newId(), kind: "seal", tier: "platinum", label: "CTA VERIFIED" },
    ],
  };
}
