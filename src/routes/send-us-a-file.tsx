import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, FileUp, Lock, Mail } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getStaffRole } from "@/lib/admin.functions";
import {
  canDropInboxFiles,
  dropFilesProblem,
  INBOX_FILE_DROP_LABEL,
  INBOX_FILE_LIMIT_LABEL,
  MAX_DROP_FILES,
  sizeLabel,
} from "@/lib/inbox-attachments";
import { ADMIN_EMAIL } from "@/lib/email-layout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Send us a file (founder, 2026-11-17): the page for what email cannot carry — a master, a scanned contract, a shoot
 * that the contact's own mail server would bounce.
 *
 * It is not public (founder, 2026-11-17). This is B2B correspondence: a super admin or a department lead opens it and
 * files a business contact's document under that contact's thread in the Admin Inbox, entering the contact's own details
 * so the reply goes to them. A staff login is required, and the receiver checks the same roles before it stores a byte.
 */
export const Route = createFileRoute("/send-us-a-file")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Send us a file — Came Through Audio" },
      {
        name: "description",
        content: `Internal: file a business contact's document up to ${INBOX_FILE_LIMIT_LABEL} each against their conversation in the Admin Inbox.`,
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Send us a file — Came Through Audio" },
      {
        property: "og:description",
        content: "Internal B2B correspondence for the Came Through Audio team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SendFilePage,
});

function SendFilePage() {
  const { user, loading } = useAuth();
  const role = useQuery({
    queryKey: ["staff-role", user?.id],
    queryFn: () => getStaffRole(),
    enabled: !!user,
  });

  let body: React.ReactNode;
  if (loading || (user && role.isLoading)) {
    body = <Gate title="Checking access…" body="One moment while we confirm your staff login." />;
  } else if (!user) {
    body = (
      <Gate
        title="Staff sign-in needed"
        body="Send us a file is part of business correspondence, so it opens with the work email your invite was sent to."
      >
        <Button asChild>
          <Link to="/login">Log in</Link>
        </Button>
        <Link to="/" className="text-sm font-semibold text-primary">
          Back to the site
        </Link>
      </Gate>
    );
  } else if (role.isError) {
    // A lookup that failed is not a refusal (founder, 2026-11-17): a super admin whose role couldn't be read is told the
    // check failed, so "Super admins and leads only" never stands in for a database that didn't answer.
    body = (
      <Gate
        title="Couldn't check your access"
        body="We couldn't confirm which staff role your account holds, so the form stayed closed. Nothing was sent. This is a check that failed, not a refusal."
      >
        <Button onClick={() => void role.refetch()} disabled={role.isFetching}>
          {role.isFetching ? "Checking…" : "Try again"}
        </Button>
        <Link to="/workspace" className="text-sm font-semibold text-primary">
          Back to workspace
        </Link>
      </Gate>
    );
  } else if (!canDropInboxFiles(role.data)) {
    body = (
      <Gate
        title="Super admins and leads only"
        body={`Business correspondence filed from here goes into the Admin Inbox, so only a ${INBOX_FILE_DROP_LABEL} can send one. Ask a super admin if you need access.`}
      >
        <Button asChild>
          <Link to="/workspace">Back to workspace</Link>
        </Button>
      </Gate>
    );
  } else {
    body = <DropForm />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <div className="flex items-center gap-5 text-sm font-semibold">
            <Link to="/admin" className="text-ink-muted hover:text-primary">
              Admin
            </Link>
            <Link to="/workspace" className="text-ink-muted hover:text-primary">
              Workspace
            </Link>
            <Link to="/" className="text-ink-muted hover:text-primary">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">{body}</main>
    </div>
  );
}

/** A plain card for the three states before the form: checking, signed out, or not the right staff role. */
function Gate({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <Lock className="mx-auto h-8 w-8 text-primary" />
      <p className="mt-3 text-xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">{body}</p>
      {children ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}

function DropForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", note: "", website: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState("");

  function pick(next: FileList | null) {
    setFailure("");
    const list = Array.from(next ?? []);
    const problem = dropFilesProblem(list.map((f) => ({ name: f.name, size: f.size })));
    // Refused here as well as on the server, so a 300 MB video isn't uploaded only to be turned away at the end.
    if (problem) {
      setFiles([]);
      setFailure(problem);
      return;
    }
    setFiles(list);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure("");
    if (!form.name.trim()) return setFailure("Name the contact this is from.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      return setFailure("Use the contact's email address, so the reply reaches them.");
    if (form.subject.trim().length < 3) return setFailure("Say what they sent.");
    if (!files.length) return setFailure("Choose at least one file.");

    setBusy(true);
    try {
      // The receiver is staff-only, so the browser sends the signed-in session with the bytes.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setFailure("Your session ended. Sign in again and send it.");
        return;
      }

      const body = new FormData();
      body.set("name", form.name.trim());
      body.set("email", form.email.trim());
      body.set("subject", form.subject.trim());
      body.set("note", form.note.trim());
      body.set("website", form.website);
      for (const file of files) body.append("files", file);

      const res = await fetch("/api/inbox/file", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const answer = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !answer?.ok) {
        setFailure(answer?.error ?? "That didn't go through. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setFailure("That didn't go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-primary p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-3 text-xl font-bold">File received</p>
        <p className="mt-2 text-muted-foreground">
          It's in the Admin Inbox with the message, and the reply goes to {form.email.trim()}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/admin">Open Admin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/workspace">Back to workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[3px] text-primary">
        Business correspondence
      </p>
      <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Send us a file</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        File a business contact's document against their conversation in the Admin Inbox — a master,
        a scanned agreement, a shoot their own mail server would bounce. Their name and email are
        what the thread and the reply use. Up to {MAX_DROP_FILES} files of {INBOX_FILE_LIMIT_LABEL}{" "}
        each.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact's name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={120}
              autoComplete="off"
            />
          </Field>
          <Field label="Contact's email (the reply goes here)">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={320}
              autoComplete="off"
              placeholder="they@company.com"
            />
          </Field>
        </div>
        <Field label="What did they send?">
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            maxLength={200}
            placeholder="Signed producer agreement, master for 'Song Title'…"
          />
        </Field>
        <Field label="Anything we should know?">
          <Textarea
            rows={4}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={4000}
            placeholder="A sentence is enough — what it is and what they need from us."
          />
        </Field>

        <div className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="drop-files">
            Files
          </label>
          <input
            id="drop-files"
            type="file"
            multiple
            onChange={(e) => pick(e.target.files)}
            className="block w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Up to {MAX_DROP_FILES} files, {INBOX_FILE_LIMIT_LABEL} each. Anything larger goes as a
            download link instead, because no mail server will carry it.
          </p>
          {files.length ? (
            <ul className="mt-2 space-y-1 rounded-lg border border-border bg-muted/40 p-2.5">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex flex-wrap items-baseline gap-2 text-sm"
                >
                  <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{sizeLabel(file.size)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
        {failure ? <p className="text-sm text-destructive">{failure}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Sending…" : "Send the file"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Only our team can open what you send. We never share a file you give us without asking.
        </p>
      </form>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4 text-primary" /> Small enough for email?
        </p>
        <a className="font-semibold text-primary underline" href={`mailto:${ADMIN_EMAIL}`}>
          {ADMIN_EMAIL}
        </a>
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">Came Through Audio, LLC</p>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
