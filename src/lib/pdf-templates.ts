/**
 * Template Studio (founder, 2026-11-15): the model behind Admin → PDF Tools → Template Studio.
 *
 * A template is a list of blocks in reading order — a brand header, a metadata grid, clauses, signature lines and an
 * optional certification seal — plus typed tokens like {{ARTIST_NAME}}. Everything that decides how a document looks or reads lives
 * here as pure functions, so the canvas, the live preview, the preflight bar and the exported HTML all agree, and the
 * rules can be tested without a browser.
 */

/** The brand palette, exactly as the design system names it. */
export const BRAND = {
  cobalt: "#004AAD",
  black: "#0b0b0b",
  white: "#FFFFFF",
  electric: "#4D8CFF",
  gold: "#FFD700",
  platinum: "#E5E4E2",
} as const;

export const TAGLINE = "YOUR FIRST STOP BEFORE DISTRIBUTION";

export const TEMPLATE_TIERS = ["standard", "gold", "platinum"] as const;
export type TemplateTier = (typeof TEMPLATE_TIERS)[number];

export const TIER_LABELS: Record<TemplateTier, string> = {
  standard: "Standard",
  gold: "Gold",
  platinum: "Platinum",
};

/** Gold and platinum are the only metals; a standard template carries none. */
export const TIER_METAL: Record<TemplateTier, string | null> = {
  standard: null,
  gold: BRAND.gold,
  platinum: BRAND.platinum,
};

export type HeaderBackground = "light" | "dark";

/** Who fills a field: the person signing, or the admin preparing the packet. */
export type FieldRole = "recipient" | "admin";

export type FillableField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "date";
  role: FieldRole;
  required?: boolean;
};

export type CheckOption = { id: string; label: string };

export type TemplateBlock =
  | { id: string; kind: "header"; background: HeaderBackground; showTagline: boolean }
  | {
      id: string;
      kind: "meta";
      heading: string;
      rows: { id: string; label: string; value: string }[];
    }
  | { id: string; kind: "clause"; heading: string; body: string; help: string }
  | { id: string; kind: "signatures"; heading: string; parties: { id: string; label: string }[] }
  | { id: string; kind: "seal"; tier: "gold" | "platinum"; label: string }
  /** A packet form (Form 1, Form 2…) with its own page break, listed in the Quick Index and toggled per recipient. */
  | {
      id: string;
      kind: "section";
      title: string;
      subtitle: string;
      /** Matching `formKey` on a section makes the form switchable; the cover has none and always prints. */
      formKey?: string;
      optional?: boolean;
    }
  /** Text lines the recipient (or the admin) fills on the signing page and in the final PDF. */
  | { id: string; kind: "fields"; heading: string; role: FieldRole; fields: FillableField[] }
  /** Clickable boxes, one choice or several, ticked by whoever fills the form. */
  | {
      id: string;
      kind: "checkboxes";
      heading: string;
      role: FieldRole;
      mode: "single" | "multi";
      required?: boolean;
      options: CheckOption[];
    }
  /** A drawn or typed signature with its date, from the recipient or the company representative. */
  | {
      id: string;
      kind: "signature";
      heading: string;
      role: FieldRole;
      showDate: boolean;
      /** A line someone signs in person, so the intern's signature is never stamped on it. */
      noStamp?: boolean;
    };

export type TemplateBlockKind = TemplateBlock["kind"];

export type PdfTemplate = {
  id?: string;
  name: string;
  tier: TemplateTier;
  blocks: TemplateBlock[];
  source?: "built" | "converted";
  updatedAt?: string;
  createdBy?: string;
};

