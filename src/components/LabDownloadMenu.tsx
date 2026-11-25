import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * One Financial Lab download control, offering the three formats the Production Budget Planner set the standard for
 * (founder, 2026-11-25): a fillable PDF, a Google Sheets CSV and an Excel workbook. A popover rather than a Radix
 * dropdown, because a dropdown opens on pointer-down and the click that opened it lands on its first item.
 */
export type LabDownloadFormat = "pdf" | "sheets" | "excel";

const LABELS: Record<LabDownloadFormat, string> = {
  pdf: "Fillable PDF",
  sheets: "Google Sheet",
  excel: "Excel sheet",
};

const HINTS: Record<LabDownloadFormat, string> = {
  pdf: "A branded PDF that fills in and recalculates in Adobe Acrobat or Reader",
  sheets: "A .csv for Google Sheets with the totals as live formulas",
  excel: "A .xlsx workbook with the formulas built in",
};

export function LabDownloadMenu({
  label,
  busy,
  onPick,
  hints,
  className,
  align = "start",
}: {
  label: string;
  busy?: boolean;
  onPick: (format: LabDownloadFormat) => void;
  hints?: Partial<Record<LabDownloadFormat, string>>;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(className ?? "fl-tool-btn")}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy ? "Building your file…" : label}
          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-80 p-2">
        <p className="px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Choose a format
        </p>
        <div role="menu" aria-label={`${label} formats`}>
          {(Object.keys(LABELS) as LabDownloadFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onPick(format);
              }}
            >
              <span className="font-semibold">{LABELS[format]}</span>
              <span className="text-xs text-muted-foreground">
                {hints?.[format] ?? HINTS[format]}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
