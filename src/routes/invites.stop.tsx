import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MailX } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { stopInvites } from "@/lib/splits-email.functions";

export const Route = createFileRoute("/invites/stop")({
  head: () => ({ meta: [{ title: "Stop Invite Emails — Came Through Audio" }, { name: "description", content: "Stop split-sheet invite emails from Came Through Audio." }] }),
  validateSearch: (s: Record<string, unknown>) => ({ e: typeof s["e"] === "string" ? s["e"] : "", t: typeof s["t"] === "string" ? s["t"] : "" }),
  component: StopInvites,
});

/** Opens from an invite's footer. Asks for a click first, so email link scanners can't opt someone out by opening the link. */
function StopInvites() {
  const { e, t } = Route.useSearch();
  const stop = useServerFn(stopInvites);
  const [state, setState] = useState<"ask" | "busy" | "done" | "error">("ask");
  const [error, setError] = useState("");

  async function confirm() {
    setState("busy");
    try {
      await stop({ data: { email: e, token: t } });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto max-w-7xl px-6 py-4"><BrandLogo /></header>
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        <div className="w-full rounded-2xl bg-background p-8 text-center text-foreground shadow-2xl">
          <MailX className="mx-auto h-14 w-14 text-primary" />
          {state === "done" ? (
            <>
              <h1 className="mt-4 text-2xl font-bold">You won't get more invites</h1>
              <p className="mt-2 text-muted-foreground">We'll stop sending split-sheet invites to <b>{e}</b>. Anyone who tries will be asked to contact you directly.</p>
              <p className="mt-4 text-sm text-muted-foreground">Changed your mind? Email support@camethroughaudio.com.</p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-bold">Stop invite emails?</h1>
              <p className="mt-2 text-muted-foreground">Came Through Audio members won't be able to email split-sheet invites to <b>{e || "this address"}</b>.</p>
              {state === "error" && <p className="mt-4 text-sm text-destructive">{error}</p>}
              <Button onClick={confirm} disabled={state === "busy" || !e || !t} className="mt-6 h-12 w-full text-base font-semibold">
                {state === "busy" ? "Please wait…" : "Don't send me invites"}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
