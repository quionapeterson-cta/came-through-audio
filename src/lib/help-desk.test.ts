import { describe, expect, it, vi } from "vitest";
import {
  askHelpDesk,
  EXPERT_HELP,
  HELP_DESK_TICKET,
  helpActions,
  helpTab,
  localAnswer,
  MAX_HELP_CHARS,
  quickQuestions,
} from "./help-desk";

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("quick questions", () => {
  it("fits the workspace tab the member is on", () => {
    expect(helpTab("/workspace?tab=splits")).toBe("splits");
    expect(quickQuestions("/workspace?tab=splits")[0]).toMatch(/split/i);
    expect(quickQuestions("/workspace?tab=health")).toContain("Which PRO should I join?");
    expect(quickQuestions("/workspace?tab=embed").join(" ")).toMatch(/ISWC/);
  });

  it("falls back to questions any visitor can ask", () => {
    expect(quickQuestions("/")).toHaveLength(3);
    expect(quickQuestions("/")).toContain("What's the difference between © and ℗?");
    expect(quickQuestions("/", 2)).toHaveLength(2);
  });
});

describe("action pills", () => {
  it("offers the done-for-you desk where it belongs", () => {
    expect(helpActions("/workspace?tab=health")).toContainEqual({
      label: "Jump to Expert Help →",
      to: EXPERT_HELP,
    });
    expect(helpActions("/workspace?tab=splits")).toContainEqual({
      label: "Let Us Do It For You →",
      to: EXPERT_HELP,
    });
  });

  it("always leaves a way to a person", () => {
    expect(helpActions("/somewhere")).toContainEqual({
      label: "Open the Help Center →",
      to: "/contact",
    });
  });
});

