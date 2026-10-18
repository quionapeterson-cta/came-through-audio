import { useState } from "react";
import { PROS } from "@/lib/metadata";

/** Worldwide PRO dropdown. "Other" reveals a box to type a society that isn't listed. */
export function ProSelect({ value, onChange, disabled, id, className = "w-full rounded-md border border-input bg-background px-3 py-2" }: { value: string; onChange: (v: string) => void; disabled?: boolean | undefined; id?: string | undefined; className?: string }) {
  const known = !value || (PROS as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="space-y-2">
      <select id={id} aria-label={id ? undefined : "PRO affiliation"} value={custom ? "Other" : value} disabled={disabled}
        onChange={(e) => { const v = e.target.value; setCustom(v === "Other"); onChange(v === "Other" ? "" : v); }}
        className={className}>
        <option value="">Select PRO…</option>
        {PROS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {custom && <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Type society name" aria-label="PRO society name"
        className={className} />}
    </div>
  );
}
