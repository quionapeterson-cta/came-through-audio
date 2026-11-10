import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportTicket, submitTicket, ticketSchema } from "@/lib/support.functions";
import { categoryFor, TICKET_TOPICS } from "@/lib/support-topics";
import { useAuth } from "@/hooks/useAuth";
import { SignupCard } from "@/components/SignupCard";
import { BUSINESS_ADDRESS, SUPPORT_EMAIL } from "@/lib/email-layout";

type Search = { type?: "contact" | "support" | undefined };

export const Route = createFileRoute("/contact")({
  validateSearch: (s: Record<string, unknown>): Search => ({ type: s["type"] === "support" ? "support" : s["type"] === "contact" ? "contact" : undefined }),
  head: () => ({
    meta: [
      { title: "Contact Us & Support — Came Through Audio" },
      { name: "description", content: "Send a message or open a support ticket with the Came Through Audio team." },
      { property: "og:title", content: "Contact Us & Support — Came Through Audio" },
      { property: "og:description", content: "Questions about your catalog, splits, royalties or billing? Reach the Came Through Audio team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { type } = Route.useSearch();
  const send = useServerFn(submitTicket);
  const sendSupport = useServerFn(submitSupportTicket);
  const { user, loading } = useAuth();
  const [kind, setKind] = useState<"contact" | "support">(type ?? "contact");
  useEffect(() => { if (type) setKind(type); }, [type]);
  // Support tickets need an account (founder, 2026-10-27); Contact Us stays open to everyone.
  const needsLogin = kind === "support" && !loading && !user;
  const [form, setForm] = useState<{ name: string; email: string; area: string; issue: string; subject: string; message: string; website: string }>({
    name: "", email: "", area: TICKET_TOPICS[0].area, issue: TICKET_TOPICS[0].issues[0], subject: "", message: "", website: "",
  });
  const issues = TICKET_TOPICS.find((t) => t.area === form.area)?.issues ?? [];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  // The issue list follows the area, and a new area starts on its first issue so the pair is always valid.
  const pickArea = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const area = e.target.value;
    setForm({ ...form, area, issue: TICKET_TOPICS.find((t) => t.area === area)?.issues[0] ?? "" });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure("");
    const parsed = ticketSchema.safeParse({ ...form, category: categoryFor(form.area, form.issue), kind, email: kind === "support" ? user?.email ?? "" : form.email });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (kind === "support") { const { email: _e, ...rest } = parsed.data; await sendSupport({ data: rest }); }
      else await send({ data: parsed.data });
      setDone(true);
    }
    catch (err) { setFailure(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  const tabs = (
    <div className="flex gap-2 rounded-lg bg-muted p-1">
      {(["contact", "support"] as const).map((k) => (
        <button type="button" key={k} onClick={() => setKind(k)}
          className={`flex-1 rounded-md py-2 text-sm font-semibold ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {k === "contact" ? "Contact Us" : "Support Ticket"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><BrandLogo /><Link to="/" className="text-sm font-semibold text-ink-muted hover:text-primary">Home</Link></div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-4xl font-bold">{kind === "support" ? "Open a Support Ticket" : "Contact Us"}</h1>
        <p className="mt-3 text-muted-foreground">We usually reply by email. You can also write to <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

        {done ? (
          <div className="mt-10 rounded-2xl border-2 border-primary p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-xl font-bold">Message received</p>
            <p className="mt-2 text-muted-foreground">Thanks, {form.name.split(" ")[0]}. Our team will reply to {kind === "support" ? user?.email : form.email}.</p>
            <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
          </div>
        ) : needsLogin ? (
          <div className="mt-8 space-y-5">
            {tabs}
            <p className="text-sm text-muted-foreground">Log in or create a free account to open a support ticket, so we can look at your account and reply to the right email. Questions before signing up? Use Contact Us.</p>
            <SignupCard returnPath="/contact?type=support" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {tabs}
            <Field label="Name" error={errors["name"]}><Input value={form.name} onChange={set("name")} maxLength={100} /></Field>
            {kind === "support"
              ? <p className="text-sm text-muted-foreground">{user?.email
                  ? <>We'll reply to your account email, <span className="font-semibold text-foreground">{user.email}</span>.</>
                  : "We'll reply to the email on your account."}</p>
              : <Field label="Email" error={errors["email"]}><Input type="email" value={form.email} onChange={set("email")} maxLength={255} /></Field>}
            <Field label="Where is it?" error={errors["category"]}>
              <select value={form.area} onChange={pickArea} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TICKET_TOPICS.map((t) => <option key={t.area}>{t.area}</option>)}
              </select>
            </Field>
            <Field label="What's happening?" error={errors["issue"]}>
              <select value={form.issue} onChange={set("issue")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {issues.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Subject" error={errors["subject"]}><Input value={form.subject} onChange={set("subject")} maxLength={150} /></Field>
            <Field label="Message" error={errors["message"]}><Textarea rows={6} value={form.message} onChange={set("message")} maxLength={3000} /></Field>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={set("website")} />
            {failure && <p className="text-sm text-destructive">{failure}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : kind === "support" ? "Submit Ticket" : "Send Message"}</Button>
          </form>
        )}
        <p className="mt-12 text-center text-xs text-muted-foreground">Came Through Audio, LLC · {BUSINESS_ADDRESS}</p>
      </main>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="block text-sm text-destructive">{error}</span>}
    </label>
  );
}