/** The token library, in the order the pills are offered. */
export const TOKENS = [
  { key: "ARTIST_NAME", label: "Artist name", sample: "Karma Came" },
  { key: "LEGAL_NAME", label: "Legal name", sample: "Qui-Ona Peterson" },
  { key: "TRACK_TITLE", label: "Track title", sample: "Roll Out" },
  { key: "ISRC_CODE", label: "ISRC code", sample: "US-CTA-26-00001" },
  { key: "UPC_CODE", label: "UPC code", sample: "195589000001" },
  { key: "ROYALTY_SPLIT_PCT", label: "Royalty split", sample: "50%" },
  { key: "RELEASE_DATE", label: "Release date", sample: "15 November 2026" },
  { key: "CERTIFICATION_TIER", label: "Certification tier", sample: "Gold" },
  { key: "PRO_NAME", label: "PRO", sample: "BMI" },
  { key: "IPI_NUMBER", label: "IPI number", sample: "00512345678" },
  { key: "PUBLISHER", label: "Publisher", sample: "Came Through Music" },
  { key: "LABEL_NAME", label: "Label", sample: "Came Through Audio" },
  { key: "PRODUCER", label: "Producer", sample: "Karma Came" },
] as const;

export type TokenKey = (typeof TOKENS)[number]["key"];

export const SAMPLE_DATA = Object.fromEntries(TOKENS.map((t) => [t.key, t.sample])) as Record<
  TokenKey,
  string
>;

/** True for a token this studio knows; anything else in a template is reported by the preflight bar. */
export const isTokenKey = (value: string): value is TokenKey => TOKENS.some((t) => t.key === value);

/** Every `{{TOKEN}}` in a piece of text, in the order they appear. */
export function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!);
}

/** Replaces tokens with real values; a token with no value is left visible, so a gap is never mistaken for content. */
export function fillTokens(text: string, data: Record<string, string> = SAMPLE_DATA): string {
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (whole, name: string) => data[name] ?? whole);
}

/** An unknown token anywhere in the template, named once. */
export function unknownTokens(template: PdfTemplate): string[] {
  const found = new Set<string>();
  for (const block of template.blocks) {
    const text =
      block.kind === "meta"
        ? block.rows.map((r) => `${r.label} ${r.value}`).join(" ")
        : block.kind === "clause"
          ? `${block.heading} ${block.body} ${block.help}`
          : block.kind === "signatures"
            ? `${block.heading} ${block.parties.map((p) => p.label).join(" ")}`
            : block.kind === "seal"
              ? block.label
              : block.kind === "section"
                ? `${block.title} ${block.subtitle}`
                : block.kind === "fields"
                  ? `${block.heading} ${block.fields.map((f) => f.label).join(" ")}`
                  : block.kind === "checkboxes"
                    ? `${block.heading} ${block.options.map((o) => o.label).join(" ")}`
                    : block.kind === "signature"
                      ? block.heading
                      : "";
    for (const token of tokensIn(text)) if (!isTokenKey(token)) found.add(token);
  }
  return [...found];
}

export const newId = () => Math.random().toString(36).slice(2, 10);

/** WCAG relative luminance, so the contrast check is the real formula rather than a guess. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The AA formula: (lighter + 0.05) / (darker + 0.05). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The two colours of the wordmark on a header, following the logo contrast rule. */
export function headerInk(background: HeaderBackground) {
  return background === "light"
    ? { name: BRAND.black, audio: BRAND.cobalt, surface: BRAND.white }
    : { name: BRAND.white, audio: BRAND.electric, surface: BRAND.black };
}

export type PreflightCheck = { id: string; label: string; ok: boolean; detail: string };

/**
 * The bottom bar's checks. A check never blocks typing; it says what a printed page still needs, and the Save button
 * only refuses a template that failed the two things a document can't do without: a name and a header.
 */
