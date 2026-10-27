import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, Download, FileUp, Mail, Move, PenLine, Type, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ConfirmHost";
import { sendPdfEmail } from "@/lib/pdf-email.functions";
import { buildPdf, PDF_EMAIL_MAX_BYTES, PDF_MAILBOXES, signedFileName, toBase64, type PdfFieldValues, type PdfMailbox, type PdfMark } from "@/lib/pdf-tools";

/** A fill-in box from the PDF's own form, in on-screen pixels. */
type FieldBox = {
  id: string; name: string; type: "text" | "checkbox" | "radio" | "choice";
  left: number; top: number; width: number; height: number;
  multiline?: boolean; onValue?: string; options?: { value: string; label: string }[];
};
type PageView = { viewport: PageViewport; fields: FieldBox[] };
type Signature = { src: string; png: Uint8Array; ratio: number };
/** Text, a date or a signature placed on a page, in on-screen pixels from the page's top-left corner. */
type Placed = { id: string; page: number; left: number; top: number } & ({ kind: "text"; text: string } | { kind: "sign"; width: number; sig: Signature });
type Tool = "text" | "date" | "sign";

/** Text placed on a page is written at 11 pt, the usual size for forms. */
const TEXT_PT = 11;
const SIGN_WIDTH = 180;
const SIGN_FONT = "'Dancing Script', cursive";
const MAX_SCALE = 1.5;

const today = () => new Date().toLocaleDateString("en-US");
const newId = () => Math.random().toString(36).slice(2);

