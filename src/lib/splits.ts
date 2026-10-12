import { supabase } from "@/integrations/supabase/client";
import type { CatalogTrack } from "@/lib/catalog";

export type SplitRole = "Writer" | "Composer" | "Producer" | "Artist" | "Publisher";

export type SplitCollaborator = {
  name: string;
  email: string;
  role: SplitRole;
  percentage: number;
  signed: boolean;
  signature: string;
  signedAt: string | null;
};

export type SplitSheet = {
  id: string;
  trackId: string | null;
  title: string;
  artist: string;
  collaborators: SplitCollaborator[];
  status: "draft" | "partial" | "signed";
  updatedAt: string;
};

export const emptySplitCollaborator = (): SplitCollaborator => ({
  name: "",
  email: "",
  role: "Writer",
  percentage: 0,
  signed: false,
  signature: "",
  signedAt: null,
});

export const splitTotal = (collaborators: SplitCollaborator[]) =>
  Math.round(collaborators.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0) * 100) / 100;

export const splitStatus = (collaborators: SplitCollaborator[]): SplitSheet["status"] => {
  const named = collaborators.filter((c) => c.name.trim());
  if (!named.length) return "draft";
  const signed = named.filter((c) => c.signed).length;
  if (signed === 0) return "draft";
  return signed === named.length ? "signed" : "partial";
};

/** Prefill collaborators from a catalog track's writers, composers and producers. */
export function collaboratorsFromTrack(track: CatalogTrack): SplitCollaborator[] {
  const out: SplitCollaborator[] = [];
  const push = (name: string, role: SplitRole, percentage: string) => {
    if (!name.trim() || out.some((c) => c.name === name.trim())) return;
    out.push({ ...emptySplitCollaborator(), name: name.trim(), role, percentage: Number(percentage) || 0 });
  };
  for (const w of track.metadata.writers) push(w.name, "Writer", w.percentage);
  for (const c of track.metadata.composers) push(c.name, "Composer", c.percentage);
  for (const p of track.metadata.producers ?? []) push(p.name, "Producer", p.percentage);
  if (!out.length && track.artist.trim()) out.push({ ...emptySplitCollaborator(), name: track.artist.trim(), role: "Artist", percentage: 100 });
  return out.length ? out : [emptySplitCollaborator()];
}

function toRow(sheet: Omit<SplitSheet, "id" | "updatedAt">, userId: string) {
  return {
    user_id: userId,
    track_id: sheet.trackId,
    title: sheet.title.trim(),
    artist: sheet.artist.trim(),
    collaborators: sheet.collaborators,
    status: sheet.status,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): SplitSheet {
  return {
    id: row["id"] as string,
    trackId: (row["track_id"] as string | null) ?? null,
    title: (row["title"] as string) ?? "",
    artist: (row["artist"] as string) ?? "",
    collaborators: (row["collaborators"] as SplitCollaborator[]) ?? [],
    status: (row["status"] as SplitSheet["status"]) ?? "draft",
    updatedAt: (row["updated_at"] ?? row["created_at"]) as string,
  };
}

export async function listSplitSheets(): Promise<SplitSheet[]> {
  const { data, error } = await supabase.from("split_sheets").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
}

export async function saveSplitSheet(sheet: Omit<SplitSheet, "id" | "updatedAt">, userId: string, id?: string): Promise<string> {
  const row = toRow(sheet, userId) as never;
  const query = id
    ? supabase.from("split_sheets").update(row).eq("id", id).select("id").single()
    : supabase.from("split_sheets").insert(row).select("id").single();
  const { data, error } = await query;
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteSplitSheet(id: string) {
  const { error } = await supabase.from("split_sheets").delete().eq("id", id);
  if (error) throw error;
}