export function preflight(template: PdfTemplate): PreflightCheck[] {
  const header = template.blocks.find((b) => b.kind === "header");
  const ink = headerInk(header && header.kind === "header" ? header.background : "light");
  const ratio = Math.min(
    contrastRatio(ink.name, ink.surface),
    contrastRatio(ink.audio, ink.surface),
  );
  const blocksOk = template.blocks.every((block) => {
    if (block.kind === "clause") return block.body.trim().length > 0;
    if (block.kind === "meta")
      return block.rows.length > 0 && block.rows.every((r) => r.label.trim() && r.value.trim());
    if (block.kind === "signatures")
      return block.parties.length > 0 && block.parties.every((p) => p.label.trim());
    if (block.kind === "seal") return block.label.trim().length > 0;
    if (block.kind === "fields") return block.fields.every((f) => f.label.trim());
    if (block.kind === "checkboxes") return block.options.every((o) => o.label.trim());
    if (block.kind === "section") return block.title.trim().length > 0;
    return true;
  });
  const unknown = unknownTokens(template);
  const signed = template.blocks.some((b) => b.kind === "signatures");

  return [
    {
      id: "name",
      label: "Template name",
      ok: template.name.trim().length > 0,
      detail: template.name.trim() ? template.name.trim() : "Name it before saving.",
    },
    {
      id: "header",
      label: "Brand header",
      ok: !!header,
      detail: header ? `${ink.name} on ${ink.surface}` : "A document needs the CTA header.",
    },
    { id: "contrast", label: "Logo contrast", ok: ratio >= 4.5, detail: `${ratio.toFixed(1)}:1` },
    {
      id: "blocks",
      label: "Blocks filled",
      ok: blocksOk,
      detail: blocksOk
        ? `${template.blocks.length} block${template.blocks.length === 1 ? "" : "s"}`
        : "A block still has an empty line.",
    },
    {
      id: "tokens",
      label: "Mapped variables",
      ok: unknown.length === 0,
      detail: unknown.length
        ? `Unknown: ${unknown.map((t) => `{{${t}}}`).join(", ")}`
        : "Every token is known.",
    },
    {
      id: "signature",
      label: "Signature lines",
      ok: signed,
      detail: signed ? "Ready to sign" : "No signature block yet.",
    },
  ];
}

/**
 * Save needs what a document can't do without — a name, a header — and no unknown token, because a saved template
 * with `{{NOPE}}` in it would export raw braces to a client.
 */
export function canSaveTemplate(template: PdfTemplate): boolean {
  const checks = preflight(template);
  return (["name", "header", "tokens"] as const).every((id) => checks.find((c) => c.id === id)!.ok);
}

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function blockHtml(block: TemplateBlock): string {
  if (block.kind === "header") {
    const ink = headerInk(block.background);
    return `<header style="background:${ink.surface};padding:40px 48px;border-bottom:3px solid ${BRAND.cobalt}">
  <div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;color:${ink.name}">Came Through <span style="color:${ink.audio}">Audio</span></div>
  ${block.showTagline ? `<div style="margin-top:8px;font-size:10px;letter-spacing:3px;color:${ink.audio}">${TAGLINE}</div>` : ""}
</header>`;
  }
  if (block.kind === "meta") {
    return `<section style="padding:28px 48px 0">
  <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cobalt};margin:0 0 12px">${esc(fillTokens(block.heading))}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    ${block.rows.map((r) => `<tr><th style="text-align:left;width:38%;padding:8px 0;border-bottom:1px solid ${BRAND.platinum};font-weight:600;color:${BRAND.black}">${esc(r.label)}</th><td style="padding:8px 0;border-bottom:1px solid ${BRAND.platinum};color:${BRAND.black}">${esc(fillTokens(r.value))}</td></tr>`).join("\n    ")}
  </table>
</section>`;
  }
  if (block.kind === "clause") {
    return `<section style="padding:24px 48px 0">
  <h2 style="font-size:15px;color:${BRAND.black};margin:0 0 8px">${esc(fillTokens(block.heading))}</h2>
  <p style="font-size:13px;line-height:1.7;color:${BRAND.black};margin:0">${esc(fillTokens(block.body)).replace(/\n/g, "<br>")}</p>
  ${block.help ? `<p style="font-size:11px;line-height:1.6;color:${BRAND.black};opacity:0.7;margin:8px 0 0;border-left:2px solid ${BRAND.platinum};padding-left:10px">${esc(block.help)}</p>` : ""}
</section>`;
  }
  if (block.kind === "signatures") {
    return `<section style="padding:32px 48px 0">
  <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cobalt};margin:0 0 18px">${esc(block.heading)}</h2>
  ${block.parties.map((p) => `<div style="margin-bottom:22px"><div style="border-bottom:1px solid ${BRAND.black};height:28px"></div><div style="font-size:11px;color:${BRAND.black};opacity:0.7;margin-top:6px">${esc(fillTokens(p.label))}</div></div>`).join("\n  ")}
</section>`;
  }
  if (block.kind === "section") {
    return `<section style="page-break-before:always;padding:34px 48px 0">
  <h2 style="font-size:18px;color:${BRAND.black};margin:0;padding-bottom:10px;border-bottom:2px solid ${BRAND.platinum}">${esc(block.title)}</h2>
  ${block.subtitle ? `<p style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.cobalt};margin:8px 0 0">${esc(block.subtitle)}</p>` : ""}
</section>`;
  }
  if (block.kind === "fields") {
    return `<section style="padding:24px 48px 0">
  <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cobalt};margin:0 0 12px">${esc(fillTokens(block.heading))}</h2>
  ${block.fields
    .map(
      (f) =>
        `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:600;color:${BRAND.black}">${esc(f.label)}${f.required ? " *" : ""}</div><div style="border-bottom:1px solid ${BRAND.platinum};height:${f.type === "textarea" ? 44 : 24}px"></div></div>`,
    )
    .join("\n  ")}
</section>`;
  }
  if (block.kind === "checkboxes") {
    return `<section style="padding:24px 48px 0">
  <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cobalt};margin:0 0 10px">${esc(fillTokens(block.heading))}</h2>
  ${block.options.map((o) => `<div style="font-size:12px;color:${BRAND.black};margin:6px 0">☐&nbsp;&nbsp;${esc(o.label)}</div>`).join("\n  ")}
</section>`;
  }
  if (block.kind === "signature") {
    const who = block.role === "recipient" ? "Recipient" : "Company representative";
    return `<section style="padding:30px 48px 0">
  <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cobalt};margin:0 0 10px">${esc(fillTokens(block.heading))}</h2>
  <div style="display:flex;gap:24px">
    <div style="flex:2"><div style="border-bottom:1px solid ${BRAND.black};height:34px"></div><div style="font-size:10px;color:${BRAND.black};opacity:0.7;margin-top:5px">${who} signature</div></div>
    ${block.showDate ? `<div style="flex:1"><div style="border-bottom:1px solid ${BRAND.black};height:34px"></div><div style="font-size:10px;color:${BRAND.black};opacity:0.7;margin-top:5px">Date</div></div>` : ""}
  </div>
</section>`;
  }
  const metal = block.tier === "gold" ? BRAND.gold : BRAND.platinum;
  return `<section style="padding:28px 48px 0">
  <div style="display:inline-block;border:2px solid ${metal};border-radius:50%;width:96px;height:96px;text-align:center;line-height:92px;font-size:11px;font-weight:700;letter-spacing:1px;color:${BRAND.black}">${esc(fillTokens(block.label))}</div>
  <div style="font-size:10px;letter-spacing:2px;color:${BRAND.black};opacity:0.65;margin-top:8px">CTA CERTIFICATION · ${block.tier.toUpperCase()}</div>
