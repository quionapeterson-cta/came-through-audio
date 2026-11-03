import type {
  CompositionQuery,
  WorkLookup,
  WorkRecord,
  WorkPublisher,
  WorkWriter,
} from "@/lib/composition";

/**
 * The MLC Public Search API adapter (hub plan §4.4). Server only: the credentials never reach the browser.
 *
 * Credentials, in Cloudflare Worker secrets (Vercel until the cutover):
 *   MLC_API_KEY                        — when The MLC issues a single key
 *   MLC_CLIENT_ID + MLC_CLIENT_SECRET  — when it issues a client pair (a token is fetched per request)
 *   MLC_API_BASE                       — optional override of the API host
 *
 * **Confirm the three marked spots against the Data Access Hub onboarding doc when access lands.** They are written to
 * The MLC's published shape (a work search by ISRC, then by writer/title) but never exercised without credentials, so
 * they stay inert rather than pretend. An unrecognised response throws instead of returning "no work", which keeps a
 * schema change from being read as a missing registration.
 */
const base = () =>
  (process.env["MLC_API_BASE"] ?? "https://public-api.themlc.com").replace(/\/+$/, "");

type RawWork = {
  id?: unknown;
  workId?: unknown;
  work_id?: unknown;
  iswc?: unknown;
  title?: unknown;
  writers?: unknown;
  publishers?: unknown;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const writers = (v: unknown): WorkWriter[] => {
  if (!Array.isArray(v)) return [];
  return v.flatMap((w) => {
    if (!w || typeof w !== "object") return [];
    const r = w as Record<string, unknown>;
    const name = str(r["name"] ?? r["writerName"] ?? r["writer_name"]);
    if (!name) return [];
    return [
      {
        name,
        ipi: str(r["ipi"] ?? r["ipiNumber"] ?? r["ipi_name_number"]),
        pro: str(r["pro"] ?? r["affiliation"] ?? r["society"]),
      },
    ];
  });
};

const publishers = (v: unknown): WorkPublisher[] => {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const r = p as Record<string, unknown>;
    const name = str(r["name"] ?? r["publisherName"] ?? r["publisher_name"]);
    if (!name) return [];
    return [{ name, ipi: str(r["ipi"] ?? r["ipiNumber"] ?? r["ipi_name_number"]) }];
  });
};

/**
 * The MLC answers with a result envelope we do not control. Three outcomes, kept apart on purpose:
 *  - "work": a work matched.
 *  - "empty": the search ran and found nothing — the only route to "unregistered".
 *  - "unknown": a shape we don't recognise, so we refuse to draw a conclusion.
 */
export type ParsedSearch =
  { kind: "work"; work: WorkRecord } | { kind: "empty" } | { kind: "unknown" };

export function parseSearch(body: unknown): ParsedSearch {
  if (!body || typeof body !== "object") return { kind: "unknown" };
  const envelope = body as Record<string, unknown>;
  const list = Array.isArray(body)
    ? body
    : (envelope["data"] ?? envelope["results"] ?? envelope["works"] ?? envelope["content"]);
  if (!Array.isArray(list)) return { kind: "unknown" };
  if (list.length === 0) return { kind: "empty" };
  const first = list[0] as RawWork | undefined;
  if (!first || typeof first !== "object") return { kind: "unknown" };
  const workId = str(first.workId) ?? str(first.work_id) ?? str(first.id);
  const iswc = str(first.iswc);
  const title = str(first.title);
  const w = writers(first.writers);
  // A work record with no identifier and no writers is not something we can act on.
  if (!workId && !iswc && !w.length) return { kind: "unknown" };
  return {
    kind: "work",
    work: { workId, iswc, title, writers: w, publishers: publishers(first.publishers) },
  };
}

/**
 * The live MLC lookup, or an inert one when nothing is configured. `available` is decided from the environment alone,
 * so the UI can say plainly whether composition checks are on.
 */
export function mlcLookup(fetcher: typeof fetch = fetch): WorkLookup {
  const apiKey = process.env["MLC_API_KEY"];
  const clientId = process.env["MLC_CLIENT_ID"];
  const clientSecret = process.env["MLC_CLIENT_SECRET"];
  const available = !!apiKey || !!(clientId && clientSecret);

  /** SPOT 1: how a client-credentials pair is exchanged for a token. */
  const token = async (): Promise<string | undefined> => {
    if (apiKey) return apiKey;
    const res = await fetcher(`${base()}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId!,
        client_secret: clientSecret!,
      }),
    });
    if (!res.ok) throw new Error(`MLC token request answered ${res.status}`);
    const body = (await res.json()) as { access_token?: unknown; token?: unknown };
    const value = str(body.access_token) ?? str(body.token);
    if (!value) throw new Error("MLC token response had no token.");
    return value;
  };

  /** SPOT 2: the work search itself — by ISRC first, since that is what a released recording carries. */
  const searchUrl = (q: CompositionQuery) => {
    const params = new URLSearchParams(
      q.isrc ? { isrc: q.isrc } : { title: q.title, writer: q.artist },
    );
    return `${base()}/works/search?${params.toString()}`;
  };

  return {
    name: "The MLC",
    available,
    async find(query) {
      if (!available) throw new Error("MLC credentials are not configured.");
      const auth = await token();
      const res = await fetcher(searchUrl(query), {
        headers: {
          accept: "application/json",
          ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        },
      });
      // SPOT 3: the envelope key in parseSearch() above.
      if (!res.ok) throw new Error(`MLC search answered ${res.status}`);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new Error("MLC search returned something that was not JSON.");
      }
      const parsed = parseSearch(body);
      if (parsed.kind === "unknown") throw new Error("Unrecognised MLC response shape.");
      return parsed.kind === "work" ? parsed.work : null;
    },
  };
}
