// Browser-safe helpers for building OpenTimestamps (.ots) proof files.
const MAGIC = [
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f,
  0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
];

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
}

/** Standard detached .ots file: magic header, version 1, SHA-256 op, digest, calendar timestamp. */
export function buildOtsFile(digestHex: string, receiptB64: string): Uint8Array {
  const receipt = Uint8Array.from(atob(receiptB64), (c) => c.charCodeAt(0));
  const digest = hexToBytes(digestHex);
  const out = new Uint8Array(MAGIC.length + 2 + digest.length + receipt.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = 0x01;
  out[MAGIC.length + 1] = 0x08;
  out.set(digest, MAGIC.length + 2);
  out.set(receipt, MAGIC.length + 2 + digest.length);
  return out;
}

/** Text manifest whose SHA-256 is the stamped digest — users verify this file with its .ots. */
export function proofManifest(p: Record<string, string>): string {
  return ["CAME THROUGH AUDIO — PROOF MANIFEST", ...Object.entries(p).map(([k, v]) => `${k}: ${v}`)].join("\n") + "\n";
}

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
