import { supabase } from "@/integrations/supabase/client";
import { requestBadgeCheck } from "@/lib/badge-events";
import type { CatalogTrack } from "@/lib/catalog";
import { PROS, creditName, type Metadata } from "@/lib/metadata";
import { registrationWriters } from "@/lib/readiness";

export type SplitRole = "Writer" | "Composer" | "Author/Composer" | "Producer" | "Artist" | "Publisher";
export const SPLIT_ROLES: SplitRole[] = ["Writer", "Composer", "Author/Composer", "Producer", "Artist", "Publisher"];

/** Worldwide PRO choices, shared with the catalog and profile forms. */
export const ALL_PROS = PROS;

export type SplitCollaborator = {
  rowId?: string;
  name: string;
  performerName: string;
  publisherName: string;
  publisherPro: string;
  publisherIpi: string;
  publisherPercentage: number;
  email: string;
  role: SplitRole;
  percentage: number;
  pro: string;
  ipi: string;
  signatureName: string;
  signatureHash: string;
  signedAt: string | null;
  isOwner: boolean;
  invitedAt: string | null;
  /** Sheet-wide open notes, stored on every row of the sheet. */
  notes: string;
};

export type SplitSheet = {
  catalogId: string;
  title: string;
  artist: string;
  collaborators: SplitCollaborator[];
  status: "draft" | "partial" | "signed";
};

export const emptySplitCollaborator = (): SplitCollaborator => ({
  name: "",
  performerName: "",
  publisherName: "",
  publisherPro: "",
  publisherIpi: "",
  publisherPercentage: 0,
  email: "",
  role: "Writer",
  percentage: 0,
  pro: "",
  ipi: "",
  signatureName: "",
  signatureHash: "",
  signedAt: null,
  isOwner: false,
  invitedAt: null,
  notes: "",
});

export const splitTotal = (collaborators: SplitCollaborator[]) =>
  Math.round(collaborators.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0) * 100) / 100;

export const splitStatus = (collaborators: SplitCollaborator[]): SplitSheet["status"] => {
  const named = collaborators.filter((c) => c.name.trim());
  if (!named.length) return "draft";
  const signed = named.filter((c) => c.signedAt).length;
  if (signed === 0) return "draft";
  return signed === named.length ? "signed" : "partial";
};

/** Prefill collaborators from a catalog track's writers, composers and producers. */
export function collaboratorsFromTrack(track: CatalogTrack): SplitCollaborator[] {
  const out: SplitCollaborator[] = [];
  const push = (name: string, role: SplitRole, percentage: string, pro: string, ipi: string) => {
    if (!name.trim() || out.some((c) => c.name === name.trim())) return;
    out.push({ ...emptySplitCollaborator(), name: name.trim(), role, percentage: Number(percentage) || 0, pro, ipi });
  };
  // Split sheets are legal records: writers come in under their legal name when known.
  for (const w of registrationWriters(track.metadata)) push(w.name, w.role === "Author" ? "Writer" : (w.role as SplitRole), w.percentage, w.pro, w.ipi);
  for (const p of track.metadata.producers ?? []) push(p.name, "Producer", p.percentage, p.pro, p.ipi);
  if (!out.length && track.artist.trim()) out.push({ ...emptySplitCollaborator(), name: track.artist.trim(), role: "Artist", percentage: 100 });
  return out.length ? out : [emptySplitCollaborator()];
}

/**
 * The track's catalog metadata with the split sheet's percentages copied onto the matching writer, composer and
 * producer rows (matched by name, first match only, the same rows collaboratorsFromTrack read them from). Only
 * percentages change: no row is added or removed. Returns null when nothing differs.
 */
export function catalogWithSplits(track: CatalogTrack, collaborators: SplitCollaborator[]): Metadata | null {
  const m = track.metadata;
  const groups = { writers: m.writers.map((r) => ({ ...r })), composers: m.composers.map((r) => ({ ...r })), producers: (m.producers ?? []).map((r) => ({ ...r })) };
  const key = (name: string) => name.trim().toLowerCase();
  let changed = false;
  for (const c of collaborators) {
    if (!c.name.trim()) continue;
    const row = [...groups.writers, ...groups.composers, ...groups.producers].find((r) => key(creditName(r)) === key(c.name));
    if (!row || Number(row.percentage || 0) === c.percentage) continue;
    row.percentage = String(c.percentage);
    changed = true;
  }
  return changed ? { ...m, ...groups } : null;
}

