import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Disc3, Lock, ShieldCheck, CheckCircle2, Download, FileAudio, ImagePlus, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PRE_DIST_NOTE, PRO_TIP } from "@/lib/copy";
import { readMetadata, CREDIT_ROLES, emptyContributor, emptyMetadata, embedMetadata, metadataSchema, GENRES, PROS, RELEASE_TYPES, type Contributor, type Metadata } from "@/lib/metadata";
import { deleteTrack, downloadCatalogFile, listTracks, safeName, saveTrack, uploadCatalogFile, type CatalogTrack } from "@/lib/catalog";
import { AGENCY_LABEL, downloadAgencyExport, type Agency } from "@/lib/agency-export";
import { downloadLyricsPdf } from "@/lib/lyrics-pdf";
import { loadProfile, pickProfile, saveProfile, withProfile } from "@/lib/artist-profile";

export function MetadataUploader({ stageName, userId, mode = "embed", onSubmitted, onSplitSheet, onProtect, canSplit }: { stageName?: string; userId?: string; mode?: "embed" | "catalog"; onSubmitted?: () => void; onSplitSheet?: (t: CatalogTrack) => void; onProtect?: (t: CatalogTrack) => void; canSplit?: boolean }) {
  const full = mode === "catalog";
  const [aiProtect, setAiProtect] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [metadata, setMetadata] = useState<Metadata>(emptyMetadata);
  const [audio, setAudio] = useState<File>();
  const [artwork, setArtwork] = useState<File>();
  const [cover, setCover] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string }>();
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [upsell, setUpsell] = useState<false | "split" | "export">(false);
  const [filter, setFilter] = useState<"All" | "Single" | "EP" | "Album">("All");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const runExport = (a: Agency, list: CatalogTrack[], name: string) => {
    if (!canSplit) { setUpsell("export"); return; }
    downloadAgencyExport(a, list, safeName(name)).catch(() => toast.error("Could not build the export."));
  };
  const exportMenu = (label: string, list: CatalogTrack[], name: string, size: "sm" | "default" = "sm") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="outline" size={size} onClick={(e) => e.stopPropagation()}>{!canSplit && <Lock />}{label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["mlc", "soundexchange", "pro"] as Agency[]).map((a) => <DropdownMenuItem key={a} onClick={() => runExport(a, list, name)}>{AGENCY_LABEL[a]}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const [useProfile, setUseProfile] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const p = loadProfile(userId);
    setUseProfile(!!p);
    if (p && !full) setMetadata((m) => (m.title || m.artist ? m : withProfile(p)));
  }, [userId, full]);
  function toggleProfile(on: boolean) {
    if (!userId) return;
    setUseProfile(on);
    if (on) {
      if (!metadata.artist.trim()) { toast.info("Fill in your artist name, label, genres, writers and publishers first — then check this box to save them."); setUseProfile(false); return; }
      saveProfile(userId, pickProfile(metadata));
      toast.success("Main artist details saved. They'll pre-fill every new embed — you can still change them anytime.");
    } else { saveProfile(userId, null); toast.success("Pre-fill turned off."); }
  }
  const artInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    if (!userId) return;
    listTracks().then(setTracks).catch((e) => toast.error(e.message ?? "Could not load your catalog."));
  }, [userId]);
  useEffect(() => { refresh(); }, [refresh]);

  async function save() {
    if (!userId) return;
    const parsed = metadataSchema.safeParse(metadata);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your metadata."); return; }
    setSaving(true);
    try {
      const data = { ...parsed.data, aiProtection: parsed.data.aiProtection || aiProtect };
      const id = await saveTrack(data, userId, editingId);
      // Always store the fully tagged master (never the raw upload) and artwork in the private vault.
      let master: Blob | undefined;
      if (result) master = await (await fetch(result.url)).blob();
      else if (audio) {
        try { master = await embedMetadata(await audio.arrayBuffer(), data, artwork ? await artwork.arrayBuffer() : undefined); }
        catch { master = audio; }
      }
      let filesChanged = false;
      try {
        if (master) { data.audioPath = await uploadCatalogFile(userId, id, "master", master, "mp3"); filesChanged = true; }
        if (artwork) { data.artPath = await uploadCatalogFile(userId, id, "artwork", artwork, artwork.type === "image/png" ? "png" : "jpg"); filesChanged = true; }
        if (filesChanged) await saveTrack(data, userId, id);
      } catch { toast.warning("Details saved, but your audio or artwork could not be stored. Try saving again."); }
      setMetadata(data);
      setEditingId(id);
      toast.success(editingId ? "Track updated in your catalog." : "Track submitted to your catalog.");
      refresh();
      if (!full) { setSubmitted(true); onSubmitted?.(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save track.");
    } finally { setSaving(false); }
  }
  function open(t: CatalogTrack) {
    setMetadata({ ...emptyMetadata(), ...t.metadata });
    setEditingId(t.id);
    setResult(undefined);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startNew() {
    setMetadata(withProfile(loadProfile(userId)));
    setEditingId(undefined);
    setAudio(undefined);
    setArtwork(undefined);
    setResult(undefined);
    setSubmitted(false);
    setAiProtect(false);
  }
  async function remove(id: string) {
    if (!confirm("Delete this track from your catalog?")) return;
    try {
      await deleteTrack(id);
      if (id === editingId) startNew();
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete track."); }
  }

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
    const probe = new Audio();
    const probeUrl = URL.createObjectURL(file);
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const sec = Math.round(probe.duration);
      if (Number.isFinite(sec) && sec > 0) setMetadata((m) => ({ ...m, duration: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` }));
      URL.revokeObjectURL(probeUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(probeUrl);
    probe.src = probeUrl;
    file.arrayBuffer().then((buf) => {
      const { picture, ...found } = readMetadata(buf);
      if (picture && !artwork) {
        const art = new File([picture], picture.type === "image/png" ? "cover.png" : "cover.jpg", { type: picture.type });
        setArtwork(art);
        makeThumb(art).then((t) => setMetadata((m) => ({ ...m, coverThumb: t }))).catch(() => {});
      }
      const filled = Object.fromEntries(Object.entries(found).filter(([, v]) => Array.isArray(v) ? v.some((x) => (typeof x === "string" ? x : x?.name)) : v !== "" && v != null));
      // Private PRO/IPI/splits never live in files — restore them from the saved profile for matching names.
      const profile = loadProfile(userId);
      for (const g of ["writers", "composers", "producers", "publishers"] as const) {
        const rows = filled[g] as Contributor[] | undefined;
        if (!rows) continue;
        filled[g] = rows.map((r) => {
          const saved = profile?.[g]?.find((s) => s.name.trim().toLowerCase() === r.name.trim().toLowerCase());
          return saved ? { ...r, pro: r.pro || saved.pro, ipi: r.ipi || saved.ipi, percentage: r.percentage || saved.percentage } : r;
        });
      }
      if (Object.keys(filled).length || picture) { setMetadata((m) => ({ ...m, ...filled })); toast.success("Existing metadata found and pre-filled. You can still edit every field."); }
    }).catch(() => {});
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
      const file = { url: URL.createObjectURL(blob), name: `${parsed.data.title.replace(/[<>:"/\\|?*]/g, "_")}-tagged.mp3` };
      const a = document.createElement("a");
      a.href = file.url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setResult(file);
    } catch {
      setError("This file could not be tagged. Check that it is a valid MP3 and the cover is a valid JPEG or PNG.");
    } finally { setBusy(false); }
  }

  const showForm = !full || !!editingId;
  return (
    <section className="mx-auto mt-8 max-w-5xl">
      {stageName && <h1 className="mb-8 text-center text-4xl font-extrabold tracking-tight md:text-5xl">{stageName}</h1>}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{full ? (editingId ? "Edit track" : "My Catalog") : "Embed Metadata"}</h1>
        <span className="text-sm text-muted-foreground">{full ? "Saved songs, identifiers and splits" : "MP3 · ID3v2.3"}</span>
      </div>
      {showForm && submitted && !full ? (
        <div className="rounded-xl border border-primary p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-lg font-semibold">Submitted to your catalog.</p>
          <Button className="mt-5" onClick={startNew}><Plus />Embed Another Song</Button>
        </div>
      ) : showForm && (
      <form onSubmit={submit} className="space-y-8" aria-busy={busy}>
        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-[1fr_220px]">
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) selectAudio(event.dataTransfer.files[0]); }} className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary bg-accent/30 p-5 text-center">
            <FileAudio className="h-8 w-8 text-primary" />
            <div className="max-w-full break-all text-sm font-semibold">{audio ? audio.name : full ? "Replace audio (optional)" : "Audio file"}</div>
            {audio && <span className="text-xs text-muted-foreground">{(audio.size / 1024 / 1024).toFixed(1)} MB</span>}
            <Button type="button" variant="outline" onClick={() => audioInput.current?.click()}><Upload />{audio ? "Replace MP3" : "Choose MP3"}</Button>
            <input ref={audioInput} type="file" accept=".mp3,audio/mpeg" aria-label="MP3 audio file" className="sr-only" onChange={(event) => { selectAudio(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-4">
            {cover ? <img src={cover} alt="Selected cover artwork" className="h-20 w-20 rounded object-cover" /> : <ImagePlus className="h-8 w-8 text-primary" />}
            <Button type="button" variant="ghost" onClick={() => artInput.current?.click()}>{artwork ? "Replace artwork" : "Add cover art"}</Button>
            <p className="text-center text-xs text-muted-foreground">3000x3000px recommended (streaming standard). JPEG or PNG; any standard album size works.</p>
            {artwork && <Button type="button" size="icon" variant="ghost" aria-label="Remove cover artwork" onClick={() => { setArtwork(undefined); setResult(undefined); }}><Trash2 /></Button>}
            <input ref={artInput} type="file" accept="image/jpeg,image/png" aria-label="Cover artwork" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && !["image/jpeg", "image/png"].includes(file.type)) { setError("Choose JPEG or PNG artwork."); return; }
              setArtwork(file); setResult(undefined); setError(""); event.target.value = "";
              if (file) makeThumb(file).then((t) => setMetadata((m) => ({ ...m, coverThumb: t }))).catch(() => {});
            }} />
          </div>
        </fieldset>

        <fieldset disabled={busy} className="space-y-5 border-t border-border pt-6">
          <legend className="px-0 pr-3 text-lg font-semibold">Track details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Track title" id="title" value={metadata.title} required onChange={(value) => update("title", value)} />
            <Field label="Track number" id="trackNumber" value={metadata.trackNumber} placeholder="1" onChange={(value) => update("trackNumber", value)} />
            <Field label="Track duration" id="duration" value={metadata.duration} placeholder="3:45" onChange={(value) => update("duration", value)} />
            <div className="space-y-2">
              <Label>Explicit content</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Explicit content">
                {[true, false].map((v) => (
                  <Button key={String(v)} type="button" role="radio" aria-checked={metadata.explicit === v} variant={metadata.explicit === v ? "default" : "outline"} onClick={() => update("explicit", v)}>{v ? "Yes" : "No"}</Button>
                ))}
              </div>
            </div>
            <SelectField label="Primary genre" id="primaryGenre" value={metadata.primaryGenre} options={GENRES} onChange={(value) => update("primaryGenre", value)} />
            <SelectField label="Secondary genre" id="secondaryGenre" value={metadata.secondaryGenre} options={GENRES} onChange={(value) => update("secondaryGenre", value)} />
            <Field label="Artist name" id="artist" value={metadata.artist} required onChange={(value) => update("artist", value)} />
            <div className="space-y-2">
              {metadata.featured.map((name, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1"><Field label={index === 0 ? "Featured artist" : `Featured artist ${index + 1}`} id={`featured-${index}`} value={name} onChange={(value) => update("featured", metadata.featured.map((n, i) => i === index ? value : n))} /></div>
                  {index === metadata.featured.length - 1
                    ? <Button type="button" size="icon" variant="outline" aria-label="Add featured artist" onClick={() => update("featured", [...metadata.featured, ""])}><Plus /></Button>
                    : <Button type="button" size="icon" variant="ghost" aria-label={`Remove featured artist ${index + 1}`} onClick={() => update("featured", metadata.featured.filter((_, i) => i !== index))}><Trash2 /></Button>}
                </div>
              ))}
            </div>
            <SelectField label="Release type" id="releaseType" value={metadata.releaseType} options={RELEASE_TYPES} onChange={(value) => update("releaseType", value)} />
            {full && <>
              <Field label="Album / release title" id="album" value={metadata.album} onChange={(value) => update("album", value)} />
              <Field label="Release date" id="releaseDate" type="date" value={metadata.releaseDate} onChange={(value) => update("releaseDate", value)} />
              <Field label="Record label" id="label" value={metadata.label} onChange={(value) => update("label", value)} />
            </>}
          </div>
        </fieldset>

        <Contributors title="Writers" singular="writer" group="writers" rows={metadata.writers} disabled={busy} onChange={(rows) => update("writers", rows)} tip={full ? "Writers own the lyrics/melody copyright. Splits across all writers must total 100% and each writer should list their PRO and IPI." : undefined} simple={!full} />
        <Contributors title="Composers" singular="composer" group="composers" rows={metadata.composers} disabled={busy} onChange={(rows) => update("composers", rows)} tip={full ? "Composers write the music. They share the writer's (composition) side of royalties, collected by PROs like BMI or ASCAP." : undefined} simple={!full} />
        <Contributors title="Producers" singular="producer" group="producers" rows={metadata.producers ?? [emptyContributor()]} disabled={busy} onChange={(rows) => update("producers", rows)} simple={!full} />
        <fieldset disabled={busy} className="space-y-5 border-t border-border pt-6">
          <legend className="pr-3 text-lg font-semibold">Identifiers</legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="ISRC" id="isrc" value={metadata.isrc} placeholder="USABC2600001" onChange={(value) => update("isrc", value)} />
            <Field label="UPC / EAN" id="upc" value={metadata.upc} placeholder="12 or 13 digits" onChange={(value) => update("upc", value)} />
            <Field label="ISWC (optional)" id="iswc" value={metadata.iswc} placeholder="T-123.456.789-0" onChange={(value) => update("iswc", value)} />
          </div>
          <HoverCard openDelay={100}>
            <HoverCardTrigger asChild>
              <button type="button" className="inline-flex items-center rounded-full border border-primary px-3 py-1 text-sm font-semibold text-primary">💡 Pre-Distribution Note</button>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-96 space-y-3 text-sm">
              <p>{PRE_DIST_NOTE}</p>
              <p><span className="font-semibold">⭐ Pro Tip: </span>{PRO_TIP}</p>
            </HoverCardContent>
          </HoverCard>
        </fieldset>
        <fieldset disabled={busy} className="space-y-3 border-t border-border pt-6">
          <legend className="pr-3 text-lg font-semibold">Lyrics</legend>
          <textarea aria-label="Lyrics" rows={6} value={metadata.lyrics} onChange={(e) => update("lyrics", e.target.value)} placeholder="Paste your lyrics" className="w-full rounded-md border border-input bg-background p-3 text-sm" />
        </fieldset>
        {full && <fieldset disabled={busy} className="space-y-3 border-t border-border pt-6">
          <legend className="pr-3 text-lg font-semibold">Add Credits</legend>
          {metadata.credits.map((c, i) => <div key={i} className="grid items-end gap-3 sm:grid-cols-[220px_1fr_36px]">
            <SelectField label="Role" id={`credit-${i}-role`} value={c.role} options={CREDIT_ROLES} onChange={(v) => update("credits", metadata.credits.map((x, j) => j === i ? { ...x, role: v } : x))} />
            <Field label="Name" id={`credit-${i}-name`} value={c.name} onChange={(v) => update("credits", metadata.credits.map((x, j) => j === i ? { ...x, name: v } : x))} />
            <Button type="button" size="icon" variant="ghost" aria-label={`Remove credit ${i + 1}`} onClick={() => update("credits", metadata.credits.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>)}
          <Button type="button" variant="outline" onClick={() => update("credits", [...metadata.credits, { role: CREDIT_ROLES[0], name: "" }])}><Plus />Add credit</Button>
        </fieldset>}
        {full && <Contributors title="Publishers" singular="publisher" group="publishers" rows={metadata.publishers} disabled={busy} publisher onChange={(rows) => update("publishers", rows)} tip="Publishers administer the composition and collect the publisher share (usually 50%). Self-published writers can list their own publishing entity." />}

        <div className="space-y-4 border-t border-border pt-6 pb-8">
          {userId && !full && (
            <label className="flex items-start gap-3 rounded-xl border border-primary bg-accent/30 p-4 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={useProfile} onChange={(e) => toggleProfile(e.target.checked)} />
              <span><span className="font-semibold">Want to make embedding easier?</span> Pre-fill your main artist details on every embed — check here. We'll save your artist name, label, genres, writers, composers, producers and publishers from this form. You can still change any field for a one-off song.</span>
            </label>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {result && (
            <div role="status" className="space-y-3 rounded-xl border border-primary p-5">
              <p className="flex items-center gap-2 text-lg font-bold">Audio Tagged Successfully! <span className="cta-icon cta-party cta-bedazzled-unlock" aria-hidden /></p>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={aiProtect} onChange={(e) => setAiProtect(e.target.checked)} />
                <span><span className="font-semibold">Add AI Protection Certificate (+$2.99)</span> — With generative AI cloning and scraping artist catalogs at an alarming rate, secure your time-stamped proof of human origin right now to protect your music from false plagiarism claims and automated platform takedowns before downloading.</span>
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={busy}><FileAudio />{busy ? "Embedding…" : "Embed & Download"}</Button>
            {userId && <Button type="button" size="lg" variant="outline" disabled={saving} onClick={save}><Save />{saving ? "Saving…" : editingId ? "Update in catalog" : "Submit to catalog"}</Button>}
            {full && editingId && <Button type="button" size="lg" variant="ghost" onClick={startNew}>Close</Button>}
          </div>
        </div>
      </form>
      )}

      {userId && full && (() => { const newest = [...tracks].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]; return (
        <div className="mt-4 border-t border-border pt-6 pb-12">
          <h2 className="mb-4 text-xl font-bold">Your songs</h2>
          {tracks.length === 0 ? <p className="text-sm text-muted-foreground">No songs yet. Embed a track in the Embed Metadata tab and submit it to your catalog.</p> : (
            <>
            <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter by release type">
              {(["Album", "EP", "Single", "All"] as const).map((f) => {
                const n = f === "All" ? tracks.length : tracks.filter((t) => releaseGroup(t) === f).length;
                return <Button key={f} type="button" role="tab" aria-selected={filter === f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "All" ? "All" : `${f}s`}<span className="ml-1 opacity-70">{n}</span></Button>;
              })}
            </div>
            {(["Album", "EP", "Single"] as const).filter((g) => filter === "All" || filter === g).map((g) => {
              const items = tracks.filter((t) => releaseGroup(t) === g);
              if (!items.length) return null;
              const row = (t: CatalogTrack) => (
                <li key={t.id} className={`group rounded-xl border p-3 transition hover:border-primary hover:shadow-md ${t.id === editingId || picked.has(t.id) ? "border-primary bg-accent/30" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-4">
                  <input type="checkbox" aria-label={`Select ${t.title} for bulk export`} checked={picked.has(t.id)} onChange={() => togglePick(t.id)} className="h-4 w-4 accent-primary" />
                  {g !== "Single" && <span className="w-6 text-center text-sm font-bold text-primary">{t.metadata.trackNumber || "–"}</span>}
                  {t.metadata.coverThumb
                    ? <img src={t.metadata.coverThumb} alt={`${t.title} artwork`} className="h-16 w-16 shrink-0 rounded-lg object-cover shadow" />
                    : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow"><Disc3 className="h-8 w-8 transition group-hover:rotate-180" /></div>}
                  <div className="min-w-[10rem] flex-1">
                    <div className="truncate text-lg font-bold">{t.title}</div>
                    <div className="truncate text-sm text-muted-foreground">{t.artist}{t.metadata.album ? ` · ${t.metadata.album}` : ""}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => open(t)}><Pencil />Edit</Button>
                    {(t.metadata.audioPath || t.metadata.artPath || t.metadata.lyrics) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm"><Download />Downloads</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {t.metadata.audioPath && <DropdownMenuItem onClick={() => downloadCatalogFile(t.metadata.audioPath, `${safeName(t.title)} - Came Through Audio.mp3`).catch(() => toast.error("Could not download the song."))}>Master MP3</DropdownMenuItem>}
                          {t.metadata.artPath && <DropdownMenuItem onClick={() => downloadCatalogFile(t.metadata.artPath, `${safeName(t.title)}-artwork.${t.metadata.artPath.split(".").pop()}`).catch(() => toast.error("Could not download the artwork."))}>Artwork</DropdownMenuItem>}
                          {t.metadata.lyrics && <DropdownMenuItem onClick={() => void downloadLyricsPdf(t)}>Lyrics PDF</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {exportMenu("Agency Export", [t], t.title)}
                    {onProtect && <Button type="button" variant={t.metadata.aiProtection ? "default" : "outline"} size="sm" onClick={() => onProtect(t)}><ShieldCheck />{t.metadata.aiProtection ? "Add AI Protection Proof" : "Protect Track"}</Button>}
                    <Button type="button" size="sm" onClick={() => { if (!canSplit) { setUpsell("split"); return; } onSplitSheet?.(t); }}>{!canSplit && <Lock />}Generate Split Sheet</Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${t.title}`} onClick={() => remove(t.id)}><Trash2 /></Button>
                  </div>
                  </div>
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {regBadges(t).map((b) => <span key={b} className="rounded-full border border-primary px-2 py-0.5 text-primary">{b}</span>)}
                    </div>
                    {creditGroups(t).length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {creditGroups(t).map((cg) => <div key={cg.label} className="min-w-0">
                        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">{cg.label}</div>
                        <ul className="space-y-1 text-sm">{cg.rows.map((c, i) => <li key={i} className="min-w-0">
                          <span className="font-semibold">{c.name}</span>
                          {(c.percentage || c.pro || c.ipi) && <span className="block text-xs text-muted-foreground">{[c.percentage && `${c.percentage}%`, c.pro, c.ipi && `IPI ${c.ipi}`].filter(Boolean).join(" · ")}</span>}
                        </li>)}</ul>
                      </div>)}
                    </div>}
                  </div>
                </li>
              );
              return <div key={g} className="mb-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{g}s</h3>
                {g === "Single"
                  ? <details open={newest ? releaseGroup(newest) === "Single" : false} className="rounded-2xl border border-border p-4 open:border-primary">
                      <summary className="flex cursor-pointer list-none items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Disc3 className="h-7 w-7" /></div>
                        <div className="min-w-0 flex-1"><div className="truncate text-xl font-bold">All Singles</div><div className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "single" : "singles"} · A–Z</div></div>
                      </summary>
                      <ul className="mt-4 grid gap-3">{[...items].sort((a, b) => a.title.localeCompare(b.title)).map(row)}</ul>
                    </details>
                  : <div className="grid gap-4">{groupProjects(items).map((p) => (
                    <details key={p.key} open={!!newest && p.tracks.some((x) => x.id === newest.id)} className="rounded-2xl border border-border p-4 open:border-primary">
                      <summary className="flex cursor-pointer list-none items-center gap-4">
                        {p.cover ? <img src={p.cover} alt={`${p.title} artwork`} className="h-14 w-14 rounded-lg object-cover shadow" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Disc3 className="h-7 w-7" /></div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xl font-bold">{p.title}</div>
                          <div className="text-sm text-muted-foreground">{p.artist} · {p.tracks.length} {p.tracks.length === 1 ? "track" : "tracks"}</div>
                        </div>
                        {exportMenu("Export Release", p.tracks, p.title)}
                      </summary>
                      <ul className="mt-4 grid gap-3">{p.tracks.map(row)}</ul>
                    </details>
                  ))}</div>}
              </div>;
            })}
            {picked.size > 0 && (() => { const sel = tracks.filter((t) => picked.has(t.id)); return sel.length > 0 && (
              <div role="region" aria-label="Selected tracks" className="sticky bottom-4 z-20 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary bg-card p-3 shadow-lg">
                <span className="font-semibold">{sel.length} {sel.length === 1 ? "track" : "tracks"} selected</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
                  {exportMenu("Export Selected", sel, `${sel.length} Tracks`)}
                </div>
              </div>
            ); })()}
            </>
          )}
        </div>
      ); })()}
      <Dialog open={!!upsell} onOpenChange={(o) => !o && setUpsell(false)}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-bold"><Lock className="h-5 w-5 text-primary" />{upsell === "export" ? "1-Click Official Agency Exports are locked" : "Split Sheets are locked"}</DialogTitle></DialogHeader>
          <p className="text-base font-medium">{upsell === "export" ? "Upgrade to Catalog & Collaborate to export official The MLC and SoundExchange Direct bulk spreadsheets, plus BMI and ASCAP registration cheat sheets." : "Upgrade and Get Unlimited Split Sheets and E-Signatures."}</p>
          <Button onClick={() => setUpsell(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({ label, id, value, onChange, required, type = "text", placeholder }: { label: string; id: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}{required ? " *" : ""}</Label><Input id={id} value={value} type={type} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectField({ label, id, value, options, onChange }: { label: string; id: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <option value="">Select…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select></div>;
}

function Contributors({ title, singular, group, rows, onChange, disabled, publisher, tip, simple }: { title: string; singular: string; group: string; rows: Contributor[]; onChange: (rows: Contributor[]) => void; disabled: boolean; publisher?: boolean; tip?: string | undefined; simple?: boolean }) {
  function change(index: number, key: keyof Contributor, value: string) { onChange(rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  return <fieldset disabled={disabled} className="space-y-5 border-t border-border pt-6">
    <legend className="pr-3 text-lg font-semibold">{title}{tip && <span title={tip} tabIndex={0} aria-label={tip} className="ml-2 inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-primary text-xs text-primary">i</span>}</legend>
    {tip && <p className="text-sm text-muted-foreground">{tip}</p>}
    {simple ? rows.map((row, index) => <div key={index} className="flex items-end gap-2"><div className="flex-1"><Field label={`${title.slice(0, -1)} name`} id={`${group}-${index}-name`} value={row.name} onChange={(value) => change(index, "name", value)} /></div><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${singular} ${index + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 /></Button></div>) : rows.map((row, index) => <div key={index} className={`grid items-end gap-4 ${publisher ? "sm:grid-cols-[1fr_160px_160px_36px]" : "sm:grid-cols-[1fr_110px_150px_150px_36px]"}`}>
      <Field label={publisher ? "Publisher name" : "Legal name"} id={`${group}-${index}-name`} value={row.name} onChange={(value) => change(index, "name", value)} />
      {!publisher && <div className="space-y-2"><Label htmlFor={`${group}-${index}-share`}>Split (%)</Label><Input id={`${group}-${index}-share`} type="number" min="0" max="100" step="0.01" value={row.percentage} onChange={(event) => change(index, "percentage", event.target.value)} /></div>}
      <Field label={publisher ? "Publisher IPI" : "IPI name number"} id={`${group}-${index}-ipi`} value={row.ipi} placeholder="9–11 digits" onChange={(value) => change(index, "ipi", value)} />
      <SelectField label="PRO affiliation" id={`${group}-${index}-pro`} value={row.pro} options={PROS} onChange={(value) => change(index, "pro", value)} />
      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${singular} ${index + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 /></Button>
    </div>)}
    <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" onClick={() => onChange([...rows, emptyContributor()])}><Plus />Add {singular}</Button>{!publisher && !simple && <span className="text-sm text-muted-foreground">Total: {Number(rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0).toFixed(2))}%</span>}</div>
  </fieldset>;
}
function groupProjects(items: CatalogTrack[]) {
  const map = new Map<string, CatalogTrack[]>();
  for (const t of items) {
    const key = (t.metadata.album || "Untitled").trim().toLowerCase().replace(/\s+/g, " ");
    map.set(key, [...(map.get(key) ?? []), t]);
  }
  return [...map.entries()].map(([key, list]) => {
    const tracks = [...list].sort((a, b) => (Number(a.metadata.trackNumber) || 999) - (Number(b.metadata.trackNumber) || 999) || a.title.localeCompare(b.title));
    return { key, tracks, title: list[0]!.metadata.album?.trim() || "Untitled", artist: list[0]!.artist, cover: tracks.find((t) => t.metadata.coverThumb)?.metadata.coverThumb };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

function regBadges(t: CatalogTrack): string[] {
  const m = t.metadata;
  return [m.releaseType || "Single", m.primaryGenre, m.duration, m.releaseDate && `Released ${m.releaseDate}`, m.label && `Label ${m.label}`,
    m.isrc && `ISRC ${m.isrc}`, m.upc && `UPC ${m.upc}`, m.iswc && `ISWC ${m.iswc}`].filter((b): b is string => !!b);
}

function creditGroups(t: CatalogTrack) {
  const m = t.metadata;
  return ([["Writers", m.writers], ["Composers", m.composers], ["Publishers", m.publishers], ["Producers", m.producers]] as const)
    .map(([label, rows]) => ({ label, rows: (rows ?? []).filter((c) => c.name.trim()) }))
    .filter((g) => g.rows.length > 0);
}

function releaseGroup(t: CatalogTrack): "Single" | "EP" | "Album" {
  const r = t.metadata.releaseType;
  return r === "EP" ? "EP" : r === "Album" || r === "Compilation" ? "Album" : "Single";
}

async function makeThumb(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  c.getContext("2d")?.drawImage(img, 0, 0, 160, 160);
  return c.toDataURL("image/jpeg", 0.8);
}
