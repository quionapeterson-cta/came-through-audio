import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FileDown,
  FileJson,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ConfirmHost";
import { saveBlob } from "@/lib/catalog";
import { PdfTemplateConverter } from "@/components/PdfTemplateConverter";
import {
  BRAND,
  TIER_LABELS,
  TIER_METAL,
  TEMPLATE_TIERS,
  TAGLINE,
  TOKENS,
  canSaveTemplate,
  fillTokens,
  headerInk,
  newId,
  preflight,
  starterPresets,
  templateToHtml,
  type PdfTemplate,
  type TemplateBlock,
  type TemplateTier,
} from "@/lib/pdf-templates";
import {
  deletePdfTemplate,
  duplicatePdfTemplate,
  listPdfTemplates,
  savePdfTemplate,
  type SavedTemplate,
} from "@/lib/pdf-templates.functions";
import { templateToPdfBytes } from "@/lib/pdf-template-pdf";

const blank = (): PdfTemplate => ({
  name: "Untitled template",
  tier: "standard",
  blocks: [
    { id: newId(), kind: "header", background: "light", showTagline: true },
    {
      id: newId(),
      kind: "clause",
      heading: "Agreement",
      body: "Write the document's wording here. Insert {{ARTIST_NAME}} and the other variables from the right.",
      help: "",
    },
    {
      id: newId(),
      kind: "signatures",
      heading: "Signatures",
      parties: [{ id: newId(), label: "{{ARTIST_NAME}} · artist" }],
    },
  ],
});

const BLOCK_LABELS: Record<TemplateBlock["kind"], string> = {
  header: "Brand header",
  meta: "Metadata grid",
  clause: "Clause",
  signatures: "Signature lines",
  seal: "Certification seal",
  section: "Packet form",
  fields: "Fillable fields",
  checkboxes: "Checkboxes",
  signature: "Signature block",
};

