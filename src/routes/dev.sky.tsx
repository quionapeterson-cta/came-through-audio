import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StarSky } from "@/components/StarSky";

/**
 * Local timing lab, not part of the product: open /dev/sky to run either sky exactly as the app renders it, so the
 * founder can judge the launch and the shooting stars without finishing a checklist or signing an agreement.
 */
export const Route = createFileRoute("/dev/sky")({ component: SkyLab });

function SkyLab() {
  const [sky, setSky] = useState<"defaults" | "contract" | null>(null);
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Sky lab</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Local only. Each button renders the real <code>StarSky</code> component with the copy the app uses. Escape, a click
        or the button closes it; the eight-second timer does too.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => setSky("defaults")} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Defaults sky (rocket)
        </button>
        <button type="button" onClick={() => setSky("contract")} className="rounded-md border border-border px-4 py-2 text-sm font-semibold">
          Contract sky (rocket, signers)
        </button>
      </div>
      {sky === "defaults" && (
        <StarSky rocket message="Embed defaults + Catalog Defaults 100%" sub="Both of your defaults are set, so every master you embed and every song you catalog starts finished." onDone={() => setSky(null)} />
      )}
      {sky === "contract" && (
        <StarSky rocket names={["Karma Came", "Cardi B", "Nicki Minaj"]} message="Karma Came X Cardi B X Nicki Minaj" sub="It's a done deal! Every party has signed. The agreement is locked, and the signed copy is ready to download." onDone={() => setSky(null)} />
      )}
    </div>
  );
}
