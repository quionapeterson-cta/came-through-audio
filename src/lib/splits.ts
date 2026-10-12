import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";

export type SplitRole = "Writer" | "Composer" | "Producer" | "Artist" | "Publisher";
export const SPLIT_ROLES: SplitRole[] = ["Writer", "Composer", "Producer", "Artist", "Publisher"];

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
  signedAt: null,
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
  signed_at: string | null;
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
    signedAt: row.signed_at,
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

/** Replace a track's split sheet with the given collaborators (delete + insert keeps it simple). */
export async function saveSplitSheet(catalogId: string, collaborators: SplitCollaborator[]) {
  const { error: delError } = await supabase.from("split_sheets").delete().eq("catalog_id", catalogId);
  if (delError) throw delError;
  const rows = collaborators
    .filter((c) => c.name.trim())
    .map((c) => ({
      catalog_id: catalogId,
      collaborator_email: c.email.trim() || "unknown@pending.invite",
      legal_name: c.name.trim(),
      assigned_percentage: Math.round(Number(c.percentage) || 0),
      role: c.role,
      pro_affiliation: c.pro || null,
      ipi_number: c.ipi || null,
      signature_name: c.signatureName || null,
      signed_at: c.signedAt,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("split_sheets").insert(rows as never);
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
  return { ...collaborator, signatureName: typedName.trim(), signedAt: `${signedAt}#${hash.slice(0, 16)}` };
}