/** The words a block prints with, so a 100-block packet reads as its forms instead of a column of "Clause". */
function blockName(block: TemplateBlock): string {
  if (block.kind === "header") return BLOCK_LABELS.header;
  if (block.kind === "section") return block.title.trim() || BLOCK_LABELS.section;
  if (block.kind === "seal") return block.label.trim() || BLOCK_LABELS.seal;
  return block.heading.trim() || BLOCK_LABELS[block.kind];
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A token in the page, highlighted in cobalt so a placeholder can never read as real copy. */
function Rich({ text, sample }: { text: string; sample: boolean }) {
  const parts = text.split(/(\{\{\s*[A-Z0-9_]+\s*\}\})/g);
  return (
    <>
      {parts.map((part, index) => {
        const token = /^\{\{\s*([A-Z0-9_]+)\s*\}\}$/.exec(part);
        if (!token) return <span key={index}>{part}</span>;
        if (sample) return <span key={index}>{fillTokens(part)}</span>;
        return (
          <span
            key={index}
            className="mx-0.5 rounded px-1 font-mono text-[0.85em]"
            style={{ background: `${BRAND.cobalt}14`, color: BRAND.cobalt }}
          >
            {`{{${token[1]}}}`}
          </span>
        );
      })}
    </>
  );
}

/** The page itself, in the document's own colours, never the app's dark surface. */
function Paper({
  template,
  sample,
  activeId,
  onSelect,
}: {
  template: PdfTemplate;
  sample: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-sm bg-white shadow-lg ring-1 ring-black/10">
      {template.blocks.map((block) => {
        const selected = block.id === activeId;
        return (
          <div
            key={block.id}
            onClick={() => onSelect(block.id)}
            className={`relative cursor-pointer ${selected ? "ring-2 ring-inset" : "hover:ring-1 hover:ring-inset"}`}
            style={{
              borderColor: BRAND.electric,
              ["--tw-ring-color" as string]: selected ? BRAND.electric : `${BRAND.cobalt}33`,
            }}
          >
            {block.kind === "header" &&
              (() => {
                const ink = headerInk(block.background);
                return (
                  <div
                    style={{
                      background: ink.surface,
                      padding: "36px 44px",
                      borderBottom: `3px solid ${BRAND.cobalt}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: "-0.5px",
                        color: ink.name,
                      }}
                    >
                      Came Through <span style={{ color: ink.audio }}>Audio</span>
                    </div>
                    {block.showTagline ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 9,
                          letterSpacing: "3px",
                          color: ink.audio,
                        }}
                      >
                        {TAGLINE}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            {block.kind === "meta" && (
              <div style={{ padding: "24px 44px 0" }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: BRAND.cobalt,
                    marginBottom: 10,
                  }}
                >
                  <Rich text={block.heading} sample={sample} />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.id}>
                        <th
                          style={{
                            textAlign: "left",
                            width: "38%",
                            padding: "7px 0",
                            borderBottom: `1px solid ${BRAND.platinum}`,
                            color: BRAND.black,
                            fontWeight: 600,
                          }}
                        >
                          {row.label}
                        </th>
                        <td
                          style={{
                            padding: "7px 0",
                            borderBottom: `1px solid ${BRAND.platinum}`,
                            color: BRAND.black,
                          }}
                        >
                          <Rich text={row.value} sample={sample} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {block.kind === "clause" && (
              <div style={{ padding: "22px 44px 0" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.black, marginBottom: 6 }}>
                  <Rich text={block.heading} sample={sample} />
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    color: BRAND.black,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <Rich text={block.body} sample={sample} />
                </p>
                {block.help ? (
                  <p
                    style={{
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: BRAND.black,
                      opacity: 0.7,
                      margin: "8px 0 0",
                      borderLeft: `2px solid ${BRAND.platinum}`,
                      paddingLeft: 10,
                    }}
                  >
                    {block.help}
                  </p>
                ) : null}
              </div>
            )}
            {block.kind === "signatures" && (
              <div style={{ padding: "28px 44px 0" }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: BRAND.cobalt,
                    marginBottom: 14,
                  }}
                >
                  {block.heading}
                </div>
                {block.parties.map((party) => (
                  <div key={party.id} style={{ marginBottom: 18 }}>
                    <div style={{ borderBottom: `1px solid ${BRAND.black}`, height: 26 }} />
                    <div style={{ fontSize: 11, color: BRAND.black, opacity: 0.7, marginTop: 5 }}>
                      <Rich text={party.label} sample={sample} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {block.kind === "section" && (
              <div style={{ padding: "26px 44px 0" }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: BRAND.black,
                    paddingBottom: 8,
                    borderBottom: `2px solid ${BRAND.platinum}`,
                  }}
                >
                  {block.title}
                </div>
                {block.subtitle ? (
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: BRAND.cobalt,
                      marginTop: 7,
                    }}
                  >
                    {block.subtitle}
                  </div>
                ) : null}
                {block.formKey ? (
                  <div style={{ fontSize: 8, color: BRAND.black, opacity: 0.55, marginTop: 5 }}>
                    {block.optional === false ? "Always included" : `Form key · ${block.formKey}`}
                  </div>
                ) : null}
              </div>
            )}
            {block.kind === "fields" && (
              <div style={{ padding: "22px 44px 0" }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: BRAND.cobalt,
                    marginBottom: 10,
                  }}
                >
                  {block.heading} · {block.role === "recipient" ? "recipient fills" : "admin fills"}
                </div>
                {block.fields.map((f) => (
                  <div key={f.id} style={{ marginBottom: 11 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: BRAND.black }}>
                      {f.label}
                      {f.required ? " *" : ""}
                    </div>
                    <div
                      style={{
                        borderBottom: `1px solid ${BRAND.platinum}`,
                        height: f.type === "textarea" ? 30 : 16,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {block.kind === "checkboxes" && (
              <div style={{ padding: "22px 44px 0" }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: BRAND.cobalt,
                    marginBottom: 8,
                  }}
                >
                  {block.heading}
                  {block.required ? " *" : ""}
                </div>
                {block.options.map((o) => (
                  <div
                    key={o.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0" }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        border: `1px solid ${BRAND.black}`,
                      }}
                    />
                    <span style={{ fontSize: 10.5, color: BRAND.black }}>{o.label}</span>
                  </div>
                ))}
              </div>
            )}
            {block.kind === "signature" && (
              <div style={{ padding: "26px 44px 0" }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: BRAND.cobalt,
                    marginBottom: 16,
                  }}
                >
                  {block.heading}
                </div>
                <div style={{ display: "flex", gap: 26 }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ borderBottom: `1px solid ${BRAND.black}`, height: 26 }} />
                    <div style={{ fontSize: 8.5, color: BRAND.black, opacity: 0.7, marginTop: 4 }}>
                      {block.role === "recipient"
                        ? "Recipient signature"
                        : "Company representative"}
                    </div>
                  </div>
                  {block.showDate ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ borderBottom: `1px solid ${BRAND.black}`, height: 26 }} />
                      <div
                        style={{ fontSize: 8.5, color: BRAND.black, opacity: 0.7, marginTop: 4 }}
                      >
                        Date
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {block.kind === "seal" && (
              <div style={{ padding: "24px 44px 0" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxSizing: "border-box",
                    width: 92,
                    height: 92,
                    padding: 10,
                    textAlign: "center",
                    borderRadius: "50%",
                    border: `2px solid ${block.tier === "gold" ? BRAND.gold : BRAND.platinum}`,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: BRAND.black,
                  }}
                >
                  <Rich text={block.label} sample={sample} />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "2px",
                    color: BRAND.black,
                    opacity: 0.65,
                    marginTop: 6,
                  }}
                >
                  CTA CERTIFICATION · {block.tier.toUpperCase()}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div
        style={{
          margin: "32px 44px 0",
          paddingTop: 10,
          borderTop: `1px solid ${BRAND.platinum}`,
          fontSize: 8,
          letterSpacing: "2px",
          color: BRAND.black,
          opacity: 0.65,
        }}
      >
        CAME THROUGH AUDIO · {TAGLINE}
      </div>
      <div style={{ height: 28 }} />
    </div>
  );
}

/**
 * Admin → PDF Tools → Template Studio (founder, 2026-11-15): build a document from blocks or bring an existing PDF in,
 * fill it with typed variables, check it before it prints, and keep it in a shared library with Standard, Gold or
 * Platinum standing. Additive: the fill-and-sign tools above are untouched.
 */
export function PdfTemplateStudio() {
  const [tab, setTab] = useState<"build" | "convert">("build");
  const [template, setTemplate] = useState<PdfTemplate>(blank);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [library, setLibrary] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** The block being dragged in the rail, so a drag lands where it is dropped. */
  const [dragId, setDragId] = useState<string | null>(null);
  /** The page and the editor share one row; the divider between them moves the split, like chat and preview here. */
  const paneRef = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(300);
  const [sideBySide, setSideBySide] = useState(false);
  /** The editor can take the whole row, hiding the page, when a clause needs the room to be read. */
  const [editorExpanded, setEditorExpanded] = useState(false);
  const editorWidthRef = useRef(editorWidth);
  editorWidthRef.current = editorWidth;
  const paneWidth = paneRef.current?.clientWidth ?? 900;
  const maxEditorWidth = Math.max(300, paneWidth - 360 - 40);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    // The split only exists when the page and the editor really sit beside each other; below that they stack.
    const measure = () => setSideBySide(pane.clientWidth >= 360 + editorWidthRef.current + 40);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  function startResize(startX: number) {
    const startWidth = editorWidthRef.current;
    const move = (event: PointerEvent) => {
      setEditorWidth(
        Math.min(maxEditorWidth, Math.max(300, startWidth - (event.clientX - startX))),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  const list = useServerFn(listPdfTemplates);
  const save = useServerFn(savePdfTemplate);
  const duplicate = useServerFn(duplicatePdfTemplate);
  const remove = useServerFn(deletePdfTemplate);

  const active = template.blocks.find((b) => b.id === activeId) ?? null;
  const railRef = useRef<HTMLUListElement>(null);
  const checks = preflight(template);
  const ready = canSaveTemplate(template);

  function loadLibrary() {
    setLoading(true);
    void list()
      .then(setLibrary)
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Couldn't load the template library."),
      )
      .finally(() => setLoading(false));
  }
  useEffect(loadLibrary, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Keep the selected block's row in the rail's own scroll, wherever it was selected from. */
  useEffect(() => {
    const list = railRef.current;
    if (!list || !activeId) return;
    const row = list.querySelector<HTMLElement>(`[data-row="${activeId}"]`);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 4);
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight + 4;
  }, [activeId]);

  const patch = (id: string, updates: Partial<TemplateBlock>) =>
    setTemplate((t) => ({
      ...t,
      blocks: t.blocks.map((b) => (b.id === id ? ({ ...b, ...updates } as TemplateBlock) : b)),
    }));

  function addBlock(kind: TemplateBlock["kind"]) {
    const block: TemplateBlock =
      kind === "header"
        ? { id: newId(), kind, background: "light", showTagline: true }
        : kind === "meta"
          ? {
              id: newId(),
              kind,
              heading: "Release details",
              rows: [{ id: newId(), label: "Artist", value: "{{ARTIST_NAME}}" }],
            }
          : kind === "clause"
            ? { id: newId(), kind, heading: "Clause", body: "Write the clause here.", help: "" }
            : kind === "signatures"
              ? {
                  id: newId(),
                  kind,
                  heading: "Signatures",
                  parties: [{ id: newId(), label: "{{ARTIST_NAME}} · artist" }],
                }
              : kind === "seal"
                ? { id: newId(), kind, tier: "gold", label: "CTA" }
                : kind === "section"
                  ? {
                      id: newId(),
                      kind,
                      title: "New form",
                      subtitle: "Packet section",
                      formKey: `form${template.blocks.length + 1}`,
                      optional: true,
                    }
                  : kind === "fields"
                    ? {
                        id: newId(),
                        kind,
                        heading: "Details",
                        role: "recipient",
                        fields: [
                          {
                            id: newId(),
                            label: "Full name",
                            type: "text",
                            role: "recipient",
                            required: true,
                          },
                        ],
                      }
                    : kind === "checkboxes"
                      ? {
                          id: newId(),
                          kind,
                          heading: "I agree",
                          role: "recipient",
                          mode: "multi",
                          options: [{ id: newId(), label: "I agree to these terms" }],
                        }
                      : {
                          id: newId(),
                          kind,
                          heading: "Signature",
                          role: "recipient",
                          showDate: true,
                        };
    setTemplate((t) => ({ ...t, blocks: [...t.blocks, block] }));
    setActiveId(block.id);
  }

  function move(id: string, direction: -1 | 1) {
    setTemplate((t) => {
      const index = t.blocks.findIndex((b) => b.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= t.blocks.length) return t;
      const blocks = [...t.blocks];
      [blocks[index], blocks[next]] = [blocks[next]!, blocks[index]!];
      return { ...t, blocks };
    });
  }

  /** Drag a block onto another to put it there; a drop on itself changes nothing. */
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    setTemplate((t) => {
      const from = t.blocks.findIndex((b) => b.id === fromId);
      const to = t.blocks.findIndex((b) => b.id === toId);
      if (from < 0 || to < 0) return t;
      const blocks = [...t.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved!);
      return { ...t, blocks };
    });
  }

  /** A block and its own rows/lines, copied with fresh ids so editing the copy never edits the original. */
  function cloneBlock(block: TemplateBlock): TemplateBlock {
    const copy = { ...block, id: newId() } as TemplateBlock;
    if (copy.kind === "meta")
      return { ...copy, rows: copy.rows.map((r) => ({ ...r, id: newId() })) };
    if (copy.kind === "signatures")
      return { ...copy, parties: copy.parties.map((p) => ({ ...p, id: newId() })) };
    return copy;
  }

  function duplicateBlock(id: string) {
    const index = template.blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    const copy = cloneBlock(template.blocks[index]!);
    setTemplate((t) => ({
      ...t,
      blocks: [...t.blocks.slice(0, index + 1), copy, ...t.blocks.slice(index + 1)],
    }));
    setActiveId(copy.id);
  }

  function removeBlock(id: string) {
    setTemplate((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== id) }));
    setActiveId((current) => (current === id ? null : current));
  }

  /** A token goes into the block being edited, where a value belongs — never into the header. */
  function insertToken(key: string) {
    if (!active) {
      toast.message("Choose a block first.");
      return;
    }
    const token = `{{${key}}}`;
    // Never glue a token to the word before it: "artist{{ARTIST_NAME}}" reads as one broken field.
    const append = (value: string) => `${value}${!value || /\s$/.test(value) ? "" : " "}${token}`;
    if (active.kind === "clause") patch(active.id, { body: append(active.body) });
    else if (active.kind === "meta") {
      const rows = [...active.rows];
      const last = rows[rows.length - 1];
      if (!last) {
        toast.message("Add a row first.");
        return;
      }
      rows[rows.length - 1] = { ...last, value: append(last.value) };
      patch(active.id, { rows });
    } else if (active.kind === "signatures") {
      const parties = [...active.parties];
      const last = parties[parties.length - 1];
      if (!last) {
        toast.message("Add a signature line first.");
        return;
      }
      parties[parties.length - 1] = { ...last, label: append(last.label) };
      patch(active.id, { parties });
    } else if (active.kind === "seal") patch(active.id, { label: append(active.label) });
    else if (active.kind === "section") patch(active.id, { title: append(active.title) });
    else if (active.kind === "fields") patch(active.id, { heading: append(active.heading) });
    else if (active.kind === "checkboxes") patch(active.id, { heading: append(active.heading) });
    else if (active.kind === "signature") patch(active.id, { heading: append(active.heading) });
    else toast.message("The brand header carries no variables.");
  }

  async function saveTemplate() {
    if (!ready) {
      toast.error("Name the template and keep its brand header first.");
      return;
    }
    setSaving(true);
    try {
      const saved = await save({
        data: {
          ...(template.id ? { id: template.id } : {}),
          name: template.name,
          tier: template.tier,
          blocks: template.blocks,
          source: template.source ?? "built",
        },
      });
      setTemplate((t) => ({ ...t, id: saved.id }));
      toast.success(`Saved “${saved.name}” to the library.`);
      loadLibrary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the template.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(saved: SavedTemplate) {
    try {
      await duplicate({ data: { id: saved.id } });
      toast.success(`Copied “${saved.name}”.`);
      loadLibrary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't duplicate the template.");
    }
  }

  async function deleteTemplate(saved: SavedTemplate) {
    if (
      !(await confirmAction({
        title: "Delete this template?",
        text: `“${saved.name}” will leave the library for everyone. Documents already sent with it are untouched.`,
        action: "Delete",
      }))
    )
      return;
    try {
      await remove({ data: { id: saved.id } });
      if (template.id === saved.id) setTemplate(blank());
      toast.success("Template deleted.");
      loadLibrary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the template.");
    }
  }

  async function exportPdf() {
    try {
      const bytes = await templateToPdfBytes(template);
      saveBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${template.name.replace(/[^\w -]+/g, "") || "template"}.pdf`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Couldn't build the PDF.");
    }
  }
  function exportHtml() {
    saveBlob(
      new Blob([templateToHtml(template)], { type: "text/html" }),
      `${template.name.replace(/[^\w -]+/g, "") || "template"}.html`,
    );
  }
  function exportJson() {
    saveBlob(
      new Blob(
        [
          JSON.stringify(
            { name: template.name, tier: template.tier, blocks: template.blocks },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `${template.name.replace(/[^\w -]+/g, "") || "template"}.json`,
    );
  }

  const openSaved = (saved: SavedTemplate) => {
    setTemplate({
      id: saved.id,
      name: saved.name,
      tier: saved.tier,
      blocks: saved.blocks,
      source: saved.source,
    });
    setActiveId(saved.blocks[0]?.id ?? null);
    setTab("build");
    toast.success(`Opened “${saved.name}”.`);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Template Studio</h2>
          <p className="text-sm text-muted-foreground">
            Build a document from CTA-branded blocks, fill it with live variables, or bring an
            existing PDF in and map its lines to tokens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTemplate(blank());
              setActiveId(null);
            }}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportHtml}>
            <FileText className="h-4 w-4" />
            Export HTML
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <FileJson className="h-4 w-4" />
            Export JSON
          </Button>
          <Button size="sm" onClick={saveTemplate} disabled={saving || !ready}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {template.id ? "Save" : "Save to library"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "build" | "convert")} className="mt-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="build">Create template</TabsTrigger>
          <TabsTrigger value="convert">Convert a PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-4">
          {/* Wrapping flex, not viewport breakpoints: the card sits inside the admin's own width, so the rail and the
              inspector drop below the page when they don't fit instead of pushing the studio off screen. */}
          <div className="flex flex-wrap items-start gap-4">
            {/* Blocks rail */}
            <div className="w-full shrink-0 space-y-3 sm:w-[232px]">
              <div className="rounded-xl border border-border p-3">
                <p className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Blocks
                  <span className="text-[10px] font-medium normal-case tracking-normal">
                    {template.blocks.length} in this document
                  </span>
                </p>
                {/* The list has its own scroll: a 100-block packet would otherwise push the page and every other
                    panel thousands of pixels down, leaving the builder feeling like one endless column. */}
                <ul
                  ref={railRef}
                  className="mt-2 max-h-[min(52vh,460px)] space-y-1.5 overflow-y-auto overscroll-contain pr-1"
                >
                  {template.blocks.map((block, index) => (
                    <li
                      key={block.id}
                      data-row={block.id}
                      draggable
                      onDragStart={() => setDragId(block.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId) reorder(dragId, block.id);
                        setDragId(null);
                      }}
                      className={dragId === block.id ? "opacity-50" : undefined}
                    >
                      {/* Select and act are separate buttons: an icon sitting inside the row's own click target made
                          a click on the row's middle duplicate the block instead of selecting it. */}
                      <div
                        className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-sm ${block.id === activeId ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveId(block.id)}
                          title={BLOCK_LABELS[block.kind]}
                          aria-pressed={block.id === activeId}
                          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate" title={blockName(block)}>
                            {blockName(block)}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center">
                          <button
                            type="button"
                            aria-label={`Duplicate ${BLOCK_LABELS[block.kind]}`}
                            title="Duplicate this block"
                            onClick={() => duplicateBlock(block.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => move(block.id, -1)}
                            className="rounded p-0.5 text-muted-foreground disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={index === template.blocks.length - 1}
                            onClick={() => move(block.id, 1)}
                            className="rounded p-0.5 text-muted-foreground disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove block"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-0.5 text-muted-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {(
                    [
                      "header",
                      "meta",
                      "clause",
                      "signatures",
                      "seal",
                      "section",
                      "fields",
                      "checkboxes",
                      "signature",
                    ] as const
                  ).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addBlock(kind)}
                      className="rounded border border-dashed border-border px-1.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      + {BLOCK_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Starter presets
                </p>
                <div className="mt-2 space-y-1.5">
                  {starterPresets().map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setTemplate({
                          ...preset,
                          blocks: preset.blocks.map((b) => ({ ...b, id: newId() })),
                        });
                        setActiveId(null);
                      }}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs hover:border-primary"
                    >
                      <span className="block font-semibold">{preset.name}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {TIER_METAL[preset.tier] ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: TIER_METAL[preset.tier]! }}
                          />
                        ) : null}
                        {TIER_LABELS[preset.tier]} · {preset.blocks.length} blocks
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas and editor share a row, with a divider that can be dragged to widen the clause editor. */}
            {/* The pane asks for 520px before sharing a row with the rail, so a narrow card puts the page and editor on
                their own full-width row instead of squeezing the editor into a sliver beside the blocks. */}
            <div
              ref={paneRef}
              className="flex min-w-0 grow basis-[520px] flex-wrap items-start gap-4"
            >
              {/* Canvas */}
              <div className={`min-w-0 flex-1 basis-[360px]${editorExpanded ? " hidden" : ""}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSample(false)}
                      className={`rounded-full px-3 py-1 ${!sample ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      Edit structure
                    </button>
                    <button
                      type="button"
                      onClick={() => setSample(true)}
                      className={`rounded-full px-3 py-1 ${sample ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      Live sample preview
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">Letter · 816 px wide</span>
                </div>
                <div className="overflow-x-auto rounded-xl bg-muted/40 p-3">
                  <Paper
                    template={template}
                    sample={sample}
                    activeId={activeId}
                    onSelect={setActiveId}
                  />
                </div>

                {/* Preflight */}
                <div className="mt-3 rounded-xl border border-border p-3">
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Preflight
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {checks.map((check) => (
                      <li
                        key={check.id}
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                        style={
                          check.ok
                            ? { background: `${BRAND.cobalt}14`, color: BRAND.cobalt }
                            : { background: `${BRAND.gold}2e`, color: BRAND.black }
                        }
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: check.ok ? BRAND.cobalt : BRAND.gold }}
                        />
                        <span className="font-semibold">{check.label}</span>
                        <span className="opacity-80">{check.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Inspector */}
              {sideBySide && !editorExpanded && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize the clause editor"
                  aria-valuenow={Math.round(editorWidth)}
                  aria-valuemin={300}
                  aria-valuemax={Math.round(maxEditorWidth)}
                  aria-valuetext={`${Math.round(editorWidth)} pixels wide`}
                  tabIndex={0}
                  title="Drag to widen the clause editor, or double-click to reset"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startResize(e.clientX);
                  }}
                  onDoubleClick={() => setEditorWidth(300)}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 48 : 16;
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      setEditorWidth((w) => Math.min(maxEditorWidth, w + step));
                    }
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      setEditorWidth((w) => Math.max(300, w - step));
                    }
                  }}
                  className="flex w-2 shrink-0 cursor-col-resize touch-none items-center justify-center self-stretch rounded-full outline-none hover:bg-primary/15 focus-visible:bg-primary/15"
                >
                  <span className="h-12 w-[3px] rounded-full bg-border" />
                </div>
              )}
              <div
                className="w-full shrink-0 space-y-3"
                style={
                  editorExpanded
                    ? { width: "100%" }
                    : sideBySide
                      ? { width: editorWidth }
                      : undefined
                }
              >
                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Template
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditorExpanded((v) => !v)}
                      aria-pressed={editorExpanded}
                      aria-label={editorExpanded ? "Show the document page" : "Expand the editor"}
                      title={
                        editorExpanded
                          ? "Bring the document page back"
                          : "Give the editor the whole width"
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {editorExpanded ? (
                        <Minimize2 className="h-3.5 w-3.5" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <Input
                    className="mt-2"
                    value={template.name}
                    onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
                    maxLength={120}
                    aria-label="Template name"
                  />
                  <div className="mt-2 flex gap-2">
                    <Select
                      value={template.tier}
                      onValueChange={(v) => setTemplate((t) => ({ ...t, tier: v as TemplateTier }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TIERS.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {TIER_LABELS[tier]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center gap-1 rounded-full border border-border px-2 text-[11px] text-muted-foreground">
                      {TIER_METAL[template.tier] ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: TIER_METAL[template.tier]! }}
                        />
                      ) : null}
                      {TIER_LABELS[template.tier]}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {active ? BLOCK_LABELS[active.kind] : "Select a block"}
                  </p>
                  {!active ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Click a block on the page or in the rail to edit it.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {active.kind === "header" && (
                        <>
                          <label className="text-xs text-muted-foreground">Header surface</label>
                          <div className="grid grid-cols-2 gap-1">
                            {(["light", "dark"] as const).map((theme) => (
                              <button
                                key={theme}
                                type="button"
                                onClick={() => patch(active.id, { background: theme })}
                                className={`rounded-md border px-2 py-1.5 text-xs ${active.background === theme ? "border-primary" : "border-border"}`}
                              >
                                <span
                                  className="mb-1 block h-4 rounded-sm"
                                  style={{
                                    background: theme === "light" ? BRAND.white : BRAND.black,
                                    border: `1px solid ${BRAND.platinum}`,
                                  }}
                                />
                                {theme === "light" ? "Light" : "Dark"}
                              </button>
                            ))}
                          </div>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={active.showTagline}
                              onChange={(e) => patch(active.id, { showTagline: e.target.checked })}
                            />
                            Show the tagline
                          </label>
                          <p className="text-[11px] text-muted-foreground">
                            The wordmark follows the contrast rule: black + cobalt on light, white +
                            electric on dark.
                          </p>
                        </>
                      )}

                      {active.kind === "meta" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            placeholder="Heading"
                            aria-label="Grid heading"
                          />
                          {active.rows.map((row) => (
                            <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                              <Input
                                value={row.label}
                                onChange={(e) =>
                                  patch(active.id, {
                                    rows: active.rows.map((r) =>
                                      r.id === row.id ? { ...r, label: e.target.value } : r,
                                    ),
                                  })
                                }
                                placeholder="Label"
                                aria-label="Row label"
                              />
                              <Input
                                value={row.value}
                                onChange={(e) =>
                                  patch(active.id, {
                                    rows: active.rows.map((r) =>
                                      r.id === row.id ? { ...r, value: e.target.value } : r,
                                    ),
                                  })
                                }
                                placeholder="Value"
                                aria-label="Row value"
                              />
                              <button
                                type="button"
                                aria-label="Remove row"
                                onClick={() =>
                                  patch(active.id, {
                                    rows: active.rows.filter((r) => r.id !== row.id),
                                  })
                                }
                                className="rounded p-1 text-muted-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch(active.id, {
                                rows: [
                                  ...active.rows,
                                  { id: newId(), label: "Label", value: "{{ARTIST_NAME}}" },
                                ],
                              })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Row
                          </Button>
                        </>
                      )}

                      {active.kind === "clause" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            placeholder="Clause heading"
                            aria-label="Clause heading"
                          />
                          <Textarea
                            value={active.body}
                            onChange={(e) => patch(active.id, { body: e.target.value })}
                            rows={8}
                            placeholder="The clause itself"
                            aria-label="Clause body"
                          />
                          <Textarea
                            value={active.help}
                            onChange={(e) => patch(active.id, { help: e.target.value })}
                            rows={2}
                            placeholder="Teaching note (optional): what this means in plain language"
                            aria-label="Clause help"
                          />
                        </>
                      )}

                      {active.kind === "signatures" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            aria-label="Signature heading"
                          />
                          {active.parties.map((party) => (
                            <div key={party.id} className="grid grid-cols-[1fr_auto] gap-1">
                              <Input
                                value={party.label}
                                onChange={(e) =>
                                  patch(active.id, {
                                    parties: active.parties.map((p) =>
                                      p.id === party.id ? { ...p, label: e.target.value } : p,
                                    ),
                                  })
                                }
                                aria-label="Signature line"
                              />
                              <button
                                type="button"
                                aria-label="Remove signature"
                                onClick={() =>
                                  patch(active.id, {
                                    parties: active.parties.filter((p) => p.id !== party.id),
                                  })
                                }
                                className="rounded p-1 text-muted-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch(active.id, {
                                parties: [...active.parties, { id: newId(), label: "Name · role" }],
                              })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Signature line
                          </Button>
                        </>
                      )}

                      {active.kind === "section" && (
                        <>
                          <Input
                            value={active.title}
                            onChange={(e) => patch(active.id, { title: e.target.value })}
                            placeholder="Form title"
                            aria-label="Form title"
                          />
                          <Input
                            value={active.subtitle}
                            onChange={(e) => patch(active.id, { subtitle: e.target.value })}
                            placeholder="Subtitle"
                            aria-label="Form subtitle"
                          />
                          <Input
                            value={active.formKey ?? ""}
                            onChange={(e) =>
                              patch(active.id, { formKey: e.target.value.trim() })
                            }
                            placeholder="Form key (blank = always included)"
                            aria-label="Form key"
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={active.optional !== false}
                              onChange={(e) => patch(active.id, { optional: e.target.checked })}
                            />
                            Can be switched off for a recipient
                          </label>
                        </>
                      )}

                      {active.kind === "fields" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            aria-label="Fields heading"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            {(["recipient", "admin"] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() =>
                                  patch(active.id, {
                                    role,
                                    fields: active.fields.map((f) => ({ ...f, role })),
                                  })
                                }
                                className={`rounded-md border px-2 py-1 text-xs capitalize ${active.role === role ? "border-primary" : "border-border"}`}
                              >
                                {role === "recipient" ? "Recipient fills" : "Admin fills"}
                              </button>
                            ))}
                          </div>
                          {active.fields.map((f) => (
                            <div
                              key={f.id}
                              className="space-y-1 rounded-md border border-border p-2"
                            >
                              <Input
                                value={f.label}
                                onChange={(e) =>
                                  patch(active.id, {
                                    fields: active.fields.map((x) =>
                                      x.id === f.id ? { ...x, label: e.target.value } : x,
                                    ),
                                  })
                                }
                                placeholder="Field label"
                                aria-label="Field label"
                              />
                              <div className="flex items-center gap-2 text-xs">
                                <select
                                  value={f.type}
                                  aria-label="Field type"
                                  onChange={(e) =>
                                    patch(active.id, {
                                      fields: active.fields.map((x) =>
                                        x.id === f.id
                                          ? { ...x, type: e.target.value as typeof f.type }
                                          : x,
                                      ),
                                    })
                                  }
                                  className="h-7 rounded border border-border bg-background px-1"
                                >
                                  <option value="text">One line</option>
                                  <option value="textarea">Multi-line</option>
                                  <option value="date">Date</option>
                                </select>
                                <label className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={!!f.required}
                                    onChange={(e) =>
                                      patch(active.id, {
                                        fields: active.fields.map((x) =>
                                          x.id === f.id ? { ...x, required: e.target.checked } : x,
                                        ),
                                      })
                                    }
                                  />
                                  Required
                                </label>
                                <button
                                  type="button"
                                  aria-label="Remove field"
                                  onClick={() =>
                                    patch(active.id, {
                                      fields: active.fields.filter((x) => x.id !== f.id),
                                    })
                                  }
                                  className="ml-auto text-muted-foreground"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch(active.id, {
                                fields: [
                                  ...active.fields,
                                  {
                                    id: newId(),
                                    label: "New field",
                                    type: "text",
                                    role: active.role,
                                    required: false,
                                  },
                                ],
                              })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" /> Field
                          </Button>
                        </>
                      )}

                      {active.kind === "checkboxes" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            aria-label="Checkbox heading"
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <select
                              value={active.mode}
                              aria-label="Choice mode"
                              onChange={(e) =>
                                patch(active.id, {
                                  mode: e.target.value as typeof active.mode,
                                })
                              }
                              className="h-7 rounded border border-border bg-background px-1"
                            >
                              <option value="multi">Tick any</option>
                              <option value="single">Pick one</option>
                            </select>
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={!!active.required}
                                onChange={(e) => patch(active.id, { required: e.target.checked })}
                              />
                              Required
                            </label>
                          </div>
                          {active.options.map((o) => (
                            <div key={o.id} className="grid grid-cols-[1fr_auto] gap-1">
                              <Input
                                value={o.label}
                                onChange={(e) =>
                                  patch(active.id, {
                                    options: active.options.map((x) =>
                                      x.id === o.id ? { ...x, label: e.target.value } : x,
                                    ),
                                  })
                                }
                                aria-label="Checkbox label"
                              />
                              <button
                                type="button"
                                aria-label="Remove option"
                                onClick={() =>
                                  patch(active.id, {
                                    options: active.options.filter((x) => x.id !== o.id),
                                  })
                                }
                                className="rounded p-1 text-muted-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patch(active.id, {
                                options: [...active.options, { id: newId(), label: "New option" }],
                              })
                            }
                          >
                            <Plus className="h-3.5 w-3.5" /> Option
                          </Button>
                        </>
                      )}

                      {active.kind === "signature" && (
                        <>
                          <Input
                            value={active.heading}
                            onChange={(e) => patch(active.id, { heading: e.target.value })}
                            aria-label="Signature heading"
                          />
                          <div className="grid grid-cols-2 gap-1">
                            {(["recipient", "admin"] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => patch(active.id, { role })}
                                className={`rounded-md border px-2 py-1 text-xs ${active.role === role ? "border-primary" : "border-border"}`}
                              >
                                {role === "recipient" ? "Recipient signs" : "Company signs"}
                              </button>
                            ))}
                          </div>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={active.showDate}
                              onChange={(e) => patch(active.id, { showDate: e.target.checked })}
                            />
                            Include a date line
                          </label>
                        </>
                      )}

                      {active.kind === "seal" && (
                        <>
                          <div className="grid grid-cols-2 gap-1">
                            {(["gold", "platinum"] as const).map((metal) => (
                              <button
                                key={metal}
                                type="button"
                                onClick={() => patch(active.id, { tier: metal })}
                                className={`rounded-md border px-2 py-1.5 text-xs capitalize ${active.tier === metal ? "border-primary" : "border-border"}`}
                              >
                                <span
                                  className="mb-1 block h-2 rounded-full"
                                  style={{
                                    background: metal === "gold" ? BRAND.gold : BRAND.platinum,
                                  }}
                                />
                                {metal}
                              </button>
                            ))}
                          </div>
                          <Input
                            value={active.label}
                            onChange={(e) => patch(active.id, { label: e.target.value })}
                            aria-label="Seal label"
                            maxLength={24}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            A seal marks an official CTA certification; use it with the tier the
                            document earns.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Variables
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Click a token to insert it into the selected block.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TOKENS.map((token) => (
                      <button
                        key={token.key}
                        type="button"
                        onClick={() => insertToken(token.key)}
                        title={token.label}
                        className="rounded-full px-2 py-1 font-mono text-[10.5px]"
                        style={{
                          background: `${BRAND.cobalt}12`,
                          color: BRAND.cobalt,
                          border: `1px solid ${BRAND.cobalt}33`,
                        }}
                      >
                        {`{{${token.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="convert" className="mt-4">
          <PdfTemplateConverter
            onCreate={(converted) => {
              setTemplate(converted);
              setActiveId(converted.blocks[1]?.id ?? null);
              setSample(false);
              setTab("build");
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Library */}
      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Template library</p>
            <p className="text-xs text-muted-foreground">
              Saved documents every staff member can open.
            </p>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        {!loading && !library.length ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nothing saved yet. Build a template or start from a preset, then Save to library.
          </p>
        ) : null}
        <ul className="mt-2 divide-y divide-border">
          {library.map((saved) => (
            <li key={saved.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: TIER_METAL[saved.tier] ?? "transparent",
                  border: TIER_METAL[saved.tier] ? "none" : `1px solid ${BRAND.platinum}`,
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{saved.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TIER_LABELS[saved.tier]} · {saved.blocks.length} blocks · updated{" "}
                  {when(saved.updatedAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openSaved(saved)}>
                Open
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Duplicate ${saved.name}`}
                onClick={() => duplicateTemplate(saved)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${saved.name}`}
                onClick={() => deleteTemplate(saved)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Download className="h-3 w-3" />
          Exports use the sample release, so a file can be reviewed before a real song is chosen.
        </p>
      </div>
    </div>
  );
}
