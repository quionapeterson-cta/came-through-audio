import { useEffect, useState } from "react";
import { Download, FileText, Folder, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmAction } from "@/components/ConfirmHost";
import {
  createPdfFolder,
  deleteSavedPdf,
  listPdfShelf,
  savePdfToShelf,
} from "@/lib/pdf-shelf.functions";
import { fileSize, PDF_SHELF_MAX_BYTES, type PdfFolder, type PdfShelf } from "@/lib/pdf-shelf";
import { toBase64 } from "@/lib/pdf-tools";

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Save this PDF (founder, 2026-11-15): puts the finished file into a folder on the team shelf, so anyone in Admin can
 * find it again without asking around for a copy. A folder can be named here, on the spot.
 */
export function SavePdfDialog({
  open,
  onOpenChange,
  fileName,
  build,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fileName: string;
  build: () => Promise<Uint8Array>;
  onSaved: (folderId: string, folderName: string) => void;
}) {
  const loadShelf = useServerFn(listPdfShelf);
  const createFolder = useServerFn(createPdfFolder);
  const save = useServerFn(savePdfToShelf);
  const [folders, setFolders] = useState<PdfFolder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(fileName);
    setNewFolder("");
    setLoading(true);
    void loadShelf()
      .then((shelf) => {
        setFolders(shelf.folders);
        setFolderId((current) => current || shelf.folders[0]?.id || "");
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Couldn't load your folders."),
      )
      .finally(() => setLoading(false));
  }, [open, fileName, loadShelf]);

  async function submit() {
    setSaving(true);
    try {
      let target = folderId;
      let targetName = folders.find((f) => f.id === folderId)?.name ?? "";
      if (newFolder.trim()) {
        const created = await createFolder({ data: { name: newFolder.trim() } });
        target = created.id;
        targetName = created.name;
        setFolders((f) =>
          [...f, { ...created, count: 0 }].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setFolderId(created.id);
        setNewFolder("");
      }
      if (!target) throw new Error("Pick a folder, or name a new one.");
      const bytes = await build();
      if (bytes.length > PDF_SHELF_MAX_BYTES)
        throw new Error("This PDF is over 25 MB, too big to save here.");
      await save({
        data: { folderId: target, fileName: name.trim() || fileName, pdf: toBase64(bytes) },
      });
      toast.success(`Saved to ${targetName}.`);
      onSaved(target, targetName);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the PDF.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Save this PDF</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="shelf-name">File name</Label>
            <Input
              id="shelf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Folder</Label>
            <Select
              value={folderId}
              onValueChange={setFolderId}
              disabled={loading || !folders.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loading
                      ? "Loading folders…"
                      : folders.length
                        ? "Pick a folder"
                        : "No folders yet"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {folders.length
                ? "Everyone in Admin can open files in this folder."
                : "Name the first folder below — everyone in Admin can use it."}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="shelf-new-folder">Or a new folder</Label>
            <Input
              id="shelf-new-folder"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="e.g. Signed contracts"
              maxLength={60}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || loading || (!folderId && !newFolder.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Saved PDFs (founder, 2026-11-15): the team shelf under the tools. Folders keep signed packets, contracts and
 * paperwork apart; every staff member sees the same files and can add a folder for the next batch.
 */
export function PdfShelfPanel({
  refreshKey = 0,
  focusFolderId = null,
}: {
  refreshKey?: number;
  focusFolderId?: string | null;
}) {
  const loadShelf = useServerFn(listPdfShelf);
  const createFolder = useServerFn(createPdfFolder);
  const removeFile = useServerFn(deleteSavedPdf);
  const [shelf, setShelf] = useState<PdfShelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folder, setFolder] = useState("all");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");

  function load() {
    setLoading(true);
    void loadShelf()
      .then((next) => {
        setShelf(next);
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load Saved PDFs."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusFolderId) setFolder(focusFolderId);
  }, [focusFolderId, refreshKey]);

  async function addFolder() {
    setCreating(true);
    try {
      const created = await createFolder({ data: { name: folderName } });
      toast.success(`Folder “${created.name}” is ready.`);
      setNewFolderOpen(false);
      setFolderName("");
      setFolder(created.id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the folder.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string, name: string) {
    if (
      !(await confirmAction({
        title: "Remove this file?",
        text: `“${name}” will be deleted from Saved PDFs for everyone in Admin.`,
        action: "Remove",
      }))
    )
      return;
    setBusyId(id);
    try {
      await removeFile({ data: { id } });
      toast.success("File removed.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the file.");
    } finally {
      setBusyId("");
    }
  }

  const folders = shelf?.folders ?? [];
  const files = (shelf?.files ?? []).filter((f) => folder === "all" || f.folderId === folder);
  const total = shelf?.files.length ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Saved PDFs</h2>
          <p className="text-sm text-muted-foreground">
            Files the team saved from PDF Tools. Everyone in Admin can open them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="h-4 w-4" />
          New folder
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFolder("all")}
          className={`rounded-full border px-3 py-1 text-sm ${folder === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
        >
          All · {total}
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFolder(f.id)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${folder === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <Folder className="h-3.5 w-3.5" />
            {f.name} · {f.count}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {loading && !shelf ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading saved files…
        </p>
      ) : null}

      {!loading && !error && !files.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {folders.length
            ? "Nothing in this folder yet. Open a PDF above and choose Save."
            : "Nothing saved yet. Open a PDF above, then use Save to start the shelf."}
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-border">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-semibold">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.folder} · {fileSize(f.size)} · {when(f.savedAt)}
                {f.savedBy ? ` · ${f.savedBy}` : ""}
              </p>
            </div>
            {f.url ? (
              <Button asChild variant="outline" size="sm">
                <a href={f.url} download={f.name}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${f.name}`}
              disabled={busyId === f.id}
              onClick={() => remove(f.id, f.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="pdf-folder-name">Folder name</Label>
            <Input
              id="pdf-folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Signed contracts"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Everyone in Admin can save into it and read it.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={addFolder} disabled={creating || !folderName.trim()}>
              {creating ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
