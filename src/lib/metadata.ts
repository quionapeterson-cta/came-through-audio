import { z } from "zod";
import { ID3Writer } from "browser-id3-writer";

/** Every performing rights organization offered in PRO dropdowns, worldwide. "Other" lets users type a society not listed. */
export const PROS = [
  "ASCAP", "BMI", "SESAC", "GMR", "SOCAN", "PRS for Music", "APRA AMCOS", "SACEM", "GEMA", "SIAE", "SGAE", "BUMA/STEMRA",
  "SABAM", "STIM", "TONO", "KODA", "TEOSTO", "IMRO", "JASRAC", "KOMCA", "SAMRO", "ECAD", "SADAIC", "SAYCE", "SACM", "IPRS", "COSON", "MCSK", "Other", "None",
] as const;
export const RELEASE_TYPES = ["Single", "EP", "Album", "Compilation"] as const;
export const GENRES = ["Hip-Hop/Rap", "Spiritual Hip-Hop", "R&B/Soul", "Pop", "Rock", "Gospel", "Jazz", "Blues", "Country", "Electronic", "Reggae", "Latin", "Afrobeats", "Classical", "Soundtrack", "Alternative", "Other"] as const;

/** "Writer" is the umbrella title; each writer row picks one of these PRO roles. */
export const PRODUCTION_TYPES = ["Film", "TV", "Stage show", "Ad"] as const;
/** SoundExchange's two claim bases, worded as its ingest form expects. */
export const MASTER_BASES = ["Copyright Owner", "Collections Designee"] as const;
export const WRITER_ROLES = ["Author", "Composer", "Author/Composer"] as const;
export type WriterRole = (typeof WRITER_ROLES)[number];
/** MLC writer role codes: A = Author, C = Composer, CA = Composer/Author. */
export const MLC_ROLE: Record<WriterRole, string> = { Author: "A", Composer: "C", "Author/Composer": "CA" };
export const writerRole = (r?: string): WriterRole => (WRITER_ROLES as readonly string[]).includes(r ?? "") ? (r as WriterRole) : "Author/Composer";

export const contributorSchema = z.object({
  /** Producer/publisher name. Writers use legalName; their `name` only holds entries saved before that (see withLegalName). */
  name: z.string().trim(),
  legalName: z.string().trim().optional(),
  pro: z.string().trim(),
  ipi: z.string().trim().default("").refine((value) => !value || /^\d{9,11}$/.test(value), "IPI numbers are 9–11 digits."),
  percentage: z.string().trim().default("").refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100), "Enter a percentage between 0 and 100."),
  role: z.string().optional(),
  /** Publishers only: the HFA account number (P#), which is also the publisher number on The MLC's bulk upload. Catalog-only, never embedded. */
  hfa: z.string().trim().optional(),
  /**
   * Writers only: who collects this writer's publisher share on this song (founder, 2026-10-25). "publisher": a
   * publisher listed below; "self": self-published; "bmi": BMI pays it (BMI writers only); "none": this writer gets no
   * publishing on this song. Blank: not answered (the song's Self-published / BMI answers apply). Catalog-only, never embedded.
   */
  publishing: z.enum(["", "publisher", "self", "bmi", "none"]).optional(),
  /** Writers who are Self-published or paid by BMI: their part of the publisher half, in % (blank = their writer split). */
  pubShare: z.string().trim().default("").refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100), "Enter a percentage between 0 and 100.").optional(),
});

