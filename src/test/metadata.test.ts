import { describe, expect, it } from "vitest";
import { embedMetadata, emptyMetadata, metadataSchema } from "@/lib/metadata";

describe("MP3 metadata", () => {
  it("embeds title, artist and ISRC without changing the audio bytes", async () => {
    const audio = new Uint8Array([255, 251, 144, 0, 1, 2, 3, 4]);
    const data = { ...emptyMetadata(), title: "Test Track", artist: "Test Artist", isrc: "USABC2600001" };
    const blob = await embedMetadata(audio.buffer, data);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("Expected binary data"));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const bytes = new Uint8Array(buffer);
    expect(Array.from(bytes.slice(0, 3))).toEqual([73, 68, 51]);
    expect(Array.from(bytes.slice(-audio.length))).toEqual(Array.from(audio));
    const text = Array.from(bytes).map((byte) => String.fromCharCode(byte)).join("");
    expect(text).toContain("TIT2");
    expect(text).toContain("TPE1");
    expect(text).toContain("TSRC");
    expect(text.replace(/\0/g, "")).toContain("Test Track");
    expect(text.replace(/\0/g, "")).toContain("Test Artist");
    expect(text.replace(/\0/g, "")).toContain("USABC2600001");
  });

  it("requires title and artist", () => {
    expect(metadataSchema.safeParse(emptyMetadata()).success).toBe(false);
    expect(metadataSchema.safeParse({ ...emptyMetadata(), title: "Track", artist: "Artist" }).success).toBe(true);
  });

  it("rejects malformed identifiers and percentages over 100", () => {
    const base = { ...emptyMetadata(), title: "Track", artist: "Artist" };
    expect(metadataSchema.safeParse({ ...base, isrc: "invalid" }).success).toBe(false);
    expect(metadataSchema.safeParse({ ...base, writers: [{ name: "A", pro: "", percentage: "70" }, { name: "B", pro: "", percentage: "40" }] }).success).toBe(false);
  });
});