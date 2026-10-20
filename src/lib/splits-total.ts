/**
 * Split totals for one group of shares (writers together, publishers separately). One place for the 100% cap, used by
 * Embed Metadata, Add song and the Royalty Inspector. Warnings only: blank or partial splits never block saving or embedding.
 */
type Shared = { percentage: string };

const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round = (n: number) => Math.round(n * 100) / 100;

export function splitTotal(rows: Shared[]) {
  return round(rows.reduce((s, r) => s + num(r.percentage), 0));
}

/** Total, what's left, and whether it's under, exactly at, or over 100%. "empty" means no shares entered yet. */
export function splitStatus(rows: Shared[]) {
  const total = splitTotal(rows);
  const state = total === 0 ? "empty" : total > 100 ? "over" : total < 100 ? "under" : "full";
  return { total, left: round(Math.max(0, 100 - total)), over: round(Math.max(0, total - 100)), state } as const;
}

/**
 * The value a share box accepts: at most what the other rows leave. Lowering a share is always allowed, so a song
 * already over 100% can be fixed one box at a time. Returns the value to store and the cap when it snapped.
 */
export function capShare(rows: Shared[], index: number, value: string): { value: string; cappedAt?: number } {
  const v = Number(value);
  if (value.trim() === "" || !Number.isFinite(v)) return { value };
  if (v < 0) return { value: "0" };
  const others = splitTotal(rows.filter((_, i) => i !== index));
  const max = round(Math.max(0, 100 - others));
  const old = num(rows[index]?.percentage ?? "");
  if (v <= max || v <= old) return { value };
  const cap = Math.max(max, old);
  return { value: String(cap), cappedAt: cap };
}

/** "Total: 85% · 15% left" / "Total: 110%, 10% over". */
export function splitSummary(rows: Shared[]) {
  const s = splitStatus(rows);
  if (s.state === "over") return `Total: ${s.total}%, ${s.over}% over. Lower a share to fix it.`;
  if (s.state === "full") return "Total: 100%";
  return `Total: ${s.total}% · ${s.left}% left`;
}
