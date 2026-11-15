/** Saved PDFs live in a private bucket; this is the ceiling a save enforces (Supabase's own upload limit is 50 MB). */
export const PDF_SHELF_MAX_BYTES = 25 * 1024 * 1024;

/** A folder on the Admin → PDF Tools shelf. Counts let the panel show "Contracts · 3" without a second query. */
export type PdfFolder = { id: string; name: string; count: number };

/** One saved file, with a link that expires (the bucket is private). */
export type PdfShelfFile = {
  id: string;
  folderId: string;
  folder: string;
  name: string;
  size: number;
  savedAt: string;
  savedBy: string;
  url: string | null;
};

export type PdfShelf = { folders: PdfFolder[]; files: PdfShelfFile[] };

/** "Lease (signed).pdf" stays as it is; a name without the extension gets one. */
export function shelfFileName(name: string) {
  const trimmed =
    name
      .trim()
      .replace(/[\\/]+/g, "-")
      .replace(/^[.\-\s]+/, "") || "Document";
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
}

/** A storage key that survives every bucket: letters, digits, dots, dashes and underscores, spaces collapsed. */
export function shelfStorageName(name: string) {
  return (
    shelfFileName(name)
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(-120) || "document.pdf"
  );
}

/** 1234 → "1.2 KB", 1_500_000 → "1.4 MB". */
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