type SplitRow = {
  id: string;
  catalog_id: string;
  collaborator_email: string;
  assigned_percentage: number;
  legal_name: string | null;
  performer_name?: string | null;
  publisher_name?: string | null;
  publisher_pro?: string | null;
  publisher_ipi?: string | null;
  publisher_percentage?: number | null;
  pro_affiliation: string | null;
  ipi_number: string | null;
  role: string;
  signature_name: string | null;
  signature_hash: string | null;
  signed_at: string | null;
  is_owner: boolean | null;
  invited_at: string | null;
  notes?: string | null;
};

function fromRow(row: SplitRow): SplitCollaborator {
  return {
    rowId: row.id,
    name: row.legal_name ?? "",
    performerName: row.performer_name ?? "",
    publisherName: row.publisher_name ?? "",
    publisherPro: row.publisher_pro ?? "",
    publisherIpi: row.publisher_ipi ?? "",
    publisherPercentage: Number(row.publisher_percentage) || 0,
    email: row.collaborator_email ?? "",
    role: (SPLIT_ROLES as string[]).includes(row.role) ? (row.role as SplitRole) : "Writer",
    percentage: Number(row.assigned_percentage) || 0,
    pro: row.pro_affiliation ?? "",
    ipi: row.ipi_number ?? "",
    signatureName: row.signature_name ?? "",
    signatureHash: row.signature_hash ?? "",
    signedAt: row.signed_at,
    isOwner: !!row.is_owner,
    invitedAt: row.invited_at,
    notes: row.notes ?? "",
  };
}

/** Fetch all of the owner's split sheets, grouped by catalog track. */
export async function listSplitSheets(): Promise<Map<string, SplitCollaborator[]>> {
  const { data, error } = await supabase.from("split_sheets").select("*");
  if (error) throw error;
  const map = new Map<string, SplitCollaborator[]>();
  for (const row of (data ?? []) as unknown as SplitRow[]) {
    const list = map.get(row.catalog_id) ?? [];
    list.push(fromRow(row));
    map.set(row.catalog_id, list);
  }
  return map;
}

/** Save a track's split sheet. Existing rows keep their id so signature links stay valid; signed rows are never overwritten. */
export async function saveSplitSheet(catalogId: string, collaborators: SplitCollaborator[]): Promise<SplitCollaborator[]> {
  const named = collaborators.filter((c) => c.name.trim());
  const toRow = (c: SplitCollaborator) => ({
    catalog_id: catalogId,
    collaborator_email: c.email.trim() || "unknown@pending.invite",
    legal_name: c.name.trim(),
    performer_name: c.performerName.trim() || null,
    publisher_name: c.publisherName.trim() || null,
    publisher_pro: c.publisherPro || null,
    publisher_ipi: c.publisherIpi.trim() || null,
    publisher_percentage: c.publisherName.trim() ? Number(c.publisherPercentage) || 0 : null,
    assigned_percentage: Math.round(Number(c.percentage) || 0),
    role: c.role,
    pro_affiliation: c.pro || null,
    ipi_number: c.ipi || null,
    signature_name: c.signatureName || null,
    signature_hash: c.signatureHash || null,
    signed_at: c.signedAt,
    is_owner: c.isOwner,
    invited_at: c.invitedAt,
    notes: c.notes.trim() || null,
  });
  const { data: current, error: curErr } = await supabase.from("split_sheets").select("id, signed_at").eq("catalog_id", catalogId);
  if (curErr) throw curErr;
  const keep = new Set(named.map((c) => c.rowId).filter(Boolean));
  const remove = (current ?? []).filter((r) => !keep.has(r.id)).map((r) => r.id);
  if (remove.length) {
    const { error } = await supabase.from("split_sheets").delete().in("id", remove);
    if (error) throw error;
  }
  const signedRemote = new Set((current ?? []).filter((r) => r.signed_at).map((r) => r.id));
  const saved: SplitCollaborator[] = [];
  for (const c of named) {
    if (c.rowId && signedRemote.has(c.rowId)) { saved.push(c); continue; }
    if (c.rowId) {
      const { error } = await supabase.from("split_sheets").update(toRow(c) as never).eq("id", c.rowId);
      if (error) throw error;
      saved.push(c);
    } else {
      const { data, error } = await supabase.from("split_sheets").insert(toRow(c) as never).select("id").single();
      if (error) throw error;
      saved.push({ ...c, rowId: (data as { id: string }).id });
    }
  }
  requestBadgeCheck();
  return saved;
}

