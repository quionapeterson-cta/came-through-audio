import { Link } from "@tanstack/react-router";
import { Disclaimer } from "@/components/Disclaimer";
import { BrandLogo } from "@/components/BrandLogo";
import type { ReactNode } from "react";
import { INTRO_KEY, lastUpdated, renderLegalText, type LegalDocId, type LegalOverrides } from "@/lib/legal-overrides";

export type LegalSection = { heading: string; body: ReactNode };
export type LegalDoc = { doc: LegalDocId; title: string; updated: string; intro?: ReactNode; sections: LegalSection[] };

/** A legal page. Sections edited in Admin → Legal (`overrides`) show their new wording in place of the built-in text. */
export function LegalPage({ title, updated, intro, sections, overrides = {} }: LegalDoc & { overrides?: LegalOverrides }) {
  const introBody = overrides[INTRO_KEY] ? renderLegalText(overrides[INTRO_KEY].body) : intro;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <BrandLogo />
          <nav className="flex gap-4 text-sm text-ink-muted">
            <Link to="/terms-of-service" className="hover:text-ink-foreground">Terms</Link>
            <Link to="/refund-policy" className="hover:text-ink-foreground">Refunds</Link>
            <Link to="/privacy-policy" className="hover:text-ink-foreground">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated(updated, overrides)}</p>
        {introBody && <div className="mt-8 space-y-4 leading-relaxed">{introBody}</div>}
        <div className="mt-10 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-3 text-xl font-bold">{s.heading}</h2>
              <div className="space-y-3 leading-relaxed text-muted-foreground">{overrides[s.heading] ? renderLegalText(overrides[s.heading]!.body) : s.body}</div>
            </section>
          ))}
        </div>
        <Disclaimer k="site" className="mt-12 border-t border-border pt-6" />
      </main>
    </div>
  );
}
