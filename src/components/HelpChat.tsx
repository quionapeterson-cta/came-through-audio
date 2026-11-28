import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LifeBuoy, MessageCircle, Minus, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  askHelpDesk,
  HELP_DESK_NAME,
  HELP_DESK_TICKET,
  helpActions,
  MAX_HELP_CHARS,
  quickQuestions,
  type HelpLink,
} from "@/lib/help-desk";
// The royalty dock kept a lane free for the corner badge this button used to be; this sheet gives the bar its width back.
import "@/help-desk.css";

type Message = {
  from: "you" | "help";
  text: string;
  title?: string | undefined;
  link?: HelpLink | undefined;
  /** Why the live desk could not answer this one, when it could not. */
  notice?: string | undefined;
  rated?: "yes" | "no" | undefined;
};

const DEGRADED: Record<"rate-limited" | "offline", string> = {
  "rate-limited":
    "You've reached the live desk's hourly limit, so this answer came from our help center. Try again in a little while, or open a ticket.",
  offline:
    "The live desk isn't reachable right now, so this answer came from our help center. Open a ticket if you'd like a person to follow up.",
};

const HIDDEN = [/^\/admin/, /^\/verify\//, /^\/contract\//, /^\/sign\//, /^\/unlock/];
const HELLO: Message = {
  from: "help",
  text: "Ask about plans and pricing, refunds, embedding, ISRC and ISWC, registrations, splits, contracts, branding or label services. A person can take over from the Help Center.",
};

/**
 * The Came Through Audio Help Desk (founder, 2026-11-20): a small chat bubble at the bottom right of every page that
 * opens a studio drawer. Answers come from our Cloudflare Worker when it is configured, and from the same knowledge
 * base here when it is not. Never described as an AI or a chatbot — it is the help desk, and a person is always one
 * click away.
 */
export function HelpChat() {
  const route = useRouterState({ select: (s) => s.location.href });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([HELLO]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, open, busy]);

  // The button lives at the page's end now, so closing the drawer brings it back into view instead of leaving the reader
  // with nothing to reopen. Only after the desk has been opened once, or landing on a page would jump to its foot.
  const trigger = useRef<HTMLDivElement>(null);
  const openedBefore = useRef(false);
  useEffect(() => {
    if (open) {
      openedBefore.current = true;
      return;
    }
    if (openedBefore.current) trigger.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const path = (route || "").split("?")[0] ?? "";
  if (HIDDEN.some((r) => r.test(path))) return null;

  async function ask(e?: FormEvent, question = text) {
    e?.preventDefault();
    const q = question.replace(/\s+/g, " ").trim().slice(0, MAX_HELP_CHARS);
    if (!q || busy) return;
    const history = messages.slice(-6).map((m) => ({
      role: m.from === "you" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
    setMessages((m) => [...m, { from: "you", text: q }]);
    setText("");
    setBusy(true);
    try {
      const reply = await askHelpDesk({ message: q, currentRoute: route, history });
      setMessages((m) => [
        ...m,
        {
          from: "help",
          text: reply.text,
          title: reply.title,
          link: reply.link,
          notice: reply.degraded ? DEGRADED[reply.degraded] : undefined,
        },
      ]);
    } catch (err) {
      // The question stays on screen and the desk answers for itself, rather than the panel sitting busy forever.
      setMessages((m) => [
        ...m,
        {
          from: "help",
          text:
            err instanceof Error
              ? err.message
              : "The help desk couldn't answer just now. Try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const rate = (i: number, rated: "yes" | "no") =>
    setMessages((m) => m.map((x, k) => (k === i ? { ...x, rated } : x)));
  const chips = quickQuestions(route);
  const actions = helpActions(route);

  if (!open)
    return (
      // At the foot of the page in the bottom-right corner, in the page's own flow rather than floating over it
      // (founder, 2026-11-28): a small chat bubble, nothing pinned to the viewport, so no paragraph, picture or dock has
      // to dodge it at any scroll position. It sits in the same column as the page's content, so its right edge lines up
      // with the page rather than the screen. Cobalt in the light theme, white with cobalt lettering in Studio Mode; the
      // name is its accessible label and its hover title, since the bubble carries no words.
      <div ref={trigger} className="mx-auto flex w-full max-w-7xl justify-end px-6 pb-8 pt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open the ${HELP_DESK_NAME}`}
          title={`Open the ${HELP_DESK_NAME}`}
          className="cta-help-desk-badge grid h-11 w-11 place-items-center rounded-full border border-[#004AAD] bg-[#004AAD] text-white shadow-sm transition hover:bg-[#003a88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D8CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white dark:bg-white dark:text-[#004AAD] dark:hover:bg-[#E5E4E2]"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );

  return (
    <section
      role="dialog"
      aria-label={HELP_DESK_NAME}
      className="fixed bottom-20 right-3 z-40 flex h-[440px] max-h-[65vh] w-[340px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl md:bottom-4 md:right-4"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 bg-ink px-3 py-1.5 text-ink-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <LifeBuoy className="h-4 w-4 shrink-0" />
          {/* Balanced so a narrow phone gets "Came Through Audio / Help Desk" rather than a lone "Desk" on line two. */}
          <span className="text-balance text-[11px] font-bold leading-tight">{HELP_DESK_NAME}</span>
        </span>
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimize the Help Desk"
            title="Minimize"
            className="cta-help-desk-control grid place-items-center rounded p-1 text-ink-foreground hover:bg-ink-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D8CFF]"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMessages([HELLO]);
              setText("");
            }}
            aria-label="Close the Help Desk"
            title="Close"
            className="cta-help-desk-control grid place-items-center rounded p-1 text-ink-foreground hover:bg-ink-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D8CFF]"
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.from === "you"
                ? "ml-6 rounded-xl bg-[#004AAD] px-3 py-2 text-white dark:bg-white dark:text-[#004AAD]"
                : "mr-2 space-y-1.5 rounded-xl bg-muted px-3 py-2"
            }
          >
            {m.title && <p className="text-[13px] font-semibold">{m.title}</p>}
            <p className="whitespace-pre-line leading-snug">{m.text}</p>
            {m.link && (
              <a
                href={m.link.to}
                className="block text-xs font-semibold text-[#004AAD] underline dark:text-[#4D8CFF]"
              >
                {m.link.label}
              </a>
            )}
            {m.notice && (
              <p className="text-[11px] leading-snug text-muted-foreground">{m.notice}</p>
            )}
            {m.from === "help" && i > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
                {m.rated === "yes" ? (
                  <span>Glad it helped.</span>
                ) : m.rated === "no" ? (
                  <span>
                    Sorry about that.{" "}
                    <a
                      href={HELP_DESK_TICKET}
                      className="font-semibold text-[#004AAD] underline dark:text-[#4D8CFF]"
                    >
                      Open a support ticket
                    </a>{" "}
                    and a person will answer.
                  </span>
                ) : (
                  <>
                    Was this helpful?
                    <button
                      type="button"
                      aria-label="Yes, helpful"
                      onClick={() => rate(i, "yes")}
                      className="rounded p-0.5 hover:bg-background"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="No, not helpful"
                      onClick={() => rate(i, "no")}
                      className="rounded p-0.5 hover:bg-background"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="mr-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            Looking that up…
          </p>
        )}
        <div ref={end} />
      </div>

      {messages.length <= 1 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-3 pb-1.5">
          {chips.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void ask(undefined, q)}
              className="cta-help-desk-chip rounded-full border border-[#004AAD]/40 px-2.5 py-1 text-left text-[11px] font-semibold leading-tight text-[#004AAD] transition hover:border-[#004AAD] hover:bg-[#004AAD]/5 dark:border-[#4D8CFF]/60 dark:text-white dark:hover:border-[#4D8CFF] dark:hover:bg-white/10"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border px-3 py-2">
        {actions.map((a) => (
          <a
            key={a.label}
            href={a.to}
            className="rounded-full bg-[#004AAD] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#003a88] dark:bg-white dark:text-[#004AAD] dark:hover:bg-[#E5E4E2]"
          >
            {a.label}
          </a>
        ))}
      </div>

      <form onSubmit={ask} className="flex shrink-0 gap-2 border-t border-border p-2.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_HELP_CHARS}
          placeholder="Ask the Help Desk"
          aria-label="Your question"
          className="h-9 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!text.trim() || busy}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="shrink-0 px-3 pb-2 text-[10px] leading-tight text-muted-foreground">
        Answers come from our help center. General information, not legal or financial advice.
      </p>
    </section>
  );
}
