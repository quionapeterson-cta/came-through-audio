import { useEffect, useMemo, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmAction } from "@/components/ConfirmHost";
import { PRIVACY, REFUNDS, TERMS } from "@/lib/legal-docs";
import { clearLegalOverride, htmlToLegalText, INTRO_KEY, loadLegalOverrides, saveLegalOverride, type LegalDocId, type LegalOverrides } from "@/lib/legal-overrides";

const DOCS = { terms: { ...TERMS, path: "/terms-of-service" }, privacy: { ...PRIVACY, path: "/privacy-policy" }, refunds: { ...REFUNDS, path: "/refund-policy" } } as const;
const plain = (node: ReactNode) => htmlToLegalText(renderToStaticMarkup(<>{node}</>));

/**
 * Admin → Legal (super admins and Security, founder 2026-10-27): change the wording of any section of the Terms,
 * Privacy Policy or Refund Policy. Saved wording shows on the public page right away; every earlier version is kept.
 */
export function LegalEditor() {
  const [doc, setDoc] = useState<LegalDocId>("terms");
  const [overrides, setOverrides] = useState<LegalOverrides>({});
  const page = DOCS[doc];
  const reload = () => loadLegalOverrides(doc).then(setOverrides);
  useEffect(() => { void reload(); }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => [
    ...(page.intro ? [{ key: INTRO_KEY, heading: "Opening paragraph", body: page.intro }] : []),
    ...page.sections.map((s) => ({ key: s.heading, heading: s.heading, body: s.body })),
  ], [page]);
  const edited = parts.filter((p) => overrides[p.key]).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Legal pages</h2>
        <p className="text-sm text-muted-foreground">Change any section's wording. It shows on the public page as soon as you save, and every earlier version is kept. Have your attorney approve changes before saving.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(Object.keys(DOCS) as LegalDocId[]).map((d) => <Button key={d} size="sm" variant={d === doc ? "default" : "outline"} onClick={() => setDoc(d)}>{DOCS[d].title}</Button>)}
          <a href={page.path} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">View page<ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">How to write it: leave a blank line between paragraphs, start a line with "- " for a bullet, and write links as [link text](https://…) or [email](mailto:legal@camethroughaudio.com).</p>
        <p className="mt-1 text-xs text-muted-foreground">{edited ? `${edited} section${edited === 1 ? "" : "s"} changed from the original.` : "All sections show the original wording."}</p>
      </div>
      {parts.map((p) => <SectionEditor key={`${doc}-${p.key}`} doc={doc} sectionKey={p.key} heading={p.heading} original={p.body} override={overrides[p.key]} onSaved={reload} />)}
    </div>
  );
}

function SectionEditor({ doc, sectionKey, heading, original, override, onSaved }: {
  doc: LegalDocId; sectionKey: string; heading: string; original: ReactNode; override?: LegalOverrides[string] | undefined; onSaved: () => void;
}) {
  const start = override?.body ?? plain(original);
  const [text, setText] = useState(start);
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(override?.body ?? plain(original)), [override?.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = text.trim() !== start.trim();

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    try { await fn(); toast.success(done); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  }
  return (
    <details className="group rounded-xl border border-border open:border-primary/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">{heading}</span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {override ? `Edited ${new Date(override.updatedAt).toLocaleDateString()}` : "Original"}
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(16, Math.max(4, text.split("\n").length + 1))} maxLength={20000} aria-label={`Wording for ${heading}`} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !changed || !text.trim()} onClick={() => run(() => saveLegalOverride(doc, sectionKey, text), `${heading} saved.`)}>Save</Button>
          {changed && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setText(start)}>Undo changes</Button>}
          {override && <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            if (!(await confirmAction({ title: "Go back to the original wording?", text: "The edited wording is kept in the history.", action: "Use original", tone: "primary" }))) return;
            await run(() => clearLegalOverride(doc, sectionKey), `${heading} is back to the original.`);
          }}>Use original wording</Button>}
        </div>
      </div>
    </details>
  );
}
