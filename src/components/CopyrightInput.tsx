import { Input } from "@/components/ui/input";

const LEAD = { "©": /^\s*(©|\(c\))\s*/i, "℗": /^\s*(℗|\(p\))\s*/i } as const;

/**
 * © / ℗ line input. The symbol is a fixed prefix (it can't be deleted by accident, and it's drawn in a font that has
 * the ℗ glyph, which Poppins lacks); the field holds "year + owner" and the saved value stays "℗ 2026 Name".
 */
export function CopyrightInput({ symbol, id, value, onChange, disabled }: { symbol: "©" | "℗"; id?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const rest = (value ?? "").replace(LEAD[symbol], "");
  const year = new Date().getFullYear();
  return (
    <div className="flex h-9 w-full items-center rounded-md border border-input bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring">
      <span aria-hidden className="pl-3 pr-1.5 text-base font-semibold text-foreground" style={{ fontFamily: "'Segoe UI Symbol', 'Apple Symbols', Arial, sans-serif" }}>{symbol}</span>
      <Input id={id} disabled={disabled} aria-label={`${symbol === "©" ? "Composition" : "Sound recording"} copyright: year and owner's name`}
        className="h-full border-0 pl-0 shadow-none focus-visible:ring-0" placeholder={`${year} Your name or company`}
        value={rest} onChange={(e) => onChange(e.target.value.trim() || e.target.value ? `${symbol} ${e.target.value.replace(LEAD[symbol], "")}` : "")} />
    </div>
  );
}
