import { supabase } from "@/integrations/supabase/client";
import { hasPro, isIpi } from "@/lib/audit";
import type { CatalogTrack } from "@/lib/catalog";
import { creditName, writerRole, type Contributor, type Metadata } from "@/lib/metadata";

/**
 * Co-writer PRO / IPI requests (public.ipi_requests, PLAN-cowriter-ipi-request.md). The owner asks; the co-writer
 * answers from /ipi/$id with a free account under the invited email; the owner approves, which fills blanks only.
 */
export type IpiAnswer = { legal_name: string; pro: string; ipi: string; no_pro: boolean };
export type IpiRequest = {
  id: string; writerName: string; role: string; email: string; songs: { catalog_id: string; title: string }[]; artistName: string;
  status: "pending" | "answered" | "applied" | "dismissed"; answer: IpiAnswer | null; sentAt: string | null; expiresAt: string; createdAt: string;
};
type Row = { id: string; writer_name: string; role: string; email: string; songs: IpiRequest["songs"]; artist_name: string; status: IpiRequest["status"]; answer: IpiAnswer | null; sent_at: string | null; expires_at: string; created_at: string };
const toRequest = (r: Row): IpiRequest => ({ id: r.id, writerName: r.writer_name, role: r.role, email: r.email, songs: r.songs, artistName: r.artist_name, status: r.status, answer: r.answer, sentAt: r.sent_at, expiresAt: r.expires_at, createdAt: r.created_at });
const COLS = "id, writer_name, role, email, songs, artist_name, status, answer, sent_at, expires_at, created_at";

/** Agencies often write names in a different order or case: compare the words in any order. */
export const nameKey = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const rowsOf = (m: Metadata) => [...m.writers, ...m.composers];
const missing = (w: Contributor) => !hasPro(w.pro) || !isIpi(w.ipi ?? "");

/** Co-writers (not you) who are missing a PRO or IPI, with every song they're missing them on. */
export function cowritersMissing(tracks: CatalogTrack[], ownName = ""): { name: string; role: string; songs: { catalog_id: string; title: string }[] }[] {
  const me = nameKey(ownName);
  const out = new Map<string, { name: string; role: string; songs: { catalog_id: string; title: string }[] }>();
  for (const t of tracks) for (const w of rowsOf(t.metadata)) {
    const name = creditName(w), k = nameKey(name);
    if (!name || (me && k === me) || !missing(w)) continue;
    const e = out.get(k) ?? { name, role: writerRole(w.role), songs: [] };
    if (!e.songs.some((s) => s.catalog_id === t.id)) e.songs.push({ catalog_id: t.id, title: t.title || "Untitled" });
    out.set(k, e);
  }
  return [...out.values()];
}

/** Fills this writer's blank PRO and IPI from an answer. Never replaces anything already entered (AGENTS.md). */
export function fillWriter(m: Metadata, writerName: string, a: IpiAnswer): Metadata | null {
  if (a.no_pro) return null;
  const keys = new Set([nameKey(writerName), nameKey(a.legal_name)]);
  let changed = false;
  const fill = (rows: Contributor[]) => rows.map((w) => {
    if (!keys.has(nameKey(creditName(w)))) return w;
    const next = { ...w, pro: w.pro?.trim() ? w.pro : a.pro, ipi: w.ipi?.trim() ? w.ipi : a.ipi };
    if (next.pro !== w.pro || next.ipi !== w.ipi) changed = true;
    return next;
  });
  const out = { ...m, writers: fill(m.writers), composers: fill(m.composers) };
  return changed ? out : null;
}

export async function createIpiRequest(r: { writerName: string; role: string; email: string; songs: IpiRequest["songs"]; artistName: string }): Promise<IpiRequest> {
  const { data, error } = await supabase.from("ipi_requests" as never)
    .insert({ writer_name: r.writerName.trim().slice(0, 120), role: r.role, email: r.email.trim().toLowerCase(), songs: r.songs.slice(0, 200), artist_name: r.artistName.trim().slice(0, 120) } as never)
    .select(COLS).single();
  if (error) throw error;
  return toRequest(data as Row);
}

export async function listIpiRequests(): Promise<IpiRequest[]> {
  const { data, error } = await supabase.from("ipi_requests" as never).select(COLS).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toRequest);
}

export async function setIpiRequestStatus(id: string, status: "applied" | "dismissed") {
  const { error } = await supabase.from("ipi_requests" as never).update({ status } as never).eq("id", id);
  if (error) throw error;
}

export const ipiLink = (id: string) => `${window.location.origin}/ipi/${id}`;

/** The invitee's view (their account email must match the invited email). */
export type IpiInvite = { id: string; writer_name: string; role: string; artist_name: string; songs: string[]; answered: boolean; expired: boolean; answer: IpiAnswer | null };
export async function getIpiInvite(id: string): Promise<IpiInvite | null> {
  const { data, error } = await supabase.rpc("get_ipi_request" as never, { _id: id } as never);
  if (error) throw error;
  return data as unknown as IpiInvite | null;
}
export async function answerIpiInvite(id: string, a: IpiAnswer) {
  const { error } = await supabase.rpc("answer_ipi_request" as never, { _id: id, _legal_name: a.legal_name, _pro: a.pro, _ipi: a.ipi, _no_pro: a.no_pro } as never);
  if (error) throw error;
}