export const signLink = (rowId: string) => `${window.location.origin}/sign/${rowId}`;

export type SplitInvite = {
  row_id: string; track_title: string; artist_name: string; isrc: string | null;
  legal_name: string; performer_name: string | null; role: string;
  publisher_name: string | null; publisher_pro: string | null; publisher_ipi: string | null; publisher_percentage: number | null; notes: string | null; percentage: number; pro: string | null; ipi: string | null; signed_at: string | null;
  collaborators: { name: string; performer: string | null; role: string; percentage: number; signed: boolean }[];
};

export async function getSplitInvite(rowId: string): Promise<SplitInvite | null> {
  const { data, error } = await supabase.rpc("get_split_invite" as never, { _row_id: rowId } as never);
  if (error) throw error;
  return data as unknown as SplitInvite | null;
}

export async function signSplitInvite(rowId: string, typedName: string, pro: string, ipi: string, email: string, percentage: number) {
  const signedAt = new Date().toISOString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${typedName.trim()}|${email}|${percentage}|${rowId}|${signedAt}`));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.rpc("sign_split_invite" as never, { _row_id: rowId, _signature_name: typedName, _pro: pro, _ipi: ipi, _hash: hash } as never);
  if (error) throw error;
}

export async function deleteSplitSheet(catalogId: string) {
  const { error } = await supabase.from("split_sheets").delete().eq("catalog_id", catalogId);
  if (error) throw error;
}

/** Typed e-signature: stores the typed legal name and a SHA-256 signature hash. */
export async function signCollaborator(collaborator: SplitCollaborator, typedName: string): Promise<SplitCollaborator> {
  const signedAt = new Date().toISOString();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${typedName.trim()}|${collaborator.email}|${collaborator.percentage}|${signedAt}`),
  );
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { ...collaborator, signatureName: typedName.trim(), signatureHash: hash, signedAt };
}

// ---------- Saved contributor library ----------
export const CONTRIBUTOR_KINDS = ["Writer", "Composer", "Producer", "Artist", "Publisher", "Label"] as const;
export type SavedContributor = { id?: string; name: string; kind: string; email: string; pro: string; ipi: string; publisher: string; label: string };

export async function listContributors(): Promise<SavedContributor[]> {
  const { data, error } = await supabase.from("contributors" as never).select("*").order("name");
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; name: string | null; kind: string | null; email: string | null; pro: string | null; ipi: string | null; publisher: string | null; label: string | null }[]).map((r) => ({
    id: r.id, name: r.name ?? "", kind: r.kind ?? "Writer", email: r.email ?? "",
    pro: r.pro ?? "", ipi: r.ipi ?? "", publisher: r.publisher ?? "", label: r.label ?? "",
  }));
}

/** Upsert contributors into the user's library (keyed by name + kind). Empty fields never overwrite saved values. */
export async function saveContributors(userId: string, list: SavedContributor[]) {
  const clean = list.filter((c) => c.name.trim());
  if (!clean.length) return;
  const existing = await listContributors().catch(() => [] as SavedContributor[]);
  const rows = clean.map((c) => {
    const prev = existing.find((e) => e.name.toLowerCase() === c.name.trim().toLowerCase() && e.kind === c.kind);
    const pick = (a: string, b?: string) => (a.trim() || b || null);
    return {
      user_id: userId, name: c.name.trim(), kind: c.kind,
      email: pick(c.email, prev?.email), pro: pick(c.pro, prev?.pro), ipi: pick(c.ipi, prev?.ipi),
      publisher: pick(c.publisher, prev?.publisher), label: pick(c.label, prev?.label),
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await supabase.from("contributors" as never).upsert(rows as never, { onConflict: "user_id,name,kind" });
  if (error) throw error;
}

export async function deleteContributor(id: string) {
  const { error } = await supabase.from("contributors" as never).delete().eq("id", id);
  if (error) throw error;
}