describe("local knowledge base", () => {
  it("answers the two copyrights without the worker", () => {
    const answer = localAnswer("what is the difference between composition and master?");
    expect(answer.source).toBe("local");
    expect(answer.title).toMatch(/Composition/);
    expect(answer.text).toContain("©");
    expect(answer.text).toContain("℗");
  });

  it("understands the copyright symbols on their own", () => {
    const answer = localAnswer("What's the difference between © and ℗?");
    expect(answer.title).toMatch(/Composition/);
    expect(answer.text).toContain("℗");
    expect(localAnswer("copyright of the recording?").title).toMatch(/Composition/);
  });

  it("does not treat an upload question as a copyright question", () => {
    expect(localAnswer("how do I upload a wav file?").title).not.toMatch(/Composition/);
  });

  it("answers a code question with that code", () => {
    expect(localAnswer("what is an ISRC?").text).toContain("ISRC");
    expect(localAnswer("what is an iswc").text).toContain("ISWC");
    expect(localAnswer("what is an ipi number").text).toContain("IPI");
  });

  it("answers a splits question with the two halves", () => {
    const answer = localAnswer("how should two writers split a song 50/50?");
    expect(answer.text).toMatch(/writer share/i);
    expect(answer.text).toMatch(/publisher share/i);
  });

  it("points a done-for-you question at Expert Help", () => {
    const answer = localAnswer("can you register my songs for me?");
    expect(answer.link?.to).toBe(EXPERT_HELP);
  });

  it("never leaves the member with nothing", () => {
    const answer = localAnswer("zzzz qqqq");
    expect(answer.link?.to).toBe(HELP_DESK_TICKET);
    expect(answer.text).toMatch(/support ticket/i);
  });

  it("quotes the real plan prices without the worker", () => {
    const answer = localAnswer("how much does catalog management cost?");
    expect(answer.text).toContain("$89.99");
    expect(answer.text).toContain("$24.99");
    expect(localAnswer("how much is a plan").text).toContain("$44.99");
  });

  it("answers the signing question honestly", () => {
    const answer = localAnswer("do you sign artists?");
    expect(answer.text).toMatch(/don't sign artists|do not sign artists/i);
    expect(answer.text).toMatch(/masters/i);
    expect(answer.text).toMatch(/custom agreement/i);
  });

  it("explains the studio-to-catalog workflow and the tab count", () => {
    expect(localAnswer("what is the studio to catalog workflow?").text).toMatch(/Six steps/i);
    expect(localAnswer("how many tabs are in the dashboard?").text).toMatch(/eight tabs/i);
  });

  it("answers refunds and AI Protection prices", () => {
    const refund = localAnswer("how do refunds work?");
    expect(refund.text).toMatch(/30 days/i);
    expect(refund.text).toContain("billing@camethroughaudio.com");
    const ai = localAnswer("how much is AI Protection?");
    expect(ai.text).toContain("$2.99");
    expect(ai.text).toContain("$24.99");
  });

  it("keeps an artist-seat question on plans, not on signing", () => {
    expect(localAnswer("how do artist seats work?").title).toBe("Plans and prices");
  });
});

describe("the answer order", () => {
  it("answers from the worker when the main brain answers, and asks nothing else", async () => {
    const fetchImpl = vi.fn(async () => ok({ reply: "Groq's answer.", source: "groq" }));
    const reply = await askHelpDesk(
      { message: "what is a master" },
      { url: "https://w.example", fetchImpl: fetchImpl as never },
    );
    expect(reply).toEqual({ text: "Groq's answer.", source: "help-desk" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("answers from the help centre before spending Workers AI", async () => {
    const fetchImpl = vi.fn(async () => ok({ error: "unavailable" }, 503));
    const reply = await askHelpDesk(
      { message: "what is an isrc" },
      { url: "https://w.example", fetchImpl: fetchImpl as never },
    );
    expect(reply.text).toContain("ISRC");
    expect(reply.source).toBe("local");
    expect(reply.degraded).toBe("offline");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks Workers AI only when the help centre has no answer", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const stage = JSON.parse(String(init?.body)).stage;
      return stage === "workers-ai"
        ? ok({ reply: "From Workers AI.", source: "cloudflare" })
        : ok({ error: "unavailable" }, 503);
    });
    const reply = await askHelpDesk(
      { message: "zzzz qqqq" },
      { url: "https://w.example", fetchImpl: fetchImpl as never },
    );
    expect(reply).toEqual({ text: "From Workers AI.", source: "help-desk" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(second[1].body)).stage).toBe("workers-ai");
  });

  it("keeps the ticket answer when every layer is down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const reply = await askHelpDesk(
      { message: "zzzz qqqq" },
      { url: "https://w.example", fetchImpl: fetchImpl as never },
    );
    expect(reply.link?.to).toBe(HELP_DESK_TICKET);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("asking the Help Desk", () => {
  it("answers locally when the worker is not configured yet", async () => {
    const fetchImpl = vi.fn();
    const reply = await askHelpDesk(
      { message: "what is an isrc" },
      { url: "", fetchImpl: fetchImpl as never },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(reply.source).toBe("local");
    expect(reply.text).toContain("ISRC");
  });

  it("uses the worker's answer when it answers", async () => {
    const fetchImpl = vi.fn(async () => ok({ reply: "It identifies the recording." }));
    const reply = await askHelpDesk(
      {
        message: "what is an isrc",
        currentRoute: "/workspace?tab=embed",
        history: [{ role: "user", content: "hi" }],
      },
      { url: "https://cta-help-desk.example.workers.dev", fetchImpl: fetchImpl as never },
    );
    expect(reply).toEqual({ text: "It identifies the recording.", source: "help-desk" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://cta-help-desk.example.workers.dev");
    expect(JSON.parse(String(init.body))).toMatchObject({
      message: "what is an isrc",
      currentRoute: "/workspace?tab=embed",
    });
  });

  it("falls back to the local answer on 429, a bad reply or a dropped connection", async () => {
    const rateLimited = await askHelpDesk(
      { message: "what is an isrc" },
      {
        url: "https://w.example",
        fetchImpl: vi.fn(async () => ok({ error: "Too many" }, 429)) as never,
      },
    );
    expect(rateLimited.source).toBe("local");
    expect(rateLimited.text).toContain("ISRC");
    expect(rateLimited.degraded).toBe("rate-limited");

    const empty = await askHelpDesk(
      { message: "what is an isrc" },
      { url: "https://w.example", fetchImpl: vi.fn(async () => ok({})) as never },
    );
    expect(empty.source).toBe("local");

    const boom = await askHelpDesk(
      { message: "what is an isrc" },
      {
        url: "https://w.example",
        fetchImpl: vi.fn(async () => {
          throw new Error("offline");
        }) as never,
      },
    );
    expect(boom.source).toBe("local");
    expect(boom.text).toContain("ISRC");
    expect(boom.degraded).toBe("offline");
  });

  it("keeps the question within the worker's limit", async () => {
    const fetchImpl = vi.fn(async () => ok({ reply: "ok" }));
    await askHelpDesk(
      { message: "a".repeat(MAX_HELP_CHARS + 200) },
      { url: "https://w.example", fetchImpl: fetchImpl as never },
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).message).toHaveLength(MAX_HELP_CHARS);
  });
});