export const metadataSchema = z.object({
  title: z.string().trim().min(1, "Track title is required."),
  trackNumber: z.string().trim().default("").refine((v) => !v || /^\d{1,3}$/.test(v), "Track number must be a whole number."),
  /** Total tracks on the release: track 1 of 12 is trackNumber "1", trackTotal "12" (ID3 TRCK "1/12"). */
  trackTotal: z.string().trim().default("").refine((v) => !v || /^\d{1,3}$/.test(v), "Total tracks must be a whole number."),
  artist: z.string().trim().min(1, "Artist name is required."),
  featured: z.array(z.string().trim()).default([]),
  album: z.string().trim(),
  // Saved as mm:ss with two-digit minutes ("3:45" becomes "03:45"), as agency forms ask.
  duration: z.string().trim().default("").refine((v) => !v || /^\d{1,3}:[0-5]\d$/.test(v), "Enter duration as mm:ss.").transform((v) => (/^\d:[0-5]\d$/.test(v) ? `0${v}` : v)),
  releaseType: z.string().default(""),
  releaseDate: z.string(),
  /** "This song isn't released yet" (pre-distribution, 2026-10-25): for songs with no release date picked. */
  unreleased: z.boolean().default(false),
  label: z.string().trim().default(""),
  /** Optional contact email from Embed Defaults (founder, 2026-10-25), so whoever finds the file can reach the artist. Blank = not embedded. */
  contactEmail: z.string().trim().default("").refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address."),
  copyright: z.string().trim().default(""),
  phonographic: z.string().trim().default(""),
  language: z.string().trim().default(""),
  isrc: z.string().trim().refine((value) => !value || /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(value.replace(/-/g, "")), "Enter a valid 12-character ISRC."),
  upc: z.string().trim().refine((value) => !value || /^\d{12,13}$/.test(value), "Enter a 12- or 13-digit UPC/EAN."),
  iswc: z.string().trim().refine((value) => !value || /^T\d{10}$/i.test(value.replace(/[.\s-]/g, "")), "Enter a valid ISWC (T followed by 10 digits)."),
  explicit: z.boolean().default(false),
  /** Instrumental songs need no author to be registration-ready. */
  instrumental: z.boolean().default(false),
  primaryGenre: z.string().default(""),
  secondaryGenre: z.string().default(""),
  writers: z.array(contributorSchema),
  composers: z.array(contributorSchema).default([]),
  producers: z.array(contributorSchema).default([]),
  publishers: z.array(contributorSchema),
  lyrics: z.string().default(""),
  coverThumb: z.string().default(""),
  audioPath: z.string().default(""),
  artPath: z.string().default(""),
  aiProtection: z.boolean().default(false),
  /** Credits and performers. `instrument` matters for performers (session players, backup vocalists): it's what neighbouring-rights societies pay on. */
  credits: z.array(z.object({ role: z.string(), name: z.string().trim(), instrument: z.string().trim().default("") })).default([]),
  /** Where and when the recording was made, for neighbouring rights (international airplay). Kept in the catalog, never embedded. */
  recordedIn: z.string().trim().default(""),
  recordedYear: z.string().trim().default("").refine((v) => !v || /^\d{4}$/.test(v), "Enter a 4-digit year."),
  /** Registration details (PRO, MLC, SoundExchange forms). Kept in the catalog, never embedded. */
  alternateTitles: z.array(z.string().trim()).default([""]),
  selfPublished: z.boolean().default(false),
  /** "I'm a BMI writer with no publishing company": BMI pays its writers the publisher share too, so the song needs no
   *  publisher (founder, 2026-10-25). Only counts when every writer is with BMI. Catalog only, never embedded. */
  bmiWriterPublishing: z.boolean().default(false),
  /** "" = not answered yet. Samples or songs this one is based on (public-domain sources included). */
  samples: z.enum(["", "No", "Yes"]).default(""),
  sampleTitle: z.string().trim().default(""),
  sampleWriters: z.string().trim().default(""),
  sampleSource: z.string().trim().default(""),
  writtenFor: z.enum(["", "No", ...PRODUCTION_TYPES]).default(""),
  productionTitle: z.string().trim().default(""),
  /** Master ownership for SoundExchange. Blank start/end mean from release, forever. */
  masterShare: z.string().trim().default("100").refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 100), "Enter a master share between 0.01 and 100."),
  masterBasis: z.enum(MASTER_BASES).default("Copyright Owner"),
  rightsStart: z.string().default(""),
  rightsEnd: z.string().default(""),
}).superRefine((data, ctx) => {
  for (const group of ["writers", "composers", "publishers"] as const) {
    data[group].forEach((row, index) => {
      if ((row.pro || row.percentage || row.ipi) && !creditName(row)) ctx.addIssue({ code: "custom", path: [group, index, "name"], message: "Enter a name for this contributor." });
    });
    const total = data[group].reduce((sum, row) => sum + Number(row.percentage || 0), 0);
    if (total > 100) ctx.addIssue({ code: "custom", path: [group], message: "Total percentages cannot exceed 100%." });
  }
});

