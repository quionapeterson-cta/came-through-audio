import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LifeBuoy, MessageCircleQuestion, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchHelp, type HelpAnswer } from "@/lib/help-search";

type Message = { from: "you" | "help"; text: string; answer?: HelpAnswer | undefined; related?: HelpAnswer[]; rated?: "yes" | "no" };

const HIDDEN = [/^\/admin/, /^\/verify\//, /^\/contract\//, /^\/sign\//, /^\/unlock/];
const TICKET = "/contact?type=support";
const HELLO: Message = { from: "help", text: "Hi! Ask me anything about Came Through Audio: plans, embedding, your catalog, registrations, split sheets, contracts or AI Protection." };

/**
 * Help chat, version 1 (Phase 4 item 4): answers from our FAQ, glossary, Help Center and guide summaries by matching
 * words, free and never made up; "Was this helpful?", and a support ticket whenever it can't answer. Bottom left so it
 * never sits on top of the toasts.
 */
export function HelpChat() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([HELLO]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, open]);
  if (HIDDEN.some((r) => r.test(path))) return null;

  function ask(e?: FormEvent, question = text) {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    const [best, ...related] = searchHelp(q);
    setMessages((m) => [...m, { from: "you", text: q }, best
      ? { from: "help", text: best.text, answer: best, related }
      : { from: "help", text: "I couldn't find an answer to that one. Open a support ticket and our team will answer you by email." }]);
    setText("");
  }
  const rate = (i: number, rated: "yes" | "no") => setMessages((m) => m.map((x, k) => (k === i ? { ...x, rated } : x)));

  if (!open) return (
    // A small round chat button at the bottom right (founder, 2026-10-27).
    <button type="button" onClick={() => setOpen(true)} aria-label="Open help chat" title="Help"
      className="fixed bottom-4 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <MessageCircleQuestion className="h-6 w-6" />
    </button>
  );

  return (
    <section role="dialog" aria-label="Help chat" className="fixed bottom-4 right-4 z-40 flex max-h-[min(36rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
      <header className="flex items-center justify-between bg-ink px-4 py-3 text-ink-foreground">
        <span className="flex items-center gap-2 font-bold"><LifeBuoy className="h-5 w-5" />Help</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close help chat" className="rounded p-1 hover:bg-ink-border"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.from === "you" ? "ml-8 rounded-xl bg-primary px-3 py-2 text-primary-foreground" : "mr-4 space-y-2 rounded-xl bg-muted px-3 py-2"}>
            {m.answer && <p className="font-semibold">{m.answer.title}</p>}
            <p className="whitespace-pre-line">{m.text}</p>
            {m.answer?.link && <a href={m.answer.link.to} className="block font-semibold text-primary underline">{m.answer.link.label}</a>}
            {m.related && m.related.length > 0 && <div className="space-y-1 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">Related:</p>
              {m.related.map((r) => <button key={r.id} type="button" onClick={() => ask(undefined, r.title)} className="block text-left text-xs font-semibold text-primary hover:underline">{r.title}</button>)}
            </div>}
            {m.from === "help" && i > 0 && (m.answer
              ? <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
                  {m.rated === "yes" ? <span>Glad it helped.</span>
                    : m.rated === "no" ? <span>Sorry about that. <a href={TICKET} className="font-semibold text-primary underline">Open a support ticket</a> and a person will answer.</span>
                    : <>Was this helpful?
                      <button type="button" aria-label="Yes, helpful" onClick={() => rate(i, "yes")} className="rounded p-1 hover:bg-background"><ThumbsUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="No, not helpful" onClick={() => rate(i, "no")} className="rounded p-1 hover:bg-background"><ThumbsDown className="h-4 w-4" /></button></>}
                </div>
              : <a href={TICKET} className="inline-block font-semibold text-primary underline">Open a support ticket</a>)}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={ask} className="flex gap-2 border-t border-border p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Type your question" aria-label="Your question" autoFocus />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </form>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">Answers come from our FAQ and guides. General information, not legal or financial advice.</p>
    </section>
  );
}