</section>`;
}

/**
 * The three starters (founder, 2026-11-15): a clean split sheet, an executive agreement and a certificate. They are
 * ordinary templates once added, so an admin edits a copy rather than a special case.
 */
export function starterPresets(): PdfTemplate[] {
  return [
    {
      name: "Standard Track Split Sheet",
      tier: "standard",
      blocks: [
        { id: newId(), kind: "header", background: "light", showTagline: true },
        {
          id: newId(),
          kind: "meta",
          heading: "Release details",
          rows: [
            { id: newId(), label: "Track", value: "{{TRACK_TITLE}}" },
            { id: newId(), label: "Artist", value: "{{ARTIST_NAME}}" },
            { id: newId(), label: "ISRC", value: "{{ISRC_CODE}}" },
            { id: newId(), label: "Release date", value: "{{RELEASE_DATE}}" },
          ],
        },
        {
          id: newId(),
          kind: "clause",
          heading: "Writers and splits",
          body: "{{LEGAL_NAME}} ({{PRO_NAME}}, IPI {{IPI_NUMBER}}) receives {{ROYALTY_SPLIT_PCT}} of the writer share of {{TRACK_TITLE}}. Each writer confirms the share above is the whole agreement between them.",
          help: "A split sheet records who owns the song, not who recorded it. Every writer signs the same percentages.",
        },
        {
          id: newId(),
          kind: "signatures",
          heading: "Signatures",
          parties: [
            { id: newId(), label: "{{ARTIST_NAME}} · artist" },
            { id: newId(), label: "{{PRODUCER}} · producer" },
          ],
        },
      ],
    },
    {
      name: "Exclusive Distribution Agreement",
      tier: "platinum",
      blocks: [
        { id: newId(), kind: "header", background: "dark", showTagline: true },
        {
          id: newId(),
          kind: "meta",
          heading: "Agreement parties",
          rows: [
            { id: newId(), label: "Artist", value: "{{ARTIST_NAME}}" },
            { id: newId(), label: "Legal name", value: "{{LEGAL_NAME}}" },
            { id: newId(), label: "Label", value: "{{LABEL_NAME}}" },
            { id: newId(), label: "Track", value: "{{TRACK_TITLE}}" },
            { id: newId(), label: "Release date", value: "{{RELEASE_DATE}}" },
          ],
        },
        {
          id: newId(),
          kind: "clause",
          heading: "Exclusive term",
          body: "{{ARTIST_NAME}} grants {{LABEL_NAME}} the exclusive right to distribute {{TRACK_TITLE}} (ISRC {{ISRC_CODE}}, UPC {{UPC_CODE}}) for the term agreed below. Both parties keep a signed copy.",
          help: "Exclusive means no other distributor may release this recording during the term.",
        },
        {
          id: newId(),
          kind: "clause",
          heading: "Royalties",
          body: "Royalties are paid on net receipts at the split recorded on the attached split sheet: {{ROYALTY_SPLIT_PCT}} to {{ARTIST_NAME}}.",
          help: "Net receipts are what the stores pay after their own share, before any advance is recouped.",
        },
        {
          id: newId(),
          kind: "signatures",
          heading: "Signed by",
          parties: [
            { id: newId(), label: "{{ARTIST_NAME}} · artist" },
            { id: newId(), label: "{{LABEL_NAME}} · label" },
          ],
        },
        { id: newId(), kind: "seal", tier: "platinum", label: "CTA" },
      ],
    },
    {
      name: "Official Streaming Milestone Certificate",
      tier: "gold",
      blocks: [
        { id: newId(), kind: "header", background: "dark", showTagline: true },
        {
          id: newId(),
          kind: "meta",
          heading: "Awarded for",
          rows: [
            { id: newId(), label: "Track", value: "{{TRACK_TITLE}}" },
            { id: newId(), label: "Artist", value: "{{ARTIST_NAME}}" },
            { id: newId(), label: "Tier", value: "{{CERTIFICATION_TIER}}" },
            { id: newId(), label: "Date", value: "{{RELEASE_DATE}}" },
          ],
        },
        {
          id: newId(),
          kind: "clause",
          heading: "Certification",
          body: "This certifies that {{TRACK_TITLE}} by {{ARTIST_NAME}} reached the {{CERTIFICATION_TIER}} milestone. Issued by Came Through Audio, your first stop before distribution.",
          help: "Certificates name the milestone and the date it was reached; they are issued by the company, not by a store.",
        },
        { id: newId(), kind: "seal", tier: "gold", label: "{{CERTIFICATION_TIER}}" },
        {
          id: newId(),
          kind: "signatures",
          heading: "Issued by",
          parties: [{ id: newId(), label: "Came Through Audio · authorised signatory" }],
        },
      ],
    },
  ];
}

/** A standalone branded document, with the sample release filled in — what the preview shows, as a file. */
export function templateToHtml(template: PdfTemplate): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(template.name)}</title>
<style>@page{size:Letter;margin:0}body{margin:0;background:${BRAND.platinum};font-family:Helvetica,Arial,sans-serif}main{background:${BRAND.white};max-width:816px;margin:24px auto;padding-bottom:48px}</style>
</head><body><main>
${template.blocks.map(blockHtml).join("\n")}
<footer style="margin:40px 48px 0;border-top:1px solid ${BRAND.platinum};padding-top:12px;font-size:9px;letter-spacing:2px;color:${BRAND.black};opacity:0.65">CAME THROUGH AUDIO · ${TAGLINE}</footer>
</main></body></html>`;
}