export type Metadata = z.infer<typeof metadataSchema>;
export type Contributor = z.infer<typeof contributorSchema>;
/** HFA P#s are 6 letters or numbers (P12345). Anything else gets a gentle warning, never a block. */
export const hfaLooksOff = (v: string | undefined) => !!v?.trim() && !/^[A-Z0-9]{6}$/i.test(v.trim());
export const emptyContributor = (): Contributor => ({ name: "", pro: "", ipi: "", percentage: "" });
export const emptyMetadata = (): Metadata => ({
  title: "", trackNumber: "", trackTotal: "", artist: "", featured: [""], album: "", duration: "", releaseType: "", releaseDate: "", unreleased: false, label: "", contactEmail: "", copyright: "", phonographic: "", language: "",
  isrc: "", upc: "", iswc: "", explicit: false, instrumental: false, primaryGenre: "", secondaryGenre: "",
  writers: [emptyContributor()], composers: [emptyContributor()], producers: [emptyContributor()], publishers: [emptyContributor()],
  lyrics: "", coverThumb: "", audioPath: "", artPath: "", aiProtection: false, credits: [], recordedIn: "", recordedYear: "",
  alternateTitles: [""], selfPublished: false, bmiWriterPublishing: false, samples: "", sampleTitle: "", sampleWriters: "", sampleSource: "", writtenFor: "", productionTitle: "",
  masterShare: "100", masterBasis: "Copyright Owner", rightsStart: "", rightsEnd: "",
});

/** The name shown for a contributor: a writer's legal name, otherwise the plain name (producers, publishers, older entries). */
/** Seconds as mm:ss with two-digit minutes ("03:45"), the way agency registration forms ask for it (founder, 2026-10-27). */
export const formatDuration = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** A percentage box that can't go above 100 (founder, 2026-10-27: the master share went past it). Keeps digits and one dot. */
export const percentInput = (v: string) => {
  const clean = v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 6);
  return Number(clean) > 100 ? "100" : clean;
};

export const creditName = (r: Contributor) => r.legalName?.trim() || r.name.trim();

/** Writers keep one name, the legal name. A blank legal name is filled from an older saved name; `name` itself is kept, never deleted. */
export const withLegalName = (rows: Contributor[]): Contributor[] => rows.map((r) => (!r.legalName?.trim() && r.name.trim() ? { ...r, legalName: r.name.trim() } : r));

/** "1/12" (ID3 TRCK) → track 1 of 12. Plain numbers have no total. */
export function splitTrack(v: string): { trackNumber: string; trackTotal: string } {
  const [n = "", t = ""] = v.split("/").map((x) => x.trim());
  return { trackNumber: n, trackTotal: t };
}

export const CREDIT_ROLES = ["Session musician", "Backup vocalist", "Arranger", "Mixing engineer", "Recording engineer", "Mastering engineer"] as const;
/** Credit roles that perform on the recording, so neighbouring-rights societies pay them. Engineers are credited, not paid. */
export const PERFORMER_ROLES: readonly string[] = ["Session musician", "Backup vocalist"];
export const isPerformer = (role: string) => PERFORMER_ROLES.includes(role);

/** Everyone who performs on the recording: the main and featured artists (featured), then credited session players (non-featured). */
export function performers(m: Pick<Metadata, "artist" | "featured" | "credits">) {
  return [
    ...[m.artist, ...m.featured].map((n) => n.trim()).filter(Boolean).map((name) => ({ name, featured: true, role: "Featured artist", instrument: "" })),
    ...m.credits.filter((c) => c.name.trim() && isPerformer(c.role)).map((c) => ({ name: c.name.trim(), featured: false, role: c.role, instrument: c.instrument ?? "" })),
  ];
}

/** True for a RIFF/WAVE file (the "RIFF....WAVE" header). */
export function isWav(buf: ArrayBuffer) {
  const b = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
  return b.length === 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WAVE";
}

/** File extension for a master: "wav" for WAV, otherwise "mp3". */
export const audioExt = (buf: ArrayBuffer) => (isWav(buf) ? "wav" : "mp3");

type Chunk = { id: string; start: number; size: number };

