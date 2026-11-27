/**
 * Came Through Audio Help Desk — a standalone Cloudflare Worker.
 *
 * It is not one of the email routing workers and shares nothing with them: its own name (`cta-help-desk`), its own
 * config (`workers/wrangler.toml`) and its own `AI` binding. Deploying it changes no Email Routing rule.
 *
 * Deploy (from the repo root):
 *   npx wrangler deploy -c workers/wrangler.toml
 *
 * What protects it, in the order it happens:
 *   1. Origin lock   — only camethroughaudio.com (and our preview hosts / a loopback dev server) may call it.
 *   2. Method + size — POST only, one question of at most 500 characters (see src/lib/help-desk-worker.ts).
 *   3. Rate limit    — 20 messages an hour per visitor IP, counted in the Cache API, so one bot cannot spend the day's
 *                      Worker requests or AI neurons.
 *   4. Workers AI    — @cf/meta/llama-3.1-8b-instruct-fp8 with the Help Desk's own instructions.
 *
 * The rules themselves live in src/lib/help-desk-worker.ts so they are unit-tested alongside the app.
 */
import {
  allowedOrigin,
  buildMessages,
  HELP_DESK_MODEL,
  MAX_MESSAGE_CHARS,
  normaliseMessage,
  RATE_LIMIT_PER_HOUR,
  rateLimitKey,
  rateLimitVerdict,
  secondsUntilNextWindow,
} from "../src/lib/help-desk-worker";

type AiBinding = {
  run: (model: string, input: unknown) => Promise<{ response?: string } | string>;
};
type Env = { AI: AiBinding };

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

function reply(
  body: unknown,
  status: number,
  origin: string | null,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
      ...extra,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");

    // 1. Origin lock. Refused before anything is counted or any AI work is spent. Pass no origin on the refusal: an
    //    Access-Control-Allow-Origin header on a 403 would echo a domain we just rejected.
    if (!allowedOrigin(origin, referer)) return reply({ error: "Forbidden" }, 403, null);
    const allowed = origin as string;

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, allowed);

    // 2. One question at a time, within the length cap.
    let body: { message?: unknown; currentRoute?: unknown; history?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return reply({ error: "Send a JSON body with a message." }, 400, allowed);
    }
    const message = normaliseMessage(body.message);
    if (!message) {
      return reply(
        { error: `Send a question of up to ${MAX_MESSAGE_CHARS} characters.` },
        400,
        allowed,
      );
    }

    // 3. Per-IP, per-hour cap in the Cache API. A cache miss or a cold colo starts that IP at zero for the window.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const cache = caches.default;
    const key = new Request(rateLimitKey(ip, now), { method: "GET" });
    const hit = await cache.match(key);
    const used = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
    const verdict = rateLimitVerdict(used);
    if (!verdict.allowed) {
      return reply({ error: "Too many messages. Try again later." }, 429, allowed, {
        "Retry-After": String(secondsUntilNextWindow(now)),
        "X-RateLimit-Limit": String(RATE_LIMIT_PER_HOUR),
        "X-RateLimit-Remaining": "0",
      });
    }
    await cache.put(
      key,
      new Response(String(used + 1), {
        headers: { "cache-control": "max-age=3600", "content-type": "text/plain" },
      }),
    );

    // 4. Workers AI, grounded by the Help Desk's own instructions and the page the member is on.
    try {
      const ai = await env.AI.run(HELP_DESK_MODEL, {
        messages: buildMessages({
          message,
          currentRoute: typeof body.currentRoute === "string" ? body.currentRoute : "",
          history: body.history as never,
        }),
        max_tokens: 500,
        temperature: 0.25,
      });
      const text = (typeof ai === "string" ? ai : ai?.response)?.trim();
      if (!text) return reply({ error: "No answer. Please try again." }, 502, allowed);
      return reply({ reply: text }, 200, allowed, {
        "X-RateLimit-Remaining": String(verdict.remaining),
      });
    } catch (error) {
      // Logged for `wrangler tail`; the member sees a plain message and the app falls back to its own answers.
      console.error("help-desk ai failed", error instanceof Error ? error.message : String(error));
      return reply({ error: "The Help Desk is unavailable right now." }, 503, allowed);
    }
  },
};
