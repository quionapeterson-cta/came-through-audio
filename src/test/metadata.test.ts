import { describe, expect, it } from "vitest";
import { embedMetadata, emptyMetadata, metadataSchema, readMetadata } from "@/lib/metadata";

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

  it("reads back genres, release type and duration for pre-fill, and never embeds publishers", async () => {
    const data = { ...emptyMetadata(), title: "Therapy", artist: "Karma Came", primaryGenre: "R&B/Soul", releaseType: "EP", duration: "3:25", publishers: [{ name: "Came Pub", pro: "BMI", ipi: "123456789", percentage: "" }] };
    const blob = await embedMetadata(new Uint8Array([255, 251, 144, 0]).buffer, data);
    const buf = await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(blob); });
    const out = readMetadata(buf);
    expect(out.primaryGenre).toBe("R&B/Soul");
    expect(out.releaseType).toBe("EP");
    expect(out.duration).toBe("3:25");
    expect(out.publishers).toBeUndefined();
    expect(new TextDecoder("latin1").decode(buf)).not.toContain("Came Pub");
  });
});

import { embedMetadata as embedPrivacy, emptyMetadata as emptyPrivacy } from "@/lib/metadata";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("embed privacy", () => {
  i2("never writes PRO affiliations or IPI numbers into the file", async () => {
    const m = { ...emptyPrivacy(), title: "Song", artist: "Kay",
      writers: [{ name: "Kay Writer", pro: "BMI", ipi: "123456789", percentage: "50" }],
      publishers: [{ name: "Kay Pub", pro: "ASCAP", ipi: "987654321", percentage: "50" }] };
    const blob = await embedPrivacy(new ArrayBuffer(16), m);
    const buf = await new Promise<ArrayBuffer>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob); }); const text = new TextDecoder("utf-16le").decode(buf) + new TextDecoder("latin1").decode(buf);
    e2(text).toContain("Kay Writer");
    e2(text).not.toContain("123456789");
    e2(text).not.toContain("987654321");
  });
});

describe("WAV metadata", () => {
  /** A tiny valid WAV: fmt chunk + 4 bytes of 16-bit mono PCM. */
  const wav = () => {
    const fmt = [1, 0, 1, 0, 0x44, 0xac, 0, 0, 0x88, 0x58, 1, 0, 2, 0, 16, 0];
    const pcm = [1, 2, 3, 4];
    const le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
    const body = [..."WAVE"].map((c) => c.charCodeAt(0)).concat([..."fmt "].map((c) => c.charCodeAt(0)), le(16), fmt, [..."data"].map((c) => c.charCodeAt(0)), le(4), pcm);
    return new Uint8Array([..."RIFF"].map((c) => c.charCodeAt(0)).concat(le(body.length), body)).buffer;
  };
  const bytes = (blob: Blob) => new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error("Expected binary data"));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

  it("keeps the audio, adds an INFO list and an id3 chunk, and reads it back", async () => {
    const data = { ...emptyMetadata(), title: "Therapy", artist: "Karma Came", isrc: "USABC2600001", lyrics: "la la", publishers: [{ name: "Came Pub", pro: "BMI", ipi: "123456789", percentage: "" }] };
    const out = await bytes(await embedMetadata(wav(), data));
    const text = String.fromCharCode(...out);
    expect(text.slice(0, 4)).toBe("RIFF");
    expect(text.slice(8, 12)).toBe("WAVE");
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
    expect(text).toContain("data\u0004\u0000\u0000\u0000\u0001\u0002\u0003\u0004");
    expect(text).toContain("INFOINAM");
    expect(text).toContain("id3 ");
    // Publisher details never go in the file.
    expect(text.replace(/\0/g, "")).not.toContain("Came Pub");
    const back = readMetadata(out.buffer);
    expect(back).toMatchObject({ title: "Therapy", artist: "Karma Came", isrc: "USABC2600001", lyrics: "la la" });
  });

  it("replaces earlier tags instead of stacking them", async () => {
    const once = await bytes(await embedMetadata(wav(), { ...emptyMetadata(), title: "One", artist: "A" }));
    const twice = await bytes(await embedMetadata(once.buffer, { ...emptyMetadata(), title: "Two", artist: "A" }));
    const text = String.fromCharCode(...twice);
    expect(text.split("id3 ").length).toBe(2);
    expect(text.split("INFOINAM").length).toBe(2);
    expect(readMetadata(twice.buffer).title).toBe("Two");
  });
});
