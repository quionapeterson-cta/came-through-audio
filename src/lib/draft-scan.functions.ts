import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dates"],
  properties: {
    dates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "label"],
        properties: { date: { type: "string" }, label: { type: "string" } },
      },
    },
  },
};

/** Reads visible on-screen timestamps from sampled draft-video frames. Never guesses. */
export const scanDraftFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { frames: string[] }) => {
    if (!Array.isArray(input.frames) || !input.frames.length || input.frames.length > 6) throw new Error("Invalid frames");
    if (input.frames.some((f) => typeof f !== "string" || !f.startsWith("data:image/jpeg;base64,") || f.length > 1_500_000)) throw new Error("Invalid frame");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "These are frames from a screen recording of an artist's song drafts (Apple Notes, Google Keep, Samsung Notes, Voice Memos, Files). List every creation or modified date that is CLEARLY visible on screen and belongs to a draft, note, memo or file. Return each as ISO YYYY-MM-DD (assume the current year 2026 only if the screen shows no year and context makes it obvious; otherwise skip it). label = a few words of what it belongs to. Never invent or guess dates; return an empty list if none are legible.",
        input: [{ role: "user", content: data.frames.map((image_url) => ({ type: "input_image", image_url })) }],
        text: { format: { type: "json_schema", name: "draft_dates", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 402) throw new Error("AI credits are used up — add credits to scan drafts.");
      if (res.status === 429) throw new Error("Too many scans right now — please try again in a minute.");
      throw new Error(`Date scan failed (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error") throw new Error("Date scan failed.");
        } catch (e) { if (e instanceof Error && e.message === "Date scan failed.") throw e; }
      }
    }
    try {
      const out = JSON.parse(text) as { dates: { date: string; label: string }[] };
      return { dates: out.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && !Number.isNaN(Date.parse(d.date))) };
    } catch { return { dates: [] }; }
  });
