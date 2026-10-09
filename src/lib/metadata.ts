import { z } from "zod";
import { ID3Writer } from "browser-id3-writer";

export const PROS = ["BMI", "ASCAP", "SESAC", "GMR", "SOCAN", "PRS", "PPL", "None"] as const;
export const RELEASE_TYPES = ["Single", "EP", "Album", "Compilation"] as const;
export const GENRES = ["Hip-Hop/Rap", "R&B/Soul", "Pop", "Rock", "Gospel", "Jazz", "Blues", "Country", "Electronic", "Reggae", "Latin", "Afrobeats", "Classical", "Soundtrack", "Alternative", "Other"] as const;

export const contributorSchema = z.object({
  name: z.string().trim(),
  pro: z.string().trim(),
  ipi: z.string().trim().default("").refine((value) => !value || /^\d{9,11}$/.test(value), "IPI numbers are 9–11 digits."),
  percentage: z.string().trim().default("").refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100), "Enter a percentage between 0 and 100."),
});

export const metadataSchema = z.object({
  title: z.string().trim().min(1, "Track title is required."),
  trackNumber: z.string().trim().default("").refine((v) => !v || /^\d{1,3}$/.test(v), "Track number must be a whole number."),
  artist: z.string().trim().min(1, "Artist name is required."),
  featured: z.array(z.string().trim()).default([]),
  album: z.string().trim(),
  duration: z.string().trim().default("").refine((v) => !v || /^\d{1,3}:[0-5]\d$/.test(v), "Enter duration as mm:ss."),
  releaseType: z.string().default(""),
  releaseDate: z.string(),
  label: z.string().trim().default(""),
  isrc: z.string().trim().refine((value) => !value || /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(value.replace(/-/g, "")), "Enter a valid 12-character ISRC."),
  upc: z.string().trim().refine((value) => !value || /^\d{12,13}$/.test(value), "Enter a 12- or 13-digit UPC/EAN."),
  iswc: z.string().trim().refine((value) => !value || /^T\d{10}$/i.test(value.replace(/[.\s-]/g, "")), "Enter a valid ISWC (T followed by 10 digits)."),
  explicit: z.boolean().default(false),
  primaryGenre: z.string().default(""),
  secondaryGenre: z.string().default(""),
  writers: z.array(contributorSchema),
  composers: z.array(contributorSchema).default([]),
  publishers: z.array(contributorSchema),
}).superRefine((data, ctx) => {
  for (const group of ["writers", "composers", "publishers"] as const) {
    data[group].forEach((row, index) => {
      if ((row.pro || row.percentage || row.ipi) && !row.name) ctx.addIssue({ code: "custom", path: [group, index, "name"], message: "Enter a name for this contributor." });
    });
    const total = data[group].reduce((sum, row) => sum + Number(row.percentage || 0), 0);
    if (total > 100) ctx.addIssue({ code: "custom", path: [group], message: "Total percentages cannot exceed 100%." });
  }
});

export type Metadata = z.infer<typeof metadataSchema>;
export type Contributor = z.infer<typeof contributorSchema>;
export const emptyContributor = (): Contributor => ({ name: "", pro: "", ipi: "", percentage: "" });
export const emptyMetadata = (): Metadata => ({
  title: "", trackNumber: "", artist: "", featured: [""], album: "", duration: "", releaseType: "", releaseDate: "", label: "",
  isrc: "", upc: "", iswc: "", explicit: false, primaryGenre: "", secondaryGenre: "",
  writers: [emptyContributor()], composers: [emptyContributor()], publishers: [emptyContributor()],
});

export async function embedMetadata(audio: ArrayBuffer, metadata: Metadata, artwork?: ArrayBuffer): Promise<Blob> {
  const data = metadataSchema.parse(metadata);
  const writer = new ID3Writer(audio);
  writer.setFrame("TIT2", data.title).setFrame("TPE1", [data.artist, ...data.featured.filter(Boolean)]);
  if (data.trackNumber) writer.setFrame("TRCK", data.trackNumber);
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
  const writers = data.writers.filter((row) => row.name);
  const composers = data.composers.filter((row) => row.name);
  const publishers = data.publishers.filter((row) => row.name);
  if (writers.length || composers.length) writer.setFrame("TCOM", [...writers, ...composers].map((row) => row.name));
  if (writers.length) writer.setFrame("TXXX", { description: "WRITER_SPLITS", value: JSON.stringify(writers) });
  if (composers.length) writer.setFrame("TXXX", { description: "COMPOSER_SPLITS", value: JSON.stringify(composers) });
  if (publishers.length) {
    writer.setFrame("TPUB", publishers.map((row) => row.name).join("; "));
    writer.setFrame("TXXX", { description: "PUBLISHERS", value: JSON.stringify(publishers.map(({ name, pro, ipi }) => ({ name, pro, ipi }))) });
  }
  if (artwork) writer.setFrame("APIC", { type: 3, data: artwork, description: "Front cover" });
  return new Blob([writer.addTag()], { type: "audio/mpeg" });
}
