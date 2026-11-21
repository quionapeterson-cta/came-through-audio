import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ShieldCheck } from "lucide-react";
import { ArtDefs, OrganIcon } from "@/components/royalty-art";
import { catalogHref } from "@/lib/catalog-links";
import { STATE_LABEL, type OrganId } from "@/lib/royalty-checkup";
import {
  PLAN_PHASES,
  PRIORITY_LABEL,
  PRIORITY_PHASE,
  buildTreatmentPlan,
  phaseLabel,
  priorityOf,
  projectState,
  type PlanCard,
  type PlanPhase,
  type TreatmentPlanData,
} from "@/lib/treatment-plan";

/** The existing Expert Help tab (Royalties and Registrations → Expert Help): the one place every done-for-you CTA leads. */
export const EXPERTS_HREF = "/workspace?tab=health&view=expert";

/** My Catalog itself, for a treatment with no single song to point at. */
export const CATALOG_HREF = "/workspace?tab=catalog";

/**
 * "Fix in Catalog" always opens the **first song listed under "Songs in this finding"**, with the field the treatment
 * names lit — through `catalogHref`, so the address spells its parameters exactly the way the workspace and the catalog
 * form already read them. A card with no song at all opens My Catalog itself.
 */
function catalogFixHref(card: PlanCard): string {
  const first = card.songs[0];
  if (!first) return CATALOG_HREF;
  const action = card.steps
    .map((s) => s.action)
    .find((a) => a?.kind === "field" && a.trackId === first.id);
  const field = first.field ?? (action && action.kind === "field" ? action.field : undefined);
  return field
    ? catalogHref({ trackId: first.id, field })
    : `/workspace?tab=catalog&songId=${first.id}#song-${first.id}`;
}

/**
 * The Interactive Treatment Plan: the Royalty Health Report's own organs and treatment steps, regrouped by organ system
 * and priority, with a progress simulator. It never edits the report or the catalog, and every done-for-you button opens
 * the existing Expert Help tab rather than a second intake.
 */
