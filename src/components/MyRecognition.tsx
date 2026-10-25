import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { myRecognition } from "@/lib/recognition.functions";
import type { StaffBadgeState } from "@/lib/staff-badges";

const ORDER = ["Department", "Welcome", "Tenure"];

/**
 * Admin → My Recognition (Phase 4 item 6): your staff badges, earned from your own records. Thanks, not pay. Customers
 * never see these. Badges waiting on systems not built yet (training, kudos, ratings, scorecards) show as Coming later.
 */
export function MyRecognition() {
  const fetch = useServerFn(myRecognition);
  const q = useQuery({ queryKey: ["my-recognition"], queryFn: () => fetch() });
  if (q.isLoading) return <p className="mt-6 text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="mt-6 text-destructive">Couldn't load your badges.</p>;
  const all = q.data ?? [];
  const now = all.filter((b) => !b.later);
  const earned = now.filter((b) => b.earned).length;
  return (
    <div className="mt-4 space-y-8">
      <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">You came through for the team: {earned} badge{earned === 1 ? "" : "s"} so far.</span> Staff badges come from your real work (tasks you complete, time on the team), never from hours. Customers never see them.</p>
      {ORDER.map((c) => {
        const list = now.filter((b) => b.collection === c);
        if (!list.length) return null;
        return (
          <section key={c}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">{c} <span className="opacity-70">{list.filter((b) => b.earned).length} of {list.length}</span></h3>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{list.map((b) => <Badge key={b.id} b={b} />)}</ul>
          </section>
        );
      })}
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Coming later ({all.filter((b) => b.later).length})</summary>
        <p className="mt-2 text-xs text-muted-foreground">These turn on with training quizzes, peer kudos, customer ratings and scorecards.</p>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{all.filter((b) => b.later).map((b) => <Badge key={b.id} b={b} />)}</ul>
      </details>
    </div>
  );
}

function Badge({ b }: { b: StaffBadgeState }) {
  return (
    <li className="flex flex-col items-center gap-2 text-center" title={b.how}>
      <span className="relative flex aspect-square w-full items-center justify-center">
        <img src={b.src} alt="" loading="lazy" className={`h-full w-full object-contain ${b.earned ? "drop-shadow-lg" : "opacity-30 grayscale"}`} />
        {!b.earned && <Lock className="absolute h-5 w-5 text-muted-foreground" />}
        {b.times > 1 && <span className="cta-badge-count absolute right-0 top-0" aria-label={`Earned ${b.times} times`}>×{b.times}</span>}
      </span>
      <span className="text-sm font-semibold leading-tight">{b.title}</span>
      <span className="text-xs text-muted-foreground">{b.progress ?? b.how}</span>
    </li>
  );
}
