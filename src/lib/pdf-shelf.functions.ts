import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PDF_SHELF_MAX_BYTES, shelfFileName, shelfStorageName, type PdfShelf } from "./pdf-shelf";

/**
 * Saved PDFs (founder, 2026-11-15): the shelf under Admin → PDF Tools. Any staff member saves a filled or signed PDF
 * into a folder, and every staff member can open it again later. Files sit in a private bucket and are read only
 * through a short-lived signed link, so a forward of the page never exposes them.
 *
 * Everything runs on the caller's own session: the staff-only row-level rules in migration 20261115120000 decide what
 * a save, a listing or a download may see, not a bypass key.
 */

type Ctx = { supabase: SupabaseClient; userId: string };
const BUCKET = "saved-pdfs";
const SIGNED_FOR = 60 * 60;

async function requireStaff(context: Ctx): Promise<void> {
  const { data } = await context.supabase.rpc(
    "is_staff" as never,
    { _user_id: context.userId } as never,
  );
  if (!data) throw new Error("Only staff can use Saved PDFs.");
}

type FolderRow = { id: string; name: string };
type FileRow = {
  id: string;
  folder_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  saved_by: string;
  created_at: string;
};

/** Every folder and file, newest first, with a one-hour download link for each file. */
export const listPdfShelf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PdfShelf> => {
    await requireStaff(context);
    const db = context.supabase as unknown as Ctx["supabase"];
    const [folderRes, fileRes] = await Promise.all([
      db
        .from("pdf_folders" as never)
        .select("id, name")
        .order("name"),
      db
        .from("saved_pdfs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (folderRes.error || fileRes.error) {
      throw new Error("Couldn't load Saved PDFs. Run migration 20261115120000 first.");
    }
    const folderRows = (folderRes.data ?? []) as unknown as FolderRow[];
    const fileRows = (fileRes.data ?? []) as unknown as FileRow[];
    const folderName = new Map(folderRows.map((f) => [f.id, f.name]));

    const people = [...new Set(fileRows.map((f) => f.saved_by))];
    const names = new Map<string, string>();
    if (people.length) {
      const { data } = await db
        .from("profiles")
        .select("id, stage_name, legal_name")
        .in("id", people);
      for (const p of (data ?? []) as {
        id: string;
        stage_name: string | null;
        legal_name: string | null;
      }[]) {
        names.set(p.id, p.legal_name || p.stage_name || "");
      }
    }

    const files = await Promise.all(
      fileRows.map(async (row) => {
        const { data: signed } = await db.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_FOR, { download: row.name });
        return {
          id: row.id,
          folderId: row.folder_id,
          folder: folderName.get(row.folder_id) ?? "Unfiled",
          name: row.name,
          size: row.size_bytes,
          savedAt: row.created_at,
          savedBy: names.get(row.saved_by) ?? "",
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    const counts = new Map<string, number>();
    for (const file of files) counts.set(file.folderId, (counts.get(file.folderId) ?? 0) + 1);

    return {
      folders: folderRows.map((f) => ({ id: f.id, name: f.name, count: counts.get(f.id) ?? 0 })),
      files,
    };
  });

/** A new folder anyone on the team can save into. Names are unique, ignoring capitals. */
export const createPdfFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "Give the folder a name.")
          .max(60, "Keep the name under 60 characters."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; name: string }> => {
    await requireStaff(context);
    const { data: created, error } = await context.supabase
      .from("pdf_folders" as never)
      .insert({ name: data.name, created_by: context.userId } as never)
      .select("id, name")
      .single();
    if (error) {
      // 23505 is the unique index on the name: the folder is already there.
      if ((error as { code?: string }).code === "23505")
        throw new Error(`There's already a folder called “${data.name}”.`);
      throw new Error("Couldn't create the folder. Run migration 20261115120000 first.");
    }
    const folder = created as unknown as FolderRow;
    return { id: folder.id, name: folder.name };
  });

/** Saves the finished PDF into a folder. The bytes are built in the browser and stored once, never emailed. */
export const savePdfToShelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        folderId: z.string().uuid("Pick a folder."),
        fileName: z.string().trim().min(1).max(200),
        pdf: z
          .string()
          .min(1)
          .max(Math.ceil(PDF_SHELF_MAX_BYTES / 3) * 4, "This PDF is over 25 MB."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; folderId: string }> => {
    await requireStaff(context);
    const db = context.supabase;
    const { data: folder } = await db
      .from("pdf_folders" as never)
      .select("id")
      .eq("id", data.folderId)
      .maybeSingle();
    if (!folder) throw new Error("That folder no longer exists. Pick another one.");

    const name = shelfFileName(data.fileName);
    const path = `${data.folderId}/${crypto.randomUUID()}-${shelfStorageName(name)}`;
    const bytes = Buffer.from(data.pdf, "base64");
    if (bytes.length > PDF_SHELF_MAX_BYTES)
      throw new Error("This PDF is over 25 MB, too big to save here.");
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error("Couldn't save the file. Run migration 20261115120000 first.");

    const { data: inserted, error: rowError } = await db
      .from("saved_pdfs" as never)
      .insert({
        folder_id: data.folderId,
        name,
        storage_path: path,
        size_bytes: bytes.length,
        saved_by: context.userId,
      } as never)
      .select("id, folder_id")
      .single();
    if (rowError) {
      // Don't leave a file in the bucket that no row points at.
      await db.storage.from(BUCKET).remove([path]);
      throw new Error("Couldn't save the file. Run migration 20261115120000 first.");
    }
    const row = inserted as unknown as { id: string; folder_id: string };
    return { id: row.id, folderId: row.folder_id };
  });

/** Removes a file from the shelf; the bucket object goes with the row. */
export const deleteSavedPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const db = context.supabase;
    const { data: row } = await db
      .from("saved_pdfs" as never)
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const path = (row as { storage_path?: string } | null)?.storage_path;
    if (!path) throw new Error("That file is already gone.");
    const { error } = await db
      .from("saved_pdfs" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Couldn't remove the file.");
    await db.storage.from(BUCKET).remove([path]);
    return { ok: true };
  });