export function TreatmentPlan({ data }: { data: TreatmentPlanData }) {
  const plan = useMemo(() => buildTreatmentPlan(data.checkup), [data.checkup]);
  const [selected, setSelected] = useState<OrganId | "all">("all");
  const [phase, setPhase] = useState<PlanPhase>("current");
  const [openCard, setOpenCard] = useState<string>();
  const [draw, setDraw] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // The vertical path draws itself as the treatments scroll past.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    const update = () => {
      if (reduce) {
        setDraw(1);
        return;
      }
      const rect = el.getBoundingClientRect();
      const span = rect.height || 1;
      const seen = window.innerHeight * 0.8 - rect.top;
      setDraw(Math.max(0, Math.min(1, seen / span)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [selected, phase]);

  const shown =
    selected === "all"
      ? plan.groups
      : plan.groups
          .map((g) => ({ ...g, systems: g.systems.filter((s) => s.id === selected) }))
          .filter((g) => g.systems.length > 0);
  const selectedName =
    selected === "all"
      ? "your whole catalog"
      : (plan.systems.find((s) => s.id === selected)?.name ?? "your catalog");
  const reportLink = "/workspace?tab=health";

  return (
    <div className="tp rr min-h-screen">
      <ArtDefs />

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <a
            href={reportLink}
            className="tp-muted inline-flex items-center gap-2 text-sm font-semibold hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to my Royalty Health Report
          </a>
          <span className="tp-eyebrow">Came Through Audio</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-32 pt-10 sm:px-8">
        <section className="tp-glass rounded-3xl p-6 sm:p-9">
          <p className="tp-eyebrow">Interactive treatment plan</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your report, turned into a plan you can work.
          </h1>
          <p className="tp-muted mt-3 max-w-[68ch] text-base leading-relaxed">
            Every organ and treatment below comes straight from your Royalty Health Report
            {data.date ? ` of ${data.date}` : ""}
            {data.scope ? ` · ${data.scope}` : ""}. Nothing here changes the report or your catalog.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 font-semibold">
              {data.source === "saved"
                ? "From your saved report"
                : data.source === "handoff"
                  ? "From the report you just read"
                  : "Read live from your catalog"}
            </span>
            {data.country && <span className="tp-muted">{data.country}</span>}
            <span className="tp-muted">
              {plan.priorityCount} priority · {plan.supportCount} needs support ·{" "}
              {plan.optimalCount} optimal
            </span>
          </div>
        </section>

        {/* Simulator */}
        <section
          aria-label="Progress simulator"
          className="mt-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="tp-eyebrow">Progress simulator</p>
            <p className="tp-muted mt-1 max-w-[52ch] text-sm">
              See the same organs as the work lands. A visualization of steady follow-through — not
              a promise of results.
            </p>
          </div>
          <div className="tp-phase" role="group" aria-label="Timeline">
            {PLAN_PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={phase === p.id}
                onClick={() => setPhase(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* The projection is conditional, so the page says so before the switch is touched (founder, 2026-11-16). */}
          <p className="tp-muted w-full text-xs">
            The 30-day and 90-day views assume the treatment plan below is followed.
          </p>
        </section>

        {/* Organ constellation */}
        <section aria-label="Your organ systems" className="tp-glass mt-4 rounded-3xl p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Your organ systems</h2>
            <button
              type="button"
              className="tp-reset"
              aria-pressed={selected === "all"}
              onClick={() => setSelected("all")}
            >
              All Systems
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {plan.systems.map((system) => {
              const projected = projectState(system.state, phase);
              const projectedPriority = priorityOf(projected);
              const caption = `${STATE_LABEL[projected]}${phase === "current" ? "" : ` ${phaseLabel(phase)}`}`;
              return (
                <button
                  key={system.id}
                  type="button"
                  className="tp-orb"
                  data-priority={projectedPriority}
                  aria-pressed={selected === system.id}
                  aria-label={`${system.name}: ${caption}. Show ${system.name} treatments.`}
                  onClick={() => setSelected((cur) => (cur === system.id ? "all" : system.id))}
                >
                  <span className="tp-orb-glow" aria-hidden="true" />
                  <span className="tp-orb-disc">
                    <OrganIcon
                      organ={{ id: system.id, broken: system.broken }}
                      className="h-10 w-10 sm:h-12 sm:w-12"
                    />
                  </span>
                  <span className="text-center">
                    <span className="block text-sm font-bold leading-tight">{system.name}</span>
                    <span className="tp-muted block text-[11px] leading-tight">{caption}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="tp-muted mt-4 text-xs">
            {phase === "current"
              ? "Pink-red rings are Priority Focus, Electric Cobalt needs support, Gold and Platinum are optimal."
              : `Projected ${phaseLabel(phase)}: rings move from pink-red and crimson toward Electric Cobalt, then Gold.`}
            {selected !== "all" ? ` Filtering to ${selectedName}.` : ""}
          </p>
        </section>

        {/* Timeline + grouped treatments */}
        <div ref={listRef} className="relative mt-10 sm:pl-10">
          <div className="tp-rail" aria-hidden="true">
            <svg viewBox="0 0 20 1000" preserveAspectRatio="none" role="presentation">
              <defs>
                <linearGradient id="tp-line" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#004AAD" />
                  <stop offset="55%" stopColor="#4D8CFF" />
                  <stop offset="100%" stopColor="#FF4D6D" />
                </linearGradient>
              </defs>
              <path
                className="tp-track"
                d="M10 0 C2 120 18 240 10 360 C2 480 18 600 10 720 C2 840 18 940 10 1000"
              />
              <path
                className="tp-progress"
                pathLength={1}
                style={{ strokeDashoffset: 1 - draw }}
                d="M10 0 C2 120 18 240 10 360 C2 480 18 600 10 720 C2 840 18 940 10 1000"
              />
            </svg>
          </div>

          {shown.length === 0 ? (
            <p className="tp-muted rounded-2xl border border-white/15 bg-white/5 p-6 text-sm">
              No treatments match that system in this report.
            </p>
          ) : (
            <div className="space-y-10">
              {shown.map((group) => (
                <section key={group.priority} aria-label={PRIORITY_LABEL[group.priority]}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tp-badge" data-priority={group.priority}>
                      {PRIORITY_LABEL[group.priority]}
                    </span>
                    <span className="tp-muted text-xs font-semibold uppercase tracking-widest">
                      {PRIORITY_PHASE[group.priority]}
                    </span>
                    {group.priority === "optimal" && phase === "90" && (
                      <span className="tp-badge" data-priority="optimal">
                        90-day milestone
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-5">
                    {group.systems.map((system) => (
                      <div key={system.id}>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-full border border-[#E5E4E2]/30 bg-white/5">
                            <OrganIcon
                              organ={{ id: system.id, broken: system.broken }}
                              className="h-7 w-7"
                            />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-lg font-extrabold leading-tight">{system.name}</h3>
                            <p className="tp-muted text-xs">{system.system}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-3">
                          {system.cards.map((card) => (
                            <TreatmentCard
                              key={card.key}
                              card={card}
                              open={openCard === card.key}
                              onToggle={() =>
                                setOpenCard((cur) => (cur === card.key ? undefined : card.key))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Done-for-you call-out: the three things that put the registrations in our hands, then the Expert Help tab. */}
        <section className="tp-glass mt-10 rounded-3xl p-6 sm:p-8">
          <p className="tp-eyebrow">Done for you</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
            You do not have to work this plan alone.
          </h2>
          <p className="tp-muted mt-2 max-w-[64ch] text-sm leading-relaxed">
            Three things put the registrations in our hands, and then we take it from there:
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              "Update your catalog with the correct information.",
              "Choose the agencies you want your songs registered with.",
              "Add Came Through Audio as your representative in those accounts.",
            ].map((step, i) => (
              <li
                key={step}
                className="rounded-xl border border-white/12 bg-white/5 p-3 text-sm leading-relaxed"
              >
                <span className="tp-step-num mb-2" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="tp-muted">{step}</span>
              </li>
            ))}
          </ol>
          <p className="tp-muted mt-3 max-w-[64ch] text-sm leading-relaxed">
            Once those are in place, we handle the registrations for you. Open Expert Help and we
            will walk you through the process.
          </p>
          <a href={EXPERTS_HREF} className="tp-cta mt-5">
            Open Expert Help — Walk Me Through It →
          </a>
        </section>
      </main>

      <div className="tp-sticky">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="tp-dot" aria-hidden="true" />
          <p className="min-w-0 text-xs leading-snug">
            <b className="block truncate text-sm">
              {plan.priorityCount} Priority Focus system{plan.priorityCount === 1 ? "" : "s"} in
              your latest report
            </b>
            <span className="tp-muted">
              Showing {selectedName} ·{" "}
              {phase === "current" ? "current state" : `projected ${phaseLabel(phase)}`}
            </span>
          </p>
        </div>
        <a href={EXPERTS_HREF} className="tp-cta w-full sm:w-auto" data-tone="priority">
          Get Expert Help — Let Us Do It For You →
        </a>
      </div>
    </div>
  );
}

function TreatmentCard({
  card,
  open,
  onToggle,
}: {
  card: PlanCard;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="tp-card" data-priority={card.priority} data-open={open ? "true" : "false"}>
      <button type="button" className="tp-card-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="tp-badge" data-priority={card.priority}>
              {PRIORITY_LABEL[card.priority]}
            </span>
            <span className="tp-muted text-[11px] font-semibold uppercase tracking-widest">
              {card.timing}
            </span>
          </span>
          <span className="mt-2 block text-base font-extrabold leading-snug">{card.dx}</span>
          <span className="tp-muted mt-1 block text-sm leading-relaxed">{card.what}</span>
        </span>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div className="tp-reveal" data-open={open ? "true" : "false"}>
        <div>
          <div className="space-y-4 px-4 pb-5 sm:px-5">
            {card.cause && (
              <p className="text-sm leading-relaxed">
                <b className="font-semibold">Cause:</b>{" "}
                <span className="tp-muted">{card.cause}</span>
              </p>
            )}

            <div className="rounded-xl border border-white/12 bg-white/5 p-4">
              <p className="tp-eyebrow" style={{ color: "#FF8FA3" }}>
                How this strengthens your {card.organName.toLowerCase()}
              </p>
              <p className="tp-muted mt-1 text-sm leading-relaxed">{card.gain}</p>
            </div>

            {card.steps.length > 0 && (
              <div>
                <p className="tp-eyebrow">Exact action steps · {card.timing}</p>
                <ol className="mt-2 space-y-2">
                  {card.steps.map((step, i) => (
                    <li key={`${card.key}-${i}-${step.title}`} className="tp-step">
                      <span className="tp-step-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="min-w-0 text-sm leading-relaxed">
                        <b className="font-semibold">{step.title}.</b>{" "}
                        <span className="tp-muted">{step.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {card.checks.length > 0 && (
              <div>
                <p className="tp-eyebrow" style={{ color: "#FFD700" }}>
                  Maintenance · what we keep an eye on
                </p>
                <ul className="mt-2 space-y-1.5">
                  {card.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm leading-relaxed">
                      <ShieldCheck
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: "#FFD700" }}
                        aria-hidden="true"
                      />
                      <span className="tp-muted">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.songs.length > 0 && (
              <div>
                <p className="tp-eyebrow">Songs in this finding · {card.songs.length}</p>
                <ul className="mt-2 space-y-1.5">
                  {card.songs.slice(0, 6).map((s) => (
                    <li key={s.id} className="text-sm leading-relaxed">
                      <b className="font-semibold">{s.title}</b>{" "}
                      <span className="tp-muted">— {s.why}</span>
                    </li>
                  ))}
                  {card.songs.length > 6 && (
                    <li className="tp-muted text-xs">
                      and {card.songs.length - 6} more in your report.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {card.note && <p className="tp-muted text-sm italic">{card.note}</p>}

            <div className="tp-actions">
              {card.priority === "priority" ? (
                <a href={EXPERTS_HREF} className="tp-cta" data-tone="priority">
                  Let Us Do It For You
                </a>
              ) : card.priority === "support" ? (
                <a href={EXPERTS_HREF} className="tp-cta">
                  Have Our Team Handle This
                </a>
              ) : (
                <a href={EXPERTS_HREF} className="tp-cta">
                  Keep It Optimal — Get Expert Help
                </a>
              )}
              <a href={catalogFixHref(card)} className="tp-fix">
                Fix in Catalog
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
