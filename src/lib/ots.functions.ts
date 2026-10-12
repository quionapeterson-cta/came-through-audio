import { createServerFn } from "@tanstack/react-start";

const CALENDARS = [
  "https://a.pool.opentimestamps.org",
  "https://b.pool.opentimestamps.org",
  "https://a.pool.eternitywall.com",
];

/** Submits a SHA-256 digest to free OpenTimestamps calendars; returns the base64 pending receipt. */
export const stampDigest = createServerFn({ method: "POST" })
  .inputValidator((input: { digest: string }) => {
    if (!/^[0-9a-f]{64}$/.test(input.digest)) throw new Error("Invalid digest");
    return input;
  })
  .handler(async ({ data }) => {
    const bytes = new Uint8Array(data.digest.match(/../g)!.map((h) => parseInt(h, 16)));
    for (const cal of CALENDARS) {
      try {
        const res = await fetch(`${cal}/digest`, {
          method: "POST",
          headers: { Accept: "application/vnd.opentimestamps.v1", "Content-Type": "application/x-www-form-urlencoded" },
          body: bytes,
        });
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        let s = "";
        buf.forEach((b) => (s += String.fromCharCode(b)));
        return { calendar: cal, receipt: btoa(s) };
      } catch {
        /* try next calendar */
      }
    }
    throw new Error("OpenTimestamps calendars are unreachable right now. Please try again.");
  });
