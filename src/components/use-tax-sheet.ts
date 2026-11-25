import { useEffect, useState } from "react";
import { readLabJson, writeLabJson } from "@/lib/financial-lab-scenario";
import { sanitizeTaxSheet, type TaxSheet } from "@/lib/financial-lab-tax";

/** The worksheet saved for this member and song, or an empty one when nothing readable is there. */
export function readTaxSheet(key: string | undefined): TaxSheet {
  return sanitizeTaxSheet(key ? readLabJson<unknown>(key) : null);
}

/**
 * The worksheet for one key, written back as it changes. The key and its sheet travel together, so switching songs
 * can never save one song's costs under another's name, and the drawer survives a refresh like the rest of the Lab.
 */
export function useTaxSheet(key: string | undefined) {
  const keyNow = key ?? "";
  const [state, setState] = useState(() => ({ key: keyNow, sheet: readTaxSheet(key) }));
  // A new song's worksheet is read before this render commits, so the member never sees the previous song's lines.
  if (state.key !== keyNow) setState({ key: keyNow, sheet: readTaxSheet(key) });

  const update = (next: TaxSheet | ((current: TaxSheet) => TaxSheet)) =>
    setState((current) => ({
      ...current,
      sheet: typeof next === "function" ? next(current.sheet) : next,
    }));

  useEffect(() => {
    if (!state.key) return;
    const timer = window.setTimeout(() => writeLabJson(state.key, state.sheet), 300);
    return () => window.clearTimeout(timer);
  }, [state]);

  return [state.sheet, update] as const;
}
