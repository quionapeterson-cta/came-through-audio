import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileAudio, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyContributor, emptyMetadata, embedMetadata, metadataSchema, type Contributor, type Metadata } from "@/lib/metadata";

export function MetadataUploader() {
  const [metadata, setMetadata] = useState<Metadata>(emptyMetadata);
  const [audio, setAudio] = useState<File>();
  const [artwork, setArtwork] = useState<File>();
  const [cover, setCover] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string }>();
  const audioInput = useRef<HTMLInputElement>(null);
  const artInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!artwork) { setCover(""); return; }
    const url = URL.createObjectURL(artwork);
    setCover(url);
    return () => URL.revokeObjectURL(url);
  }, [artwork]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  function update<K extends keyof Metadata>(key: K, value: Metadata[K]) {
    setMetadata((current) => ({ ...current, [key]: value }));
    setResult(undefined);
    setError("");
  }
  function selectAudio(file?: File) {
    if (!file) return;
    setResult(undefined);
    if (!/\.mp3$/i.test(file.name)) { setError("Choose an MP3 audio file. WAV and FLAC embedding are not available yet."); return; }
    setAudio(file);
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(undefined);
    setError("");
    if (!audio) { setError("Choose an MP3 file first."); return; }
    const parsed = metadataSchema.safeParse(metadata);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your metadata."); return; }
    setBusy(true);
    try {
      const blob = await embedMetadata(await audio.arrayBuffer(), parsed.data, artwork ? await artwork.arrayBuffer() : undefined);
      setResult({ url: URL.createObjectURL(blob), name: `${parsed.data.title.replace(/[<>:"/\\|?*]/g, "_")}-tagged.mp3` });
    } catch {
      setError("This file could not be tagged. Check that it is a valid MP3 and the cover is a valid JPEG or PNG.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Embed Metadata</h1>
        <span className="text-sm text-muted-foreground">MP3 · ID3v2.3</span>
      </div>
      <form onSubmit={submit} className="space-y-8" aria-busy={busy}>
        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-[1fr_220px]">
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) selectAudio(event.dataTransfer.files[0]); }} className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary bg-accent/30 p-5 text-center">
            <FileAudio className="h-8 w-8 text-primary" />
            <div className="max-w-full break-all text-sm font-semibold">{audio ? audio.name : "Audio file"}</div>
            {audio && <span className="text-xs text-muted-foreground">{(audio.size / 1024 / 1024).toFixed(1)} MB</span>}
            <Button type="button" variant="outline" onClick={() => audioInput.current?.click()}><Upload />{audio ? "Replace MP3" : "Choose MP3"}</Button>
            <input ref={audioInput} type="file" accept=".mp3,audio/mpeg" aria-label="MP3 audio file" className="sr-only" onChange={(event) => { selectAudio(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-4">
            {cover ? <img src={cover} alt="Selected cover artwork" className="h-20 w-20 rounded object-cover" /> : <ImagePlus className="h-8 w-8 text-primary" />}
            <Button type="button" variant="ghost" onClick={() => artInput.current?.click()}>{artwork ? "Replace artwork" : "Add cover artwork"}</Button>
            {artwork && <Button type="button" size="icon" variant="ghost" aria-label="Remove cover artwork" onClick={() => { setArtwork(undefined); setResult(undefined); }}><Trash2 /></Button>}
            <input ref={artInput} type="file" accept="image/jpeg,image/png" aria-label="Cover artwork" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && !["image/jpeg", "image/png"].includes(file.type)) { setError("Choose JPEG or PNG artwork."); return; }
              setArtwork(file); setResult(undefined); setError(""); event.target.value = "";
            }} />
          </div>
        </fieldset>

        <fieldset disabled={busy} className="space-y-5 border-t border-border pt-6">
          <legend className="px-0 pr-3 text-lg font-semibold">Track details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Track title" id="title" value={metadata.title} required onChange={(value) => update("title", value)} />
            <Field label="Artist name" id="artist" value={metadata.artist} required onChange={(value) => update("artist", value)} />
            <Field label="Featured artists" id="featured" value={metadata.featured} placeholder="Names, separated by commas" onChange={(value) => update("featured", value)} />
            <Field label="Album / release title" id="album" value={metadata.album} onChange={(value) => update("album", value)} />
            <Field label="Release date" id="releaseDate" type="date" value={metadata.releaseDate} onChange={(value) => update("releaseDate", value)} />
          </div>
        </fieldset>

        <fieldset disabled={busy} className="space-y-5 border-t border-border pt-6">
          <legend className="pr-3 text-lg font-semibold">Identifiers</legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="ISRC" id="isrc" value={metadata.isrc} placeholder="USABC2600001" onChange={(value) => update("isrc", value)} />
            <Field label="UPC / EAN" id="upc" value={metadata.upc} placeholder="12 or 13 digits" onChange={(value) => update("upc", value)} />
            <Field label="ISWC" id="iswc" value={metadata.iswc} placeholder="T-123.456.789-0" onChange={(value) => update("iswc", value)} />
          </div>
        </fieldset>
        <Contributors title="Writers" group="writers" rows={metadata.writers} disabled={busy} onChange={(rows) => update("writers", rows)} />
        <Contributors title="Publishers" group="publishers" rows={metadata.publishers} disabled={busy} onChange={(rows) => update("publishers", rows)} />

        <div className="space-y-4 border-t border-border pt-6 pb-8">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {result && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /><span>Your tagged MP3 is ready.</span><Button asChild variant="outline"><a href={result.url} download={result.name}><Download />Download MP3</a></Button></div>}
          <Button type="submit" size="lg" disabled={busy}><FileAudio />{busy ? "Embedding…" : "Embed Metadata"}</Button>
          <p className="text-xs text-muted-foreground">Local download only · Not saved to your catalog or Supabase.</p>
        </div>
      </form>
    </section>
  );
}

function Field({ label, id, value, onChange, required, type = "text", placeholder }: { label: string; id: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}{required ? " *" : ""}</Label><Input id={id} value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Contributors({ title, group, rows, onChange, disabled }: { title: string; group: string; rows: Contributor[]; onChange: (rows: Contributor[]) => void; disabled: boolean }) {
  function change(index: number, key: keyof Contributor, value: string) { onChange(rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  return <fieldset disabled={disabled} className="space-y-5 border-t border-border pt-6">
    <legend className="pr-3 text-lg font-semibold">{title}</legend>
    {rows.map((row, index) => <div key={index} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_120px_36px]">
      <Field label="Name" id={`${group}-${index}-name`} value={row.name} onChange={(value) => change(index, "name", value)} />
      <Field label="PRO affiliation" id={`${group}-${index}-pro`} value={row.pro} onChange={(value) => change(index, "pro", value)} />
      <div className="space-y-2"><Label htmlFor={`${group}-${index}-share`}>Share (%)</Label><Input id={`${group}-${index}-share`} type="number" min="0" max="100" step="0.01" value={row.percentage} onChange={(event) => change(index, "percentage", event.target.value)} /></div>
      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${title.toLowerCase().slice(0, -1)} ${index + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 /></Button>
    </div>)}
    <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" onClick={() => onChange([...rows, emptyContributor()])}><Plus />Add {title.toLowerCase().slice(0, -1)}</Button><span className="text-sm text-muted-foreground">Total: {Number(rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0).toFixed(2))}%</span></div>
  </fieldset>;
}