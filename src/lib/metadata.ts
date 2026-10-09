import { z } from "zod";
import { ID3Writer } from "browser-id3-writer";

export const contributorSchema = z.object({
  name: z.string().trim(),
  pro: z.string().trim(),
  percentage: z.string().trim().refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100), "Enter a percentage between 0 and 100."),
});

export const metadataSchema = z.object({
  title: z.string().trim().min(1, "Track title is required."),
  artist: z.string().trim().min(1, "Artist name is required."),
  featured: z.string().trim(),
  album: z.string().trim(),
  releaseDate: z.string(),
  isrc: z.string().trim().refine((value) => !value || /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(value.replace(/-/g, "")), "Enter a valid 12-character ISRC."),
  upc: z.string().trim().refine((value) => !value || /^\d{12,13}$/.test(value), "Enter a 12- or 13-digit UPC/EAN."),
  iswc: z.string().trim().refine((value) => !value || /^T\d{10}$/i.test(value.replace(/[.\s-]/g, "")), "Enter a valid ISWC (T followed by 10 digits)."),
  writers: z.array(contributorSchema),
  publishers: z.array(contributorSchema),
}).superRefine((data, ctx) => {
  for (const group of ["writers", "publishers"] as const) {
    data[group].forEach((row, index) => {
      if ((row.pro || row.percentage) && !row.name) ctx.addIssue({ code: "custom", path: [group, index, "name"], message: "Enter a name for this contributor." });
    });
    const total = data[group].reduce((sum, row) => sum + Number(row.percentage || 0), 0);
    if (total > 100) ctx.addIssue({ code: "custom", path: [group], message: "Total percentages cannot exceed 100%." });
  }
});

export type Metadata = z.infer<typeof metadataSchema>;
export type Contributor = z.infer<typeof contributorSchema>;
export const emptyContributor = (): Contributor => ({ name: "", pro: "", percentage: "" });
export const emptyMetadata = (): Metadata => ({ title: "", artist: "", featured: "", album: "", releaseDate: "", isrc: "", upc: "", iswc: "", writers: [emptyContributor()], publishers: [emptyContributor()] });

export async function embedMetadata(audio: ArrayBuffer, metadata: Metadata, artwork?: ArrayBuffer): Promise<Blob> {
  const data = metadataSchema.parse(metadata);
  const writer = new ID3Writer(audio);
  writer.setFrame("TIT2", data.title).setFrame("TPE1", [data.artist, ...data.featured.split(",").map((name) => name.trim()).filter(Boolean)]);
  if (data.album) writer.setFrame("TALB", data.album);
  if (data.isrc) writer.setFrame("TSRC", data.isrc.replace(/-/g, "").toUpperCase());
  if (data.releaseDate) {
    writer.setFrame("TYER", Number(data.releaseDate.slice(0, 4)));
    writer.setFrame("TXXX", { description: "RELEASE_DATE", value: data.releaseDate });
  }
  for (const [description, value] of [["UPC", data.upc], ["ISWC", data.iswc]] as const) {
    if (value) writer.setFrame("TXXX", { description, value });
  }
  const writers = data.writers.filter((row) => row.name);
  const publishers = data.publishers.filter((row) => row.name);
  if (writers.length) {
    writer.setFrame("TCOM", writers.map((row) => row.name));
    writer.setFrame("TXXX", { description: "WRITER_SPLITS", value: JSON.stringify(writers) });
  }
  if (publishers.length) {
    writer.setFrame("TPUB", publishers.map((row) => row.name).join("; "));
    writer.setFrame("TXXX", { description: "PUBLISHER_SPLITS", value: JSON.stringify(publishers) });
  }
  if (artwork) writer.setFrame("APIC", { type: 3, data: artwork, description: "Front cover" });
  return new Blob([writer.addTag()], { type: "audio/mpeg" });
}