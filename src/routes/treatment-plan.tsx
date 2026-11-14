import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { TreatmentPlan } from "@/components/TreatmentPlan";
import { loadTreatmentPlan, type TreatmentPlanData } from "@/lib/treatment-plan";

/**
 * The Interactive Treatment Plan (standalone, /treatment-plan). It reads the treatment recommendations the Royalty
 * Health Report already produced; the report page, its engine and its results are untouched.
 */
export const Route = createFileRoute("/treatment-plan")({
  head: () => ({
    meta: [
      { title: "Interactive Treatment Plan — Came Through Audio" },
      { name: "description", content: "Your Royalty Health Report's treatment plan, grouped by organ system and priority." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TreatmentPlanPage,
});

function TreatmentPlanPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<TreatmentPlanData>();
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setFailure("");
    loadTreatmentPlan(user.id)
      .then((plan) => { if (alive) setData(plan); })
      .catch((e: unknown) => { if (alive) setFailure(e instanceof Error ? e.message : "Couldn't load your treatment plan."); });
    return () => { alive = false; };
  }, [user, attempt]);

  if (loading) return <Shell><p className="tp-muted py-20 text-center">Loading your treatment plan…</p></Shell>;

  if (!user) {
    return (
      <Shell>
        <div className="tp-glass mx-auto max-w-xl rounded-3xl p-8 text-center">
          <p className="tp-eyebrow">Interactive treatment plan</p>
          <h1 className="mt-2 text-3xl font-extrabold">Sign in to open your plan</h1>
          <p className="tp-muted mt-2 text-sm">Your treatment plan is built from your own Royalty Health Report.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/login" className="tp-cta">Sign in</Link>
            <Link to="/" className="tp-reset">Back to home</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (failure) {
    return (
      <Shell>
        <div className="tp-glass mx-auto max-w-xl rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold">We couldn&apos;t load your treatment plan</h1>
          <p className="tp-muted mt-2 text-sm">{failure}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" className="tp-cta" onClick={() => { setData(undefined); setAttempt((n) => n + 1); }}>Try again</button>
            <a href="/workspace?tab=health" className="tp-reset">Back to my report</a>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) return <Shell><p className="tp-muted py-20 text-center">Reading your report…</p></Shell>;

  if (data.checkup.songs === 0) {
    return (
      <Shell>
        <div className="tp-glass mx-auto max-w-xl rounded-3xl p-8 text-center">
          <p className="tp-eyebrow">Interactive treatment plan</p>
          <h1 className="mt-2 text-3xl font-extrabold">Your plan starts with a checkup</h1>
          <p className="tp-muted mt-2 text-sm leading-relaxed">
            There are no songs in this report yet, so there are no treatments to show. Run a Royalty Health Check and your
            plan fills itself in from the report it produces.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <a href="/workspace?tab=health" className="tp-cta">Run a Royalty Health Check</a>
            <Link to="/" className="tp-reset">Back to home</Link>
          </div>
        </div>
      </Shell>
    );
  }

  return <TreatmentPlan data={data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="tp rr min-h-screen">
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
