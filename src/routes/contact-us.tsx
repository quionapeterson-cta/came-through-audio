import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitTicket, ticketSchema } from "@/lib/support.functions";
import { GENERAL_AREA, GENERAL_INQUIRIES, generalInquiryCategory, generalInquirySubject } from "@/lib/support-topics";
import { BUSINESS_ADDRESS, SUPPORT_EMAIL } from "@/lib/email-layout";

/**
 * General inquiries, on their own page (founder, 2026-11-10). The ticket form used to share `/contact` with this, so a
 * question that wasn't a bug looked like a broken-feature report. Support now keeps `/contact` for tickets and the Help
 * Center, and this page is reached from the homepage's Contact us link, so nobody sends a catalog problem here.
 *
 * It is still a contact ticket in the database (`kind: "contact"`, the topic stored under `GENERAL_AREA`), so it lands
 * in the same Admin → Support Tickets queue, labelled Contact.
 */
export const Route = createFileRoute("/contact-us")({
  head: () => ({
    meta: [
      { title: "Contact Us — Came Through Audio" },
      { name: "description", content: "General inquiries for Came Through Audio: questions before you sign up, press, partnerships and licensing, feedback or a feature request." },
      { property: "og:title", content: "Contact Us — Came Through Audio" },
      { property: "og:description", content: "Questions before you sign up, press, partnerships or licensing, feedback — reach the Came Through Audio team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactUsPage,
});

function ContactUsPage() {
  const send = useServerFn(submitTicket);
  const [form, setForm] = useState({ name: "", email: "", topic: GENERAL_INQUIRIES[0] as string, message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure("");
    const parsed = ticketSchema.safeParse({
      name: form.name,
      email: form.email,
      message: form.message,
      website: form.website,
      area: GENERAL_AREA,
      issue: form.topic,
      category: generalInquiryCategory(form.topic),
      subject: generalInquirySubject(form.topic),
      kind: "contact",
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await send({ data: parsed.data });
      setDone(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <div className="flex items-center gap-5 text-sm font-semibold">
            <Link to="/contact" className="text-ink-muted hover:text-primary">Help Center</Link>
            <Link to="/" className="text-ink-muted hover:text-primary">Home</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[3px] text-primary">General inquiries</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Contact Us</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          A question before you sign up, press, partnerships or licensing, feedback, or anything that isn't a problem
          inside your catalog. This reaches the support team too — it sits in the same queue in Admin as a ticket,
          marked as a contact — and we reply by email.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Something in your catalog isn't working?{" "}
          <Link to="/contact" className="font-semibold text-primary underline">Open a support ticket</Link>{" "}
          instead, so we can look at your account.
        </p>

        {done ? (
          <div className="mt-10 rounded-2xl border-2 border-primary p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-xl font-bold">Message received</p>
            <p className="mt-2 text-muted-foreground">
              Thanks, {form.name.split(" ")[0] || "there"}. Our team will reply to {form.email}. Most replies go out in
              about 48 hours, and a busy week or a holiday break can take longer.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/">Back to home</Link></Button>
              <Button asChild variant="outline"><Link to="/contact">Browse the Help Center</Link></Button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8" noValidate>
              <Field label="Name" error={errors["name"]}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} autoComplete="name" />
              </Field>
              <Field label="Email" error={errors["email"]}>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={255} autoComplete="email" placeholder="you@example.com" />
              </Field>
              <Field label="What's this about?" error={errors["issue"]}>
                <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  {GENERAL_INQUIRIES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Message" error={errors["message"]}>
                <Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={3000}
                  placeholder="Tell us what's on your mind — a sentence is enough to start." />
              </Field>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden"
                value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              {failure && <p className="text-sm text-destructive">{failure}</p>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send Message"}</Button>
              <p className="text-center text-xs text-muted-foreground">
                For payments, use <span className="font-semibold">Account &amp; billing</span> on a support ticket so
                Billing sees it. This form never asks for a card number.
              </p>
            </form>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-6 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" /> Prefer your own inbox?
              </p>
              <a className="font-semibold text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
          </>
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
