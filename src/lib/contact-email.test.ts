import { describe, expect, it } from "vitest";
import { embedMetadata, emptyMetadata, metadataSchema, readMetadata } from "./metadata";
import { fillMissing } from "./artist-profile";

// The test DOM's Blob has no arrayBuffer(); FileReader does the same job.
const bytes = (b: Blob) => new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(b); });

describe("optional contact email (Embed Defaults)", () => {
  it("is embedded when filled, readable again, and left out when blank", async () => {
    const song = { ...emptyMetadata(), title: "Song", artist: "Artist", contactEmail: "bookings@artist.com" };
    const tagged = await bytes(await embedMetadata(new ArrayBuffer(0), song));
    expect(readMetadata(tagged).contactEmail).toBe("bookings@artist.com");
    expect(new TextDecoder("utf-16le").decode(tagged)).toContain("Contact: bookings@artist.com");
    const blank = await bytes(await embedMetadata(new ArrayBuffer(0), { ...song, contactEmail: "" }));
    expect(readMetadata(blank).contactEmail).toBeUndefined();
  });

  it("fills only songs without one and rejects bad addresses", () => {
    expect(fillMissing({ contactEmail: "" }, { contactEmail: "a@b.co" }).contactEmail).toBe("a@b.co");
    expect(fillMissing({ contactEmail: "mine@x.co" }, { contactEmail: "a@b.co" }).contactEmail).toBe("mine@x.co");
    expect(metadataSchema.safeParse({ ...emptyMetadata(), title: "S", artist: "A", contactEmail: "not an email" }).success).toBe(false);
  });
});
