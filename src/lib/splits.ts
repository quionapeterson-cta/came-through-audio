import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";

export type SplitRole = "Writer" | "Composer" | "Author/Composer" | "Producer" | "Artist" | "Publisher";
export const SPLIT_ROLES: SplitRole[] = ["Writer", "Composer", "Author/Composer", "Producer", "Artist", "Publisher"];

export type SplitCollaborator = {
  rowId?: string;
  name: string;
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
  for (const w of track.metadata.writers) push(w.name, "Writer", w.percentage, w.pro, w.ipi);
  for (const c of track.metadata.composers) push(c.name, "Composer", c.percentage, c.pro, c.ipi);
  for (const p of track.metadata.producers ?? []) push(p.name, "Producer", p.percentage, p.pro, p.ipi);
  if (!out.length && track.artist.trim()) out.push({ ...emptySplitCollaborator(), name: track.artist.trim(), role: "Artist", percentage: 100 });
  return out.length ? out : [emptySplitCollaborator()];
}

type SplitRow = {
  id: string;
  catalog_id: string;
  collaborator_email: string;
  assigned_percentage: number;
  legal_name: string | null;
  pro_affiliation: string | null;
  ipi_number: string | null;
  role: string;
  signature_name: string | null;
  signature_hash: string | null;
  signed_at: string | null;
  is_owner: boolean | null;
  invited_at: string | null;
};

function fromRow(row: SplitRow): SplitCollaborator {
  return {
    rowId: row.id,
    name: row.legal_name ?? "",
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
    assigned_percentage: Math.round(Number(c.percentage) || 0),
    role: c.role,
    pro_affiliation: c.pro || null,
    ipi_number: c.ipi || null,
    signature_name: c.signatureName || null,
    signature_hash: c.signatureHash || null,
    signed_at: c.signedAt,
    is_owner: c.isOwner,
    invited_at: c.invitedAt,
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
  return saved;
}

export const signLink = (rowId: string) => `${window.location.origin}/sign/${rowId}`;

export type SplitInvite = {
  row_id: string; track_title: string; artist_name: string; isrc: string | null;
  legal_name: string; role: string; percentage: number; pro: string | null; ipi: string | null; signed_at: string | null;
  collaborators: { name: string; role: string; percentage: number; signed: boolean }[];
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
