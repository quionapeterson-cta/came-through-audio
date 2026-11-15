import { useRef, useState } from "react";
import { FileUp, Loader2, ScanText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRAND, newId, TOKENS, type PdfTemplate } from "@/lib/pdf-templates";
import { groupZones, zonesToText, type PdfZone } from "@/lib/pdf-template-convert";

/**
 * Convert a PDF (founder, 2026-11-15): scan an existing document, pick the lines that change per release and turn them
 * into {{TOKENS}}, with the option to wrap the whole thing in the CTA header and platinum hairlines. The scan reads the
 * PDF's own text layer, so it works on a document that was made on a computer, not on a photo of paper.
 */
export function PdfTemplateConverter({ onCreate }: { onCreate: (template: PdfTemplate) => void }) {
  const [fileName, setFileName] = useState("");
  const [zones, setZones] = useState<PdfZone[]>([]);
  const [mapped, setMapped] = useState<Record<string, string>>({});
  const [polish, setPolish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageName, setPageName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** The open pdf.js document, closed when another file is scanned. */
  const loading = useRef<{ destroy: () => Promise<void> } | null>(null);

  async function open(file: File) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error("Choose a PDF file.");
      return;
    }
    setBusy(true);
    setZones([]);
    setMapped({});
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
      ).default;
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const doc = await task.promise;
      void loading.current?.destroy();
      loading.current = task;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [x, top] = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
        const height = item.height || 10;
        return [{ str: item.str, x, y: top - height, width: item.width || 10, height }];
      });
      const found = groupZones(items, { width: viewport.width, height: viewport.height });
      setZones(found);
      setFileName(file.name);
      setPageName(file.name.replace(/\.pdf$/i, ""));
      setFileName(file.name);

      // Draw page one, so the boxes sit over the real page rather than over a guess.
      const room = (wrapRef.current?.clientWidth ?? 720) - 2;
      const scale = Math.min(1.6, room / viewport.width);
      const shown = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(shown.width * dpr);
        canvas.height = Math.floor(shown.height * dpr);
        canvas.style.width = `${shown.width}px`;
        canvas.style.height = `${shown.height}px`;
        await page.render({
          canvas,
          canvasContext: canvas.getContext("2d")!,
          viewport: shown,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        }).promise;
      }
      if (!found.length)
        toast.message(
          "No text layer found. A scanned document has no words to convert — build the template by hand instead.",
        );
    } catch (e) {
      console.error(e);
      toast.error("This PDF couldn't be read. It may be damaged or password-protected.");
    } finally {
      setBusy(false);
    }
  }

  function build() {
    const rows = zones
      .filter((zone) => mapped[zone.id])
      .map((zone) => {
        const token = mapped[zone.id]!;
        return {
          id: newId(),
          label: TOKENS.find((t) => t.key === token)?.label ?? token,
          value: `{{${token}}}`,
        };
      });
    const body = zonesToText(
      zones,
      Object.fromEntries(zones.map((z) => [z.id, mapped[z.id] ? `{{${mapped[z.id]}}}` : z.text])),
    );
    onCreate({
      name: pageName.trim() || "Converted template",
      tier: polish ? "platinum" : "standard",
      source: "converted",
      blocks: [
        { id: newId(), kind: "header", background: polish ? "dark" : "light", showTagline: true },
        ...(rows.length
          ? [{ id: newId(), kind: "meta" as const, heading: "Mapped fields", rows }]
          : []),
        {
          id: newId(),
          kind: "clause",
          heading: "Document text",
          body: body || "Add the document's wording here.",
          help: polish
            ? "Brand polish applied: the CTA header, modern type and platinum hairlines."
            : "",
        },
        {
          id: newId(),
          kind: "signatures",
          heading: "Signatures",
          parties: [{ id: newId(), label: "Name · signature" }],
        },
      ],
    });
    toast.success("Opened in the builder.");
  }

  const mappedCount = Object.values(mapped).filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1 basis-[420px] space-y-3">
        <div
          className="rounded-2xl border-2 border-dashed p-6 text-center"
          style={{ background: BRAND.black, borderColor: zones.length ? BRAND.platinum : "#333" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void open(file);
          }}
        >
          <FileUp className="mx-auto h-8 w-8" style={{ color: BRAND.electric }} />
          <p className="mt-2 font-semibold text-white">{fileName || "Drop a PDF to scan it"}</p>
          <p className="mt-1 text-sm text-white/60">
            Its words become clickable zones. Nothing is uploaded: the scan happens in this browser.
          </p>
          <label
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: BRAND.cobalt }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
            {busy ? "Scanning…" : "Choose a PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void open(file);
              }}
            />
          </label>
        </div>

        <div
          ref={wrapRef}
          className="relative mx-auto w-fit"
          style={
            polish && zones.length
              ? { padding: 14, background: BRAND.black, border: `1px solid ${BRAND.platinum}` }
              : undefined
          }
        >
          {polish && zones.length ? (
            <div className="mb-2 flex items-center justify-between" style={{ color: BRAND.white }}>
              <span className="text-lg font-extrabold">
                Came Through <span style={{ color: BRAND.electric }}>Audio</span>
              </span>
              <span className="text-[9px] tracking-[3px]" style={{ color: BRAND.platinum }}>
                YOUR FIRST STOP BEFORE DISTRIBUTION
              </span>
            </div>
          ) : null}
          <canvas ref={canvasRef} className="block bg-white" />
          {zones.map((zone) => {
            const token = mapped[zone.id];
            return (
              <button
                key={zone.id}
                type="button"
                title={zone.text}
                onClick={() =>
                  document
                    .getElementById(`zone-pick-${zone.id}`)
                    ?.scrollIntoView({ block: "center", behavior: "smooth" })
                }
                className="absolute cursor-pointer rounded-sm transition-colors"
                style={{
                  left: `${zone.left * 100}%`,
                  top: `${zone.top * 100}%`,
                  width: `${zone.width * 100}%`,
                  height: `${zone.height * 100}%`,
                  border: `1.5px solid ${token ? BRAND.gold : BRAND.electric}`,
                  background: token ? `${BRAND.gold}33` : `${BRAND.electric}1a`,
                  boxShadow: token ? `0 0 0 2px ${BRAND.gold}44` : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="w-full shrink-0 space-y-3 sm:w-[320px]">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Brand polish</p>
          <button
            type="button"
            onClick={() => setPolish((p) => !p)}
            className={`mt-2 flex w-full items-center justify-between rounded-full border px-3 py-1.5 text-sm ${polish ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              Apply CTA Brand Polish
            </span>
            <span className="font-semibold">{polish ? "On" : "Off"}</span>
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Adds the contrast-checked CTA header, crisp sans-serif type and platinum hairlines
            around tables.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Detected zones</p>
            <span className="text-xs text-muted-foreground">{mappedCount} mapped</span>
          </div>
          {!zones.length ? (
            <p className="mt-2 text-xs text-muted-foreground">Scan a PDF to see its lines here.</p>
          ) : (
            <ul className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  id={`zone-pick-${zone.id}`}
                  className="rounded-md border border-border p-2"
                >
                  <p className="truncate text-xs text-muted-foreground" title={zone.text}>
                    {zone.text}
                  </p>
                  <Select
                    value={mapped[zone.id] ?? "keep"}
                    onValueChange={(value) =>
                      setMapped((m) => {
                        const next = { ...m };
                        if (value === "keep") delete next[zone.id];
                        else next[zone.id] = value;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Keep as text</SelectItem>
                      {TOKENS.map((token) => (
                        <SelectItem
                          key={token.key}
                          value={token.key}
                        >{`{{${token.key}}}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Template name</p>
          <input
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="Converted template"
            maxLength={120}
            className="mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button className="mt-3 w-full" disabled={!zones.length} onClick={build}>
            Open in the builder
          </Button>
        </div>
      </div>
    </div>
  );
}
