import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { BRAND } from "@/lib/pdf-templates";

export type SignatureValue = { kind: "draw" | "type"; data: string; name: string };

/**
 * A signature pad that works with a finger, a stylus or a mouse, with typing as the alternative for anyone who cannot
 * draw (founder, 2026-11-15). The drawn signature is a PNG data URL; a typed one is the name itself, and the PDF sets it
 * in an italic face. Gold marks a signature already captured, so a signer can see at a glance what is done.
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

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
      onChange({ kind: "draw", data: canvas.toDataURL("image/png"), name: name ?? typed });
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
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
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            onChange(
              e.target.value.trim()
                ? { kind: "type", data: e.target.value, name: e.target.value }
                : null,
            );
          }}
          placeholder="Type your full name"
          aria-label="Typed signature"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      )}

      <p className="text-[11px]" style={{ color: captured ? BRAND.cobalt : undefined }}>
        {captured
          ? "✓ Signature captured. It is stamped on the document with the date."
          : "Sign above, or switch to Type and enter your name."}
      </p>
    </div>
  );
}
