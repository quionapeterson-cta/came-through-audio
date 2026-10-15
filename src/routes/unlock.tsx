import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { unlockSite } from "@/lib/gate.functions";

export const Route = createFileRoute("/unlock")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Private Preview · Came Through Audio" },
      { name: "description", content: "Came Through Audio is in private preview. Enter the staging passcode to continue." },
      { property: "og:title", content: "Private Preview · Came Through Audio" },
      { property: "og:description", content: "Came Through Audio is in private preview." },
    ],
  }),
  component: Unlock,
});

function Unlock() {
  const { next } = Route.useSearch();
  const unlock = useServerFn(unlockSite);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const password = new FormData(e.currentTarget).get("password") as string;
    const { ok } = await unlock({ data: { password } });
    setBusy(false);
    if (ok) {
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(dest);
    } else setError(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-primary/30 bg-card p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold">
          <span className="text-foreground">Came Through </span>
          <span className="text-primary">Audio</span>
        </h1>
        <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground">
          Your first stop before distribution
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          We're in private preview. Enter the passcode to continue.
        </p>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          aria-label="Passcode"
          className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="mt-2 text-sm text-destructive">That passcode isn't right. Try again.</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
