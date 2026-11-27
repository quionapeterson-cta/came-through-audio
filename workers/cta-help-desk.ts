/**
 * Came Through Audio Help Desk — a standalone Cloudflare Worker.
 *
 * It is not one of the email routing workers and shares nothing with them: its own name (`cta-help-desk`), its own
 * config (`workers/wrangler.toml`) and its own `AI` binding. Deploying it changes no Email Routing rule.
 *
 * Deploy (from the repo root):
 *   npx wrangler deploy -c workers/wrangler.toml
 *   npx wrangler secret put GROQ_API_KEY -c workers/wrangler.toml     # once, to switch the main brain on
 *
 * The answer order (founder, 2026-11-27):
 *   1. Groq — `openai/gpt-oss-120b` on Groq's free plan, asked with the Help Desk's own instructions. This answers
 *      almost everything, so Cloudflare's AI allowance stays for contract generation.
 *   2. The help centre — when Groq cannot answer (no key, rate limited, down), the widget answers from its own
 *      knowledge base instead of spending anything. That happens in the app, not here.
 *   3. Workers AI — only when the visitor asks something the help centre has no answer for *and* Groq is unavailable.
 *      The app asks for this stage explicitly, and it has its own small hourly cap (CLOUDFLARE_FALLBACK_LIMIT_PER_HOUR)
 *      so a busy day cannot eat the neurons.
 *
 * What protects it, in the order it happens:
 *   1. Origin lock   — only camethroughaudio.com (and our preview hosts / a loopback dev server) may call it.
 *   2. Method + size — POST only, one question of at most 500 characters (see src/lib/help-desk-worker.ts).
 *   3. Rate limit    — 20 messages an hour per visitor IP (5 Workers AI fallbacks), counted in the Cache API, so one
 *                      bot cannot spend the day's requests or neurons.
 *
 * The rules themselves live in src/lib/help-desk-worker.ts so they are unit-tested alongside the app.
 */
import {
  allowedOrigin,
  buildMessages,
  CLOUDFLARE_FALLBACK_LIMIT_PER_HOUR,
  GROQ_CHAT_URL,
  GROQ_MODEL,
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
type Env = { AI: AiBinding; GROQ_API_KEY?: string };

/** Long enough for a real answer, short enough that a stalled provider hands over to the next layer. */
const GROQ_TIMEOUT_MS = 12_000;

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

/**
 * Ask Groq, and return its answer or `null`. A failure here is not an error for the member: the app moves on to the
 * help centre, and Workers AI if the help centre has nothing.
 */
async function askGroq(
  key: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<string | null> {
  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_completion_tokens: 500,
        temperature: 0.25,
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Logged for `wrangler tail`. 429 means the free plan's daily/minute allowance is spent for now.
      console.error("help-desk groq failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (error) {
    console.error("help-desk groq failed", error instanceof Error ? error.message : String(error));
    return null;
  }
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
    let body: {
      message?: unknown;
      currentRoute?: unknown;
      history?: unknown;
      stage?: unknown;
    };
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

    // 3. Per-IP, per-hour cap in the Cache API. The Workers AI stage counts in its own, smaller bucket. A cache miss or
    //    a cold colo starts that IP at zero for the window.
    const wantsCloudflare = body.stage === "workers-ai";
    const limit = wantsCloudflare ? CLOUDFLARE_FALLBACK_LIMIT_PER_HOUR : RATE_LIMIT_PER_HOUR;
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const cache = caches.default;
    const key = new Request(rateLimitKey(ip, now, wantsCloudflare ? "cloudflare" : "messages"), {
      method: "GET",
    });
    const hit = await cache.match(key);
    const used = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
    const verdict = rateLimitVerdict(used, limit);
    if (!verdict.allowed) {
      return reply({ error: "Too many messages. Try again later." }, 429, allowed, {
        "Retry-After": String(secondsUntilNextWindow(now)),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      });
    }
    await cache.put(
      key,
      new Response(String(used + 1), {
        headers: { "cache-control": "max-age=3600", "content-type": "text/plain" },
      }),
    );

    const messages = buildMessages({
      message,
      currentRoute: typeof body.currentRoute === "string" ? body.currentRoute : "",
      history: body.history as never,
    });
    const remaining = { "X-RateLimit-Remaining": String(verdict.remaining) };

    // 4. The last resort: Workers AI, reached only when the app asks for this stage.
    if (wantsCloudflare) {
      try {
        const ai = await env.AI.run(HELP_DESK_MODEL, {
          messages,
          max_tokens: 500,
          temperature: 0.25,
        });
        const text = (typeof ai === "string" ? ai : ai?.response)?.trim();
        if (!text) return reply({ error: "No answer. Please try again." }, 502, allowed);
        return reply({ reply: text, source: "cloudflare" }, 200, allowed, remaining);
      } catch (error) {
        console.error(
          "help-desk workers ai failed",
          error instanceof Error ? error.message : String(error),
        );
        return reply({ error: "The Help Desk is unavailable right now." }, 503, allowed);
      }
    }

    // 5. The main brain: Groq. No key yet, or a busy day, is answered with an honest 503 — the app then uses the help
    //    centre, so nothing the member sees ever breaks.
    const groqKey = (env.GROQ_API_KEY ?? "").trim();
    if (!groqKey) {
      return reply(
        { error: "The Help Desk is not configured yet.", reason: "unconfigured" },
        503,
        allowed,
      );
    }
    const text = await askGroq(groqKey, messages);
    if (!text) {
      return reply(
        { error: "The Help Desk is unavailable right now.", reason: "unavailable" },
        503,
        allowed,
      );
    }
    return reply({ reply: text, source: "groq" }, 200, allowed, remaining);
  },
};