function dataUrlBytes(url: string) {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Crops a canvas to what was drawn on it, so a signature sits exactly where it's placed. */
function trimmedSignature(canvas: HTMLCanvasElement): Signature | null {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (px[(y * width + x) * 4 + 3]! > 10) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return null;
  const pad = 4;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + pad * 2;
  out.height = y1 - y0 + pad * 2;
  out.getContext("2d")!.drawImage(canvas, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
  const src = out.toDataURL("image/png");
  return { src, png: dataUrlBytes(src), ratio: out.width / out.height };
}

/** Admin → PDF Tools: open any PDF, fill it in, sign it, then download it or email it. The file stays in the browser until it's emailed. */
export function PdfTools() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageView[]>([]);
  const [values, setValues] = useState<PdfFieldValues>({});
  /** Boxes the person changed: only these are written, so the rest of the document stays exactly as uploaded. */
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [tool, setTool] = useState<Tool | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The open pdf.js document, closed when another one is opened. */
  const loading = useRef<{ destroy: () => Promise<void> } | null>(null);

  async function open(f: File) {
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) { toast.error("Choose a PDF file."); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      // pdf.js takes ownership of the bytes it reads, so it gets a copy and the original stays for saving.
      const task = pdfjs.getDocument({ data: bytes.slice() });
      const pdf = await task.promise;
      const room = (wrapRef.current?.clientWidth ?? 800) - 2;
      const views: PageView[] = [];
      const start: PdfFieldValues = {};
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: Math.min(MAX_SCALE, room / page.getViewport({ scale: 1 }).width) });
        const fields: FieldBox[] = [];
        for (const a of await page.getAnnotations()) {
          if (a.subtype !== "Widget" || !a.fieldName || a.readOnly || a.hidden) continue;
          const [x1, y1] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
          const [x2, y2] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
          const box = { id: a.id as string, name: a.fieldName as string, left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
          if (a.fieldType === "Tx") {
            fields.push({ ...box, type: "text", multiline: !!a.multiLine });
            start[box.name] ??= typeof a.fieldValue === "string" ? a.fieldValue : "";
          } else if (a.fieldType === "Btn" && a.checkBox) {
            fields.push({ ...box, type: "checkbox", onValue: a.exportValue });
            start[box.name] ??= a.fieldValue != null && a.fieldValue !== "Off" && a.fieldValue === a.exportValue;
          } else if (a.fieldType === "Btn" && a.radioButton) {
            fields.push({ ...box, type: "radio", onValue: a.buttonValue });
            if (typeof a.fieldValue === "string" && a.fieldValue !== "Off") start[box.name] = a.fieldValue;
          } else if (a.fieldType === "Ch") {
            const options = ((a.options ?? []) as { exportValue: string; displayValue: string }[]).map((o) => ({ value: o.exportValue, label: o.displayValue }));
            fields.push({ ...box, type: "choice", options });
            start[box.name] ??= Array.isArray(a.fieldValue) ? (a.fieldValue[0] ?? "") : (a.fieldValue ?? "");
          }
        }
        views.push({ viewport, fields });
      }
      void loading.current?.destroy();
      loading.current = task;
      setDoc(pdf);
      setPages(views);
      setValues(start);
      setEdited(new Set());
      setPlaced([]);
      setTool(null);
      setFile({ name: f.name, bytes });
    } catch (e) {
      console.error(e);
      toast.error("This PDF couldn't be opened. It may be damaged or password-protected.");
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    if ((placed.length || edited.size) && !(await confirmAction({ title: "Close this PDF?", text: "Anything you added that you haven't downloaded or emailed will be lost.", action: "Close" }))) return;
    void loading.current?.destroy();
    loading.current = null;
    setDoc(null); setPages([]); setValues({}); setEdited(new Set()); setPlaced([]); setTool(null); setFile(null);
  }

  function chooseTool(t: Tool) {
    if (t === "sign" && !signature) return setSignOpen(true);
    setTool(tool === t ? null : t);
  }

  function place(page: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!tool || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - r.left, top = e.clientY - r.top;
    const item: Placed = tool === "sign" && signature
      ? { id: newId(), page, left, top: top - SIGN_WIDTH / signature.ratio / 2, kind: "sign", width: SIGN_WIDTH, sig: signature }
      : { id: newId(), page, left, top: top - 10, kind: "text", text: tool === "date" ? today() : "" };
    setPlaced((p) => [...p, item]);
    // Text is typed right where it lands; signatures and dates are one-click, so the tool switches off after them.
    if (tool !== "text") setTool(null);
  }

  /** Pixels on screen → PDF points, the way pdf.js placed the page. */
  function marks(): PdfMark[] {
    return placed.flatMap((p): PdfMark[] => {
      const v = pages[p.page]!.viewport;
      if (p.kind === "text") {
        const size = TEXT_PT * v.scale;
        // The text box's baseline: box padding (4px) plus the font's ascent.
        const [x, y] = v.convertToPdfPoint(p.left + 4, p.top + 4 + size * 0.9);
        return p.text.trim() ? [{ kind: "text", page: p.page, x: x!, y: y!, size: TEXT_PT, text: p.text }] : [];
      }
      const height = p.width / p.sig.ratio;
      const [x, y] = v.convertToPdfPoint(p.left, p.top + height);
      return [{ kind: "image", page: p.page, x: x!, y: y!, width: p.width / v.scale, height: height / v.scale, png: p.sig.png }];
    });
  }

  async function finished() {
    if (!file) throw new Error("Open a PDF first.");
    return buildPdf(file.bytes, Object.fromEntries([...edited].map((name) => [name, values[name]!])), marks());
  }

  async function download() {
    setBusy(true);
    try {
      const bytes = await finished();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = signedFileName(file!.name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't build the PDF. Try again, or tell the Software team which file it was.");
    } finally {
      setBusy(false);
    }
  }

  const update = (id: string, patch: Partial<Placed>) => setPlaced((p) => p.map((x) => (x.id === id ? ({ ...x, ...patch } as Placed) : x)));
  const fieldCount = pages.reduce((n, p) => n + p.fields.length, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">PDF Tools</h2>
        <p className="text-sm text-muted-foreground">Open a PDF, fill it in, sign it, then download it or email it. The file stays on your computer unless you email it.</p>

        {!file ? (
          <div
            className="mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void open(f); }}
          >
            <FileUp className="h-8 w-8 text-primary" />
            <p className="font-semibold">Drag a PDF here</p>
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Opening…" : "Choose a PDF"}</Button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-auto min-w-0 truncate text-sm font-semibold">
                {file.name} · {pages.length} page{pages.length === 1 ? "" : "s"}{fieldCount ? ` · ${fieldCount} fill-in box${fieldCount === 1 ? "" : "es"}` : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={startOver}>Open a different PDF</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={tool === "text" ? "default" : "outline"} onClick={() => chooseTool("text")}><Type className="h-4 w-4" />Add text</Button>
              <Button variant={tool === "date" ? "default" : "outline"} onClick={() => chooseTool("date")}><CalendarDays className="h-4 w-4" />Add date</Button>
              <Button variant={tool === "sign" ? "default" : "outline"} onClick={() => chooseTool("sign")}><PenLine className="h-4 w-4" />Sign</Button>
              {signature && <Button variant="ghost" onClick={() => setSignOpen(true)}>Change signature</Button>}
              <span className="flex-1" />
              <Button variant="outline" onClick={download} disabled={busy}><Download className="h-4 w-4" />Download</Button>
              <Button onClick={() => setEmailOpen(true)} disabled={busy}><Mail className="h-4 w-4" />Email</Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {tool === "text" ? "Click on the page where the text goes, then type."
                : tool === "date" ? "Click on the page where today's date goes."
                : tool === "sign" ? "Click on the page where your signature goes."
                : fieldCount ? "Type in the blue boxes to fill in the form. Use Add text, Add date or Sign for anything else." : "Use Add text, Add date or Sign, then click on the page."}
            </p>
          </>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void open(f); }} />
      </div>

      <div ref={wrapRef} className="space-y-4">
        {doc && pages.map((view, i) => (
          <PdfPage
            key={`${file?.name}-${i}`}
            doc={doc}
            index={i}
            view={view}
            values={values}
            onValue={(name, v) => { setValues((s) => ({ ...s, [name]: v })); setEdited((s) => new Set(s).add(name)); }}
            placed={placed.filter((p) => p.page === i)}
            placing={!!tool}
            onPlace={(e) => place(i, e)}
            onUpdate={update}
            onRemove={(id) => setPlaced((p) => p.filter((x) => x.id !== id))}
          />
        ))}
      </div>

      <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onSave={(s) => { setSignature(s); setTool("sign"); setSignOpen(false); }} />
      {file && <EmailDialog open={emailOpen} onOpenChange={setEmailOpen} fileName={signedFileName(file.name)} build={finished} />}
    </div>
  );
}

function PdfPage({ doc, index, view, values, onValue, placed, placing, onPlace, onUpdate, onRemove }: {
  doc: PDFDocumentProxy; index: number; view: PageView; values: PdfFieldValues; onValue: (name: string, v: string | boolean) => void;
  placed: Placed[]; placing: boolean; onPlace: (e: React.MouseEvent<HTMLDivElement>) => void;
  onUpdate: (id: string, patch: Partial<Placed>) => void; onRemove: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { viewport } = view;

  useEffect(() => {
    let task: { cancel: () => void; promise: Promise<void> } | undefined;
    let live = true;
    void doc.getPage(index + 1).then((page) => {
      const canvas = canvasRef.current;
      if (!live || !canvas) return;
      // Drawn at the screen's pixel density so text stays sharp.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      task = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
      task.promise.catch(() => {});
    });
    return () => { live = false; task?.cancel(); };
  }, [doc, index, viewport]);

  const fontFor = (h: number) => Math.max(8, Math.min(14, h * 0.7));

  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto bg-white shadow-sm ring-1 ring-border" style={{ width: viewport.width, height: viewport.height }}>
        <canvas ref={canvasRef} className="absolute inset-0" style={{ width: viewport.width, height: viewport.height }} />
        <div className={`absolute inset-0 ${placing ? "cursor-crosshair" : ""}`} onClick={onPlace}>
          {view.fields.map((f) => {
            const style = { left: f.left, top: f.top, width: f.width, height: f.height, fontSize: fontFor(f.height) };
            const box = "absolute border border-primary/40 bg-primary/10 text-[#0b0b0b] focus:outline-none focus:ring-2 focus:ring-ring";
            if (f.type === "checkbox" || f.type === "radio") {
              const checked = f.type === "checkbox" ? values[f.name] === true : values[f.name] === f.onValue;
              return (
                <input
                  key={f.id} type={f.type} aria-label={f.name} className={`${box} m-0 cursor-pointer accent-primary`} style={style} checked={checked}
                  onChange={(e) => onValue(f.name, f.type === "checkbox" ? e.target.checked : (f.onValue ?? ""))}
                />
              );
            }
            if (f.type === "choice") {
              return (
                <select key={f.id} aria-label={f.name} className={`${box} px-1`} style={style} value={String(values[f.name] ?? "")} onChange={(e) => onValue(f.name, e.target.value)}>
                  <option value="" />
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              );
            }
            return f.multiline
              ? <textarea key={f.id} aria-label={f.name} className={`${box} resize-none px-1 leading-tight`} style={style} value={String(values[f.name] ?? "")} onChange={(e) => onValue(f.name, e.target.value)} />
              : <input key={f.id} aria-label={f.name} className={`${box} px-1`} style={style} value={String(values[f.name] ?? "")} onChange={(e) => onValue(f.name, e.target.value)} />;
          })}

          {placed.map((p) => (
            <PlacedItem key={p.id} item={p} scale={viewport.scale} bounds={{ width: viewport.width, height: viewport.height }} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlacedItem({ item, scale, bounds, onUpdate, onRemove }: {
  item: Placed; scale: number; bounds: { width: number; height: number };
  onUpdate: (id: string, patch: Partial<Placed>) => void; onRemove: (id: string) => void;
}) {
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const size = TEXT_PT * scale;

  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, left: item.left, top: item.top };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    onUpdate(item.id, {
      left: Math.max(0, Math.min(bounds.width - 20, d.left + e.clientX - d.x)),
      top: Math.max(0, Math.min(bounds.height - 10, d.top + e.clientY - d.y)),
    });
  };
  const up = () => { drag.current = null; };

  return (
    <div className="group absolute flex items-start" style={{ left: item.left, top: item.top }}>
      {item.kind === "text" ? (
        <input
          autoFocus={!item.text}
          aria-label="Text on page"
          className="rounded border border-dashed border-primary bg-transparent p-1 text-[#0b0b0b] focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ fontSize: size, lineHeight: 1, fontFamily: "Helvetica, Arial, sans-serif", width: Math.max(4, item.text.length + 2) + "ch" }}
          value={item.text}
          placeholder="Type here"
          onChange={(e) => onUpdate(item.id, { text: e.target.value })}
        />
      ) : (
        <img src={item.sig.src} alt="Signature" draggable={false} className="rounded border border-dashed border-primary" style={{ width: item.width, height: item.width / item.sig.ratio }} />
      )}
      <div className="ml-1 flex flex-col gap-1 opacity-70 group-hover:opacity-100">
        <button type="button" aria-label="Move" className="flex h-6 w-6 cursor-move touch-none items-center justify-center rounded bg-primary text-primary-foreground" onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          <Move className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Remove" className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background" onClick={() => onRemove(item.id)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SignatureDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (s: Signature) => void }) {
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const padRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  function point(e: ReactPointerEvent<HTMLCanvasElement>) {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function stroke(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = "#0b0b0b"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    setDrawn(true);
  }
  function clear() {
    const c = padRef.current;
    c?.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  }

  async function save() {
    let sig: Signature | null = null;
    if (mode === "type") {
      await document.fonts.load(`600 72px ${SIGN_FONT}`);
      const c = document.createElement("canvas");
      c.width = 900; c.height = 160;
      const ctx = c.getContext("2d")!;
      ctx.font = `600 72px ${SIGN_FONT}`;
      ctx.fillStyle = "#0b0b0b";
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim(), 10, 80, 880);
      sig = trimmedSignature(c);
    } else if (padRef.current) {
      sig = trimmedSignature(padRef.current);
    }
    if (sig) onSave(sig);
  }

  const ready = mode === "type" ? !!name.trim() : drawn;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Your signature</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "type" | "draw")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="type">Type</TabsTrigger>
            <TabsTrigger value="draw">Draw</TabsTrigger>
          </TabsList>
          <TabsContent value="type" className="space-y-3">
            <Label htmlFor="sig-name">Your full name</Label>
            <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-white px-3 text-4xl text-[#0b0b0b]" style={{ fontFamily: SIGN_FONT, fontWeight: 600 }}>
              {name.trim() || <span className="text-base text-muted-foreground" style={{ fontFamily: "inherit" }}>Your signature appears here</span>}
            </div>
          </TabsContent>
          <TabsContent value="draw" className="space-y-2">
            <canvas
              ref={padRef} width={900} height={300}
              className="h-40 w-full touch-none rounded-lg border border-border bg-white"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = point(e); }}
              onPointerMove={stroke}
              onPointerUp={() => { last.current = null; }}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Sign with your mouse or finger.</span>
              {drawn && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={save} disabled={!ready}>Use this signature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({ open, onOpenChange, fileName, build }: { open: boolean; onOpenChange: (o: boolean) => void; fileName: string; build: () => Promise<Uint8Array> }) {
  const send = useServerFn(sendPdfEmail);
  const [to, setTo] = useState("");
  const [from, setFrom] = useState<PdfMailbox>("admin");
  const [subject, setSubject] = useState(fileName.replace(/\.pdf$/i, ""));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { setSubject(fileName.replace(/\.pdf$/i, "")); }, [fileName]);

  const recipients = to.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const valid = recipients.length > 0 && recipients.length <= 5 && recipients.every((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));

  async function submit() {
    setSending(true);
    try {
      const bytes = await build();
      if (bytes.length > PDF_EMAIL_MAX_BYTES) throw new Error("This PDF is over 10 MB, too big to email. Download it and share it another way.");
      await send({ data: { to: recipients, from, subject: subject.trim(), message, fileName, pdf: toBase64(bytes) } });
      toast.success(`Sent to ${recipients.join(", ")}.`);
      onOpenChange(false);
      setTo(""); setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Email this PDF</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pdf-to">To</Label>
            <Input id="pdf-to" type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" />
            <p className="text-xs text-muted-foreground">Up to 5 addresses, separated by commas.</p>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Select value={from} onValueChange={(v) => setFrom(v as PdfMailbox)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PDF_MAILBOXES.map((m) => <SelectItem key={m} value={m}>{m}@camethroughaudio.com</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Replies go to this mailbox.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-subject">Subject</Label>
            <Input id="pdf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-message">Message (optional)</Label>
            <Textarea id="pdf-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={5000} />
          </div>
          <p className="text-sm text-muted-foreground">Attached: <span className="font-semibold text-foreground">{fileName}</span></p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!valid || !subject.trim() || sending}><Mail className="h-4 w-4" />{sending ? "Sending…" : "Send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
