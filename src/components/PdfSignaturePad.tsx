import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { BRAND } from "@/lib/pdf-templates";
import { loadWebFont } from "@/lib/web-fonts";

/** The same legible cursive the contract signatures use (public/fonts, Script & hand-drawn). */
const SIGNATURE_FAMILY = "Dancing Script";

export type SignatureSize = "sm" | "md" | "lg";

export type SignatureValue = {
  kind: "draw" | "type";
  /** A PNG data URL: strokes for a drawn signature, the name set in cursive for a typed one. */
  data: string;
  name: string;
  /** How large it prints on the line, for a name that needs the room. */
  size?: SignatureSize;
};

const SIZE_LABELS: { value: SignatureSize; label: string; hint: string }[] = [
  { value: "sm", label: "S", hint: "Small" },
  { value: "md", label: "M", hint: "Medium" },
  { value: "lg", label: "L", hint: "Large" },
];

/**
 * Draws a typed name in cursive and returns it as a PNG. Long names shrink until they fit the same canvas, so a name
 * like "Alexandria-Catherine Whitfield" still ends at the signature line instead of running past it.
 */
function typedSignaturePng(name: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const base = 160;
    const maxWidth = 1400;
    const font = (size: number) => `700 ${size}px "${SIGNATURE_FAMILY}", "Segoe Script", cursive`;
    ctx.font = font(base);
    const measured = ctx.measureText(name).width || 1;
    const fontSize =
      measured > maxWidth ? Math.max(56, Math.floor((base * maxWidth) / measured)) : base;
    ctx.font = font(fontSize);
    const metrics = ctx.measureText(name);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.3;
    const pad = Math.round(fontSize * 0.14);
    canvas.width = Math.ceil(metrics.width + pad * 2);
    canvas.height = Math.ceil(ascent + descent + pad * 2);
    const paint = canvas.getContext("2d");
    if (!paint) return null;
    paint.font = font(fontSize);
    paint.fillStyle = BRAND.black;
    paint.textBaseline = "alphabetic";
    paint.fillText(name, pad, pad + ascent);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * A signature pad that works with a finger, a stylus or a mouse, with typing as the alternative for anyone who cannot
 * draw (founder, 2026-11-15). Both paths end as a PNG, so the page and the PDF show the same signature; typed names are
 * set in a legible cursive rather than an italic sans. Gold marks a signature already captured.
 */
export function PdfSignaturePad({
  value,
  onChange,
  label = "Signature",
  name,
}: {
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  label?: string;
  /** The signer's name, used as the typed signature and to label the pad. */
  name?: string;
}) {
  const [mode, setMode] = useState<"draw" | "type">(value?.kind === "type" ? "type" : "draw");
  const [typed, setTyped] = useState(value?.kind === "type" ? value.name : (name ?? ""));
  const [size, setSize] = useState<SignatureSize>(value?.size ?? "md");
  const [cursiveReady, setCursiveReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    loadWebFont(SIGNATURE_FAMILY);
    let alive = true;
    void document.fonts?.ready.then(() => alive && setCursiveReady(true)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 640 * ratio;
    canvas.height = 180 * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = BRAND.black;
  }, [mode]);

  /** A typed name becomes the same kind of PNG a drawn one is, set in cursive. */
  useEffect(() => {
    if (mode !== "type") return;
    const clean = typed.trim();
    if (!clean) {
      onChange(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await document.fonts?.load(`700 160px "${SIGNATURE_FAMILY}"`);
      } catch {
        // The system's own script face is the fallback the canvas already names.
      }
      if (cancelled) return;
      const png = typedSignaturePng(clean);
      if (!cancelled) onChange({ kind: "type", data: png ?? clean, name: clean, size });
    })();
    return () => {
      cancelled = true;
    };
  }, [typed, mode, size, cursiveReady]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The size also moves a signature that was already captured. */
  useEffect(() => {
    if (value && value.size !== size) onChange({ ...value, size });
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 640,
      y: ((event.clientY - rect.top) / rect.height) * 180,
    };
  };

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      onChange({ kind: "draw", data: canvas.toDataURL("image/png"), name: name ?? typed, size });
    } catch {
      // A canvas that cannot be read still leaves the typed path available.
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  }

  const captured = !!value;
  const typedPreview =
    value?.kind === "type" && value.data.startsWith("data:image/png") ? value.data : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-border p-0.5 text-[11px]">
            <span className="px-1.5 text-muted-foreground">Size</span>
            {SIZE_LABELS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                aria-label={`${label} size: ${option.hint}`}
                aria-pressed={size === option.value}
                onClick={() => setSize(option.value)}
                className={`rounded-full px-2 py-1 font-semibold ${size === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${mode === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <PenLine className="h-3 w-3" /> Draw
            </button>
            <button
              type="button"
              onClick={() => setMode("type")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${mode === "type" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Type className="h-3 w-3" /> Type
            </button>
          </div>
        </div>
      </div>

      {mode === "draw" ? (
        <div
          className="relative rounded-lg border"
          style={{
            borderColor: captured ? BRAND.gold : BRAND.platinum,
            background: BRAND.white,
            boxShadow: captured ? `0 0 0 2px ${BRAND.gold}44` : undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            aria-label="Signature drawing area"
            className="block h-[150px] w-full touch-none rounded-lg"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] text-muted-foreground"
          >
            <Eraser className="h-3 w-3" /> Clear
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your full name"
            aria-label="Typed signature"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <div
            className="flex min-h-[76px] items-center justify-center overflow-hidden rounded-lg border px-3"
            style={{ borderColor: captured ? BRAND.gold : BRAND.platinum, background: BRAND.white }}
          >
            {typedPreview ? (
              <img
                src={typedPreview}
                alt={`Typed signature: ${value?.name ?? typed}`}
                className="max-h-16 max-w-full"
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                Your name in cursive, as it will print.
              </span>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px]" style={{ color: captured ? BRAND.cobalt : undefined }}>
        {captured
          ? "✓ Signature captured. It is stamped on the document with the date."
          : "Sign above, or switch to Type and enter your name."}
      </p>
    </div>
  );
}