/** Top-level chunks of a WAV file (start = first byte of the chunk's data). */
function wavChunks(b: Uint8Array): Chunk[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Chunk[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const id = String.fromCharCode(...b.subarray(i, i + 4));
    const size = view.getUint32(i + 4, true);
    out.push({ id, start: i + 8, size: Math.min(size, b.length - i - 8) });
    i += 8 + size + (size % 2);
  }
  return out;
}

const ascii = (s: string) => new TextEncoder().encode(s);
function chunk(id: string, data: Uint8Array) {
  const out = new Uint8Array(8 + data.length + (data.length % 2));
  out.set(ascii(id), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

/**
 * WAV masters: the same ID3 tag as an MP3 goes in an "id3 " chunk (read by most music apps and taggers), plus a
 * RIFF INFO list with the basics for players that only read that. Earlier tags are replaced; audio stays untouched.
 */
function wavWithTags(audio: ArrayBuffer, id3: ArrayBuffer, data: Metadata): Blob {
  const b = new Uint8Array(audio);
  const keep = wavChunks(b).filter((c) => {
    if (c.id === "id3 " || c.id === "ID3 ") return false;
    // Only our INFO list is replaced; other LIST chunks (e.g. adtl cue labels) stay.
    return !(c.id === "LIST" && String.fromCharCode(...b.subarray(c.start, c.start + 4)) === "INFO");
  });
  const info: [string, string][] = [["INAM", data.title], ["IART", [data.artist, ...data.featured.filter(Boolean)].join(", ")], ["IPRD", data.album],
    ["ICRD", data.releaseDate], ["IGNR", [data.primaryGenre, data.secondaryGenre].filter(Boolean).join("; ")], ["ICOP", data.copyright],
    ["ITRK", data.trackNumber]];
  const infoBody = info.filter(([, v]) => v?.trim()).map(([id, v]) => chunk(id, ascii(`${v.trim()}\0`)));
  const list = infoBody.length ? chunk("LIST", new Uint8Array([...ascii("INFO"), ...infoBody.flatMap((c) => [...c])])) : new Uint8Array();
  const parts: Uint8Array[] = keep.map((c) => {
    const raw = b.subarray(c.start - 8, c.start + c.size + (c.size % 2));
    // A last chunk missing its pad byte gets one, so the file stays valid with chunks after it.
    return raw.length % 2 ? new Uint8Array([...raw, 0]) : raw;
  });
  parts.push(list, chunk("id3 ", new Uint8Array(id3)));
  const out = new Uint8Array(12 + parts.reduce((n, p) => n + p.length, 0));
  out.set(ascii("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  out.set(ascii("WAVE"), 8);
  let at = 12;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return new Blob([out.buffer], { type: "audio/wav" });
}

/** The ID3 tag inside a WAV's "id3 " chunk, so readMetadata can pre-fill from a tagged WAV. */
function wavId3(buf: ArrayBuffer): ArrayBuffer | null {
  const b = new Uint8Array(buf);
  const c = wavChunks(b).find((x) => x.id === "id3 " || x.id === "ID3 ");
  return c ? b.slice(c.start, c.start + c.size).buffer : null;
}

export async function embedMetadata(audio: ArrayBuffer, metadata: Metadata, artwork?: ArrayBuffer): Promise<Blob> {
  const data = metadataSchema.parse(metadata);
  const wav = isWav(audio);
  const writer = new ID3Writer(wav ? new ArrayBuffer(0) : audio);
  // No spare padding inside a WAV chunk (the library adds 4 KB for MP3s, for later in-place edits).
  if (wav) (writer as unknown as { padding: number }).padding = 0;
  writer.setFrame("TIT2", data.title).setFrame("TPE1", [data.artist, ...data.featured.filter(Boolean)]);
  if (data.trackNumber) writer.setFrame("TRCK", data.trackTotal ? `${data.trackNumber}/${data.trackTotal}` : data.trackNumber);
  if (data.album) writer.setFrame("TALB", data.album);
  if (data.isrc) writer.setFrame("TSRC", data.isrc.replace(/-/g, "").toUpperCase());
  if (data.duration) {
    const [m, s] = data.duration.split(":").map(Number);
    writer.setFrame("TLEN", ((m ?? 0) * 60 + (s ?? 0)) * 1000);
  }
  const genres = [data.primaryGenre, data.secondaryGenre].filter(Boolean);
  if (genres.length) writer.setFrame("TCON", genres);
  if (data.releaseDate) {
    writer.setFrame("TYER", Number(data.releaseDate.slice(0, 4)));
    writer.setFrame("TXXX", { description: "RELEASE_DATE", value: data.releaseDate });
  }
  for (const [description, value] of [["UPC", data.upc], ["ISWC", data.iswc], ["RELEASE_TYPE", data.releaseType], ["LABEL", data.label], ["EXPLICIT", data.explicit ? "Yes" : "No"]] as const) {
    if (value) writer.setFrame("TXXX", { description, value });
  }
  const writers = data.writers.filter(creditName).map((row) => ({ ...row, name: creditName(row) }));
  const composers = data.composers.filter(creditName).map((row) => ({ ...row, name: creditName(row) }));
  if (writers.length || composers.length) writer.setFrame("TCOM", [...writers, ...composers].map((row) => row.name));
  // Privacy rule: PRO affiliations, IPI numbers and split percentages are never embedded — names only.
  // Publishers, ℗ and language are never embedded at all; they live in the catalog for registration.
  const publicOnly = (rows: Contributor[]) => JSON.stringify(rows.map(({ name }) => ({ name, pro: "", ipi: "", percentage: "" })));
  if (writers.length) writer.setFrame("TXXX", { description: "WRITER_SPLITS", value: publicOnly(writers) });
  if (composers.length) writer.setFrame("TXXX", { description: "COMPOSER_SPLITS", value: publicOnly(composers) });
  const producers = (data.producers ?? []).filter((row) => row.name);
  if (producers.length) writer.setFrame("TXXX", { description: "PRODUCERS", value: producers.map((row) => row.name).join(", ") });
  if (data.contactEmail) {
    writer.setFrame("TXXX", { description: "CONTACT_EMAIL", value: data.contactEmail });
    // Comments are what most players show, so the contact is visible without special software.
    writer.setFrame("COMM", { description: "", text: `Contact: ${data.contactEmail}`, language: "eng" });
  }
  if (data.copyright) writer.setFrame("TCOP", data.copyright);
  if (data.lyrics) writer.setFrame("USLT", { description: "", lyrics: data.lyrics, language: "eng" });
  const credits = data.credits.filter((c) => c.name);
  if (credits.length) writer.setFrame("TXXX", { description: "CREDITS", value: JSON.stringify(credits) });
  if (artwork) writer.setFrame("APIC", { type: 3, data: artwork, description: "Front cover" });
  if (wav) return wavWithTags(audio, writer.addTag(), data);
  return new Blob([writer.addTag()], { type: "audio/mpeg" });
}

/** Reads ID3v2.3/2.4 text frames written by embedMetadata so re-uploads pre-fill the form. */
export function readMetadata(buf: ArrayBuffer): Partial<Metadata> & { picture?: Blob } {
  if (isWav(buf)) { const tag = wavId3(buf); return tag ? readMetadata(tag) : {}; }
  const b = new Uint8Array(buf);
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return {};
  const ver = b[3];
  const syncsafe = (i: number) => ((b[i]! & 127) << 21) | ((b[i + 1]! & 127) << 14) | ((b[i + 2]! & 127) << 7) | (b[i + 3]! & 127);
  const end = 10 + syncsafe(6);
  const dec = (enc: number, bytes: Uint8Array) => new TextDecoder(enc === 1 ? "utf-16" : enc === 2 ? "utf-16be" : enc === 3 ? "utf-8" : "latin1").decode(bytes).replace(/\uFEFF/g, "").replace(/\u0000+$/, "");
  const frames: Record<string, string> = {}; const txxx: Record<string, string> = {}; let lyrics = ""; let picture: Blob | undefined;
  let i = 10;
  while (i + 10 <= end && b[i] !== 0) {
    const id = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
    const size = ver === 4 ? syncsafe(i + 4) : (b[i + 4]! << 24) | (b[i + 5]! << 16) | (b[i + 6]! << 8) | b[i + 7]!;
    const body = b.subarray(i + 10, i + 10 + size); const enc = body[0] ?? 0;
    if (id === "TXXX") {
      const parts = dec(enc, body.subarray(1)).split("\u0000").filter((x) => x !== "");
      if (parts[0]) txxx[parts[0]] = parts.slice(1).join("");
    } else if (id === "USLT") {
      lyrics = dec(enc, body.subarray(4)).split("\u0000").filter(Boolean).pop() ?? "";
    } else if (id === "APIC" && !picture) {
      const mimeEnd = body.indexOf(0, 1);
      const mime = new TextDecoder("latin1").decode(body.subarray(1, mimeEnd)) || "image/jpeg";
      let j = mimeEnd + 2;
      if (enc === 1 || enc === 2) { while (j + 1 < body.length && !(body[j] === 0 && body[j + 1] === 0)) j += 2; j += 2; }
      else { while (j < body.length && body[j] !== 0) j++; j++; }
      picture = new Blob([body.slice(j)], { type: mime.includes("png") ? "image/png" : "image/jpeg" });
    } else if (id.startsWith("T")) frames[id] = dec(enc, body.subarray(1)).replace(/\u0000/g, "/");
    i += 10 + size;
  }
  const json = <T,>(v?: string): T | undefined => { try { return v ? JSON.parse(v) as T : undefined; } catch { return undefined; } };
  const out: Partial<Metadata> & { picture?: Blob } = {};
  if (picture && picture.size > 0) out.picture = picture;
  if (frames["TIT2"]) out.title = frames["TIT2"];
  if (frames["TPE1"]) { const [a, ...f] = frames["TPE1"].split("/"); out.artist = a ?? ""; out.featured = f.length ? f : [""]; }
  if (frames["TALB"]) out.album = frames["TALB"];
  if (frames["TRCK"]) Object.assign(out, splitTrack(frames["TRCK"]));
  if (frames["TSRC"]) out.isrc = frames["TSRC"];
  if (txxx["UPC"]) out.upc = txxx["UPC"];
  if (txxx["ISWC"]) out.iswc = txxx["ISWC"];
  if (txxx["LABEL"]) out.label = txxx["LABEL"];
  if (txxx["CONTACT_EMAIL"]) out.contactEmail = txxx["CONTACT_EMAIL"];
  if (frames["TCOP"]) out.copyright = frames["TCOP"];
  if (txxx["RELEASE_DATE"]) out.releaseDate = txxx["RELEASE_DATE"];
  if (txxx["EXPLICIT"]) out.explicit = txxx["EXPLICIT"] === "Yes";
  const w = json<Contributor[]>(txxx["WRITER_SPLITS"]); if (w?.length) out.writers = withLegalName(w);
  const c = json<Contributor[]>(txxx["COMPOSER_SPLITS"]); if (c?.length) out.composers = withLegalName(c);
  if (txxx["PRODUCERS"]) out.producers = txxx["PRODUCERS"].split(", ").map((name) => ({ ...emptyContributor(), name }));
  const cr = json<Metadata["credits"]>(txxx["CREDITS"]); if (cr) out.credits = cr;
  if (frames["TCON"]) {
    // Genre names contain "/" (e.g. "R&B/Soul"), so match known genres instead of splitting.
    const raw = frames["TCON"];
    const found = GENRES.filter((g) => raw.includes(g)).sort((a, b) => raw.indexOf(a) - raw.indexOf(b));
    if (found[0]) out.primaryGenre = found[0];
    if (found[1]) out.secondaryGenre = found[1];
  }
  if (frames["TLEN"]) { const sec = Math.round(Number(frames["TLEN"]) / 1000); if (sec > 0) out.duration = formatDuration(sec); }
  if (txxx["RELEASE_TYPE"]) out.releaseType = txxx["RELEASE_TYPE"];
  const pubs = json<Contributor[]>(txxx["PUBLISHERS"]);
  if (pubs?.length) out.publishers = pubs.map((p) => ({ ...emptyContributor(), ...p }));
  else if (frames["TPUB"]) out.publishers = frames["TPUB"].split("; ").map((name) => ({ ...emptyContributor(), name }));
  if (lyrics) out.lyrics = lyrics;
  return out;
}
