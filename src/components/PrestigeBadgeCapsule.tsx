import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { shelfArt, useBadgeStates, type BadgeState } from "@/components/Badges";
import { badgePrefs, loadOnboarding } from "@/lib/artist-profile";
import { METRIC_UNIT, badgeTab, limitText, tabShort, tabTitle, type BadgeTab } from "@/lib/badges";
import {
  DEFAULT_PRESTIGE_STYLE,
  LIQUID_FINISHES,
  PRESTIGE_FRAMES,
  badgesToUnlock,
  ecosystemCompletion,
  frameById,
  frameTierLabel,
  frameUnlocked,
  loadPrestigeStyle,
  nextEarningAt,
  pickCapsuleBadge,
  savePrestigeStyle,
  type FrameId,
  type PrestigeFrame,
  type PrestigeStyle,
} from "@/lib/prestige-badge";
import { cn } from "@/lib/utils";

/** The rising bubbles: fixed positions and timings so every render shows the same live pour. */
const BUBBLES = [
  { left: "6%", size: 2, delay: 0, duration: 2.5, sway: 2 },
  { left: "18%", size: 3, delay: 0.6, duration: 3.1, sway: -2 },
  { left: "31%", size: 2, delay: 1.1, duration: 2.2, sway: 3 },
  { left: "44%", size: 3, delay: 0.3, duration: 2.9, sway: -3 },
  { left: "58%", size: 2, delay: 1.5, duration: 2.4, sway: 2 },
  { left: "70%", size: 3, delay: 0.9, duration: 3.3, sway: -2 },
  { left: "84%", size: 2, delay: 1.8, duration: 2.7, sway: 2 },
  { left: "93%", size: 2, delay: 0.45, duration: 3, sway: -3 },
];

const GLINTS = [
  { left: "10%", top: "-1px" },
  { left: "52%", top: "calc(100% - 3px)" },
  { left: "88%", top: "-1px" },
];

/** The disc's clamp, in px, and the label width it may never eat into. */
const DISC_PHONE = 56;
const DISC_DESKTOP = 72;
const DISC_MAX = 112;
const LABEL_MIN = 132;

const lastEarned = (s: BadgeState) =>
  Date.parse(s.earned?.log?.[s.earned.log.length - 1]?.at ?? s.earned?.earnedAt ?? "") || 0;

/**
 * The bar's own number. A badge with a real limit reads "3/5"; everything else says what is left in words, never a
 * fraction (founder, 2026-11-21) — "0 of 1" under a milestone read as a cap.
 */
const progressLabel = (s: BadgeState) => {
  const cap = limitText(s.badge, s.count);
  if (cap) return cap;
  const goal = Math.max(1, nextEarningAt(s.badge, s.count, !!s.earned));
  const unit = METRIC_UNIT[s.badge.metric];
  return unit ? `${goal} ${unit[1]} to go` : "next step";
};

/**
 * The Prestige Badge Capsule (founder, 2026-11-21): the badge status beside the artist's name in the workspace
 * header. A chamfered audio plaque pill in place of the old square card — metallic medallion, the BADGE micro-label,
 * the badge's collection, and a bubbly liquid-metal bar that fills with the ecosystem's own progress.
 *
 * The stepper walks the current badge and the upcoming ones in full colour (never greyed out), and the Badge Studio
 * holds the liquid finish, the frame a member has unlocked and which earned badge they pin to the capsule. A higher
 * frame can be lived in for five seconds before it is theirs; nothing it previews is ever saved.
 */
export function PrestigeBadgeCapsule({
  userId,
  tab,
  className = "",
}: {
  userId: string;
  /** The open workspace tab: the pill walks that tab's badges, never the whole ecosystem. */
  tab: BadgeTab;
  className?: string;
}) {
  const { states, data } = useBadgeStates(userId);
  const [style, setStyle] = useState<PrestigeStyle>(() => loadPrestigeStyle(userId));
  const [preview, setPreview] = useState<{ frame: FrameId; until: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  // The disc grows with the row it sits in, measured rather than declared: CSS cannot do it, because a wider disc
  // narrows the words, longer words make the row taller, and a taller row widens the disc again.
  const innerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const studioRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [discPx, setDiscPx] = useState(0);

  useEffect(() => {
    setStyle(loadPrestigeStyle(userId));
    setPreview(null);
  }, [userId]);

  /**
   * The smallest disc that is at least as tall as the words beside it (founder, 2026-11-21). A short action keeps the
   * 56px phone disc and the 72px one on a desktop; a three-line action grows the disc until it matches the block, so the
   * left side is never left with a small icon in a tall pill. Grown any further and the disc would narrow the words,
   * which would make the row taller again, so the search stops at the first size that fits.
   */
  const fitDisc = useRef(() => {});
  fitDisc.current = () => {
    const row = rowRef.current;
    const disc = discRef.current;
    const label = labelRef.current;
    const studio = studioRef.current;
    if (!row || !disc || !label || !studio) return;
    const style = window.getComputedStyle(row);
    const gap = parseFloat(style.columnGap || "0") || 0;
    const floor = window.matchMedia("(min-width: 640px)").matches ? DISC_DESKTOP : DISC_PHONE;
    const room = row.clientWidth - studio.offsetWidth - gap * 2 - LABEL_MIN;
    const limit = Math.min(DISC_MAX, Math.max(floor, Math.floor(room)));
    // If no size can hold the words, stay at the floor: a bigger disc there only squeezes the words into more lines and
    // makes the pill taller for nothing.
    let best = floor;
    for (let size = floor; size <= limit; size += 2) {
      disc.style.width = `${size}px`;
      disc.style.height = `${size}px`;
      // +1 absorbs the rounding of a line box, so a block that exactly fits is not pushed one step up.
      if (label.getBoundingClientRect().height <= size + 1) {
        best = size;
        break;
      }
    }
    disc.style.width = `${best}px`;
    disc.style.height = `${best}px`;
    setDiscPx((previous) => (previous === best ? previous : best));
  };

  // Both are read from this browser on every render, the way the badge settings already do: a seat switch or a cloud
  // sync then shows up without the capsule holding a stale copy.
  const onboard = loadOnboarding(userId);
  const prefs = badgePrefs(onboard);

  // Frames still unlock with the whole ecosystem's badges; the pill and its count walk the open tab's own badges.
  const ecosystem = useMemo(() => states.filter((s) => !s.off), [states]);
  const earnedCount = ecosystem.filter((s) => s.earned).length;
  const total = ecosystem.length;
  const completion = ecosystemCompletion(earnedCount, total);
  const inTab = useMemo(() => states.filter((s) => badgeTab(s.badge) === tab), [states, tab]);
  const tabEarned = useMemo(() => inTab.filter((s) => !s.off && s.earned), [inTab]);

  // A frame kept in storage is only worn while the ecosystem still says it is earned: disabling a badge or resetting a
  // shelf can take one back, and a saved choice is not proof of it. Until the badges have loaded, keep what was chosen.
  const savedFrame = frameById(style.frame) ?? frameById(DEFAULT_PRESTIGE_STYLE.frame)!;
  const mayWearSaved = !data || frameUnlocked(savedFrame, earnedCount, total);

  const equipped = onboard?.avatar
    ? tabEarned.find(
        (s) => s.badge.src === onboard.avatar || s.badge.choices?.includes(onboard.avatar),
      )
    : undefined;
  const newest = [...tabEarned].sort((a, b) => lastEarned(b) - lastEarned(a))[0];
  const featured =
    (style.featuredId && inTab.find((s) => s.badge.id === style.featuredId && s.earned)) ||
    equipped ||
    newest;

  // The pill shows one badge: the next one this tab can earn. Repeatable badges come first (an embed, a lyric or a
  // cover is one action away), then whatever is closest. Only a tab with nothing left settles on its newest badge.
  const next = useMemo(() => {
    if (!prefs.hints) return undefined;
    const pool = inTab.filter((s) => !s.off && !prefs.hidden.includes(s.badge.collection));
    return pickCapsuleBadge(
      pool
        .filter((s) => s.badge.every || !s.earned)
        .map((s) => ({
          state: s,
          goal: s.badge.goal,
          every: s.badge.every,
          count: s.count,
          earned: !!s.earned,
          lastEarnedAt: s.earned ? lastEarned(s) : 0,
        })),
    )?.state;
  }, [inTab, prefs]);
  const show = next ?? featured;

  // Re-fit when the pill changes width or the badge (and so the words) changes. Watching the inner pill, not the row:
  // the row's height is what this changes, and observing that would call itself back.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    let width = 0;
    const run = () => {
      const next = inner.clientWidth;
      if (Math.abs(next - width) < 2) return;
      width = next;
      fitDisc.current();
    };
    run();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(run);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [show?.badge.id, style.liquid]);

  // A taller pill curves further in at the bottom, so the bar and its number step in with it: their row has to clear the
  // rounded end without the count being shaved (founder, 2026-11-21). Inset only, so it cannot change the height.
  useEffect(() => {
    const inner = innerRef.current;
    const controls = controlsRef.current;
    if (!inner || !controls) return;
    const fit = () => {
      controls.style.paddingLeft = "";
      controls.style.paddingRight = "";
      const inset = Math.max(10, Math.round(inner.clientHeight * 0.11));
      controls.style.paddingLeft = `${inset}px`;
      controls.style.paddingRight = `${inset}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [show?.badge.id, style.liquid]);

  // A locked frame may be worn for five seconds; the pill returns to what the member owns on its own.
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [preview]);

  // The studio scrolls on a short screen, so a frame picked near the bottom would otherwise hide the countdown it just
  // started. Scroll only the card, and only as far as the notice needs.
  useEffect(() => {
    if (preview) previewRef.current?.scrollIntoView({ block: "nearest" });
  }, [preview?.frame]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preview && now >= preview.until) setPreview(null);
  }, [preview, now]);

  const badge = show?.badge;
  const isCurrent = !next && !!show;
  const target = show && badge ? Math.max(1, nextEarningAt(badge, show.count, !!show.earned)) : 1;
  const pct = show ? Math.round((Math.min(show.count, target) / target) * 100) : 0;

  const previewLeft = preview ? Math.max(0, preview.until - now) : 0;
  const activeFrame = preview
    ? preview.frame
    : mayWearSaved
      ? style.frame
      : DEFAULT_PRESTIGE_STYLE.frame;
  const activeFrameDef = frameById(activeFrame) ?? frameById(DEFAULT_PRESTIGE_STYLE.frame)!;
  const previewFrameDef = preview ? frameById(preview.frame) : undefined;
  const previewMissing = previewFrameDef ? badgesToUnlock(previewFrameDef, earnedCount, total) : 0;

  const label = next
    ? `Next badge: ${next.badge.title}. ${progressLabel(next)}.`
    : isCurrent
      ? `${tabTitle(tab)}: every badge earned. ${show.badge.title} came last.`
      : "No badge progress yet.";

  const bubbles = pct >= 75 ? BUBBLES.length : pct >= 40 ? 6 : 3;

  function update(next: Partial<PrestigeStyle>) {
    const merged = { ...style, ...next };
    setStyle(merged);
    savePrestigeStyle(userId, merged);
  }

  function chooseFrame(frame: PrestigeFrame, unlocked: boolean) {
    if (unlocked) {
      setPreview(null);
      update({ frame: frame.id });
      return;
    }
    // Try before you unlock: five seconds in the higher finish, with the count still on screen.
    setNow(Date.now());
    setPreview({ frame: frame.id, until: Date.now() + 5000 });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          // Wide enough on a desktop that a long action still fits beside the disc without a fourth line; tablets keep the
          // 22rem pill they had, so the header never has to squeeze the artist's name (see .prestige-capsule-shell).
          "prestige-capsule-shell relative mx-auto w-full sm:mx-0",
          className,
        )}
        data-prestige-capsule=""
      >
        <div className={cn("prestige-capsule", `prestige-frame-${activeFrame}`)}>
          {GLINTS.map((g, i) => (
            <span
              key={i}
              aria-hidden
              className="prestige-glint"
              style={{ left: g.left, top: g.top, animationDelay: `${i * 0.9}s` }}
            />
          ))}
          <div ref={innerRef} className="prestige-capsule-inner px-4 pt-3 pb-4 sm:px-5 sm:pb-3.5">
            {/* The pill opens the profile shelf, the way the next-badge card did (founder, 2026-11-21). The stepper
              and the studio button sit above it, so their own clicks never navigate. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/profile"
                  hash="badges"
                  aria-label={`Open your badge shelf. ${badge ? `${badge.title}: ${badge.action}.` : "Your first badge."}`}
                  className="absolute inset-0 z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D8CFF]"
                />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                className="max-w-64 space-y-1 border border-border bg-popover px-3 py-2 text-popover-foreground"
              >
                <p className="font-semibold">{badge?.title ?? "Your first badge"}</p>
                <p className="text-muted-foreground">{badge?.action ?? "Earn one to start"}</p>
                {/* A member who has never done the thing the badge asks for gets the plain explanation instead of
                  the jargon milestone (founder, 2026-11-21). */}
                {badge && next && next.count === 0 && badge.intro ? (
                  <p className="text-muted-foreground">{badge.intro}</p>
                ) : badge ? (
                  <p className="text-muted-foreground">{badge.milestone}</p>
                ) : null}
              </TooltipContent>
            </Tooltip>
            <div ref={rowRef} className="flex items-center gap-2 sm:gap-3">
              {/* The disc takes the row's height and its face is the square inside it (founder, 2026-11-21): the face
                derives its width from that height, so a wrapped action grows the icon with it. Sizing the disc from the
                row alone is what collapsed it to a sliver when the art had no intrinsic width. */}
              <span
                ref={discRef}
                style={discPx ? { width: discPx, height: discPx } : undefined}
                className={cn(
                  "prestige-medallion size-14 shrink-0 sm:size-[4.5rem]",
                  style.liquid === "gold" && "prestige-medallion-gold",
                )}
                aria-hidden
              >
                <span className="prestige-medallion-face">
                  {show && (
                    <img
                      src={shelfArt(show)}
                      alt=""
                      className="h-[78%] w-[78%] object-contain drop-shadow"
                    />
                  )}
                </span>
              </span>

              <span ref={labelRef} className="prestige-iced-label min-w-0 flex-1">
                {/* Inline, not a nowrap row (founder, 2026-11-21): a phone's font scaling stretches the micro-label past
                  the plate, so it wraps onto the next line instead of running outside the border. */}
                <span className="block leading-none [overflow-wrap:anywhere]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#4D8CFF]">
                    {isCurrent ? "Badge" : "Next badge"}
                  </span>{" "}
                  {badge && (
                    <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#E5E4E2]/70">
                      · {tabShort(tab)}
                    </span>
                  )}
                </span>
                {/* The title is the small line; the action is the biggest text on the pill, because the step to take
                  is what the member has to read (founder, 2026-11-21). Both wrap rather than clipping mid-word. */}
                <span className="mt-1 block text-[11px] font-semibold leading-tight text-[#E5E4E2]/85 [overflow-wrap:anywhere] sm:text-[12px]">
                  {badge?.title ?? "Your first badge"}
                </span>
                {/* Breaks between words, never through one (founder, 2026-11-21): at phone width the action column is
                  narrow enough that "registration" used to split as "registratio / n". */}
                <span className="mt-0.5 block text-[17px] font-extrabold leading-[1.1] text-white break-words sm:text-[20px] sm:leading-[1.05]">
                  {badge ? badge.action : "Earn one to start"}
                </span>
              </span>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    ref={studioRef}
                    type="button"
                    aria-label="Open Badge Studio"
                    title="Badge Studio"
                    className="prestige-icon-button relative z-20 h-9 w-9 shrink-0 self-start text-[#E5E4E2]/80 hover:text-white sm:h-10 sm:w-10"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  // Keep a margin off the window edge, so the scrolling card never touches the bottom of a short screen.
                  collisionPadding={12}
                  className="prestige-studio w-[21rem] border-[#2a2a2a] bg-[#0b0b0b] p-3 text-white"
                >
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-bold tracking-tight">Badge Studio</p>
                      <p className="text-[11px] text-[#E5E4E2]/70">
                        {earnedCount} of {total} badges earned · {Math.round(completion * 100)}%
                      </p>
                    </div>

                    {preview && previewFrameDef && (
                      <div
                        className="prestige-preview"
                        ref={previewRef}
                        role="status"
                        aria-live="polite"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="truncate">Previewing {previewFrameDef.name}</span>
                          <span className="tabular-nums text-[#4D8CFF]" aria-hidden>
                            {Math.ceil(previewLeft / 1000)}s
                          </span>
                        </div>
                        <div className="prestige-preview-track">
                          <span style={{ width: `${(previewLeft / 5000) * 100}%` }} />
                        </div>
                        <p className="text-[11px] leading-snug text-[#E5E4E2]/75">
                          {previewMissing > 0
                            ? `Earn ${previewMissing} more ecosystem badge${previewMissing === 1 ? "" : "s"} to unlock Permanently.`
                            : "This finish is yours to keep."}
                        </p>
                      </div>
                    )}

                    <fieldset className="space-y-1.5">
                      <legend className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D8CFF]">
                        Liquid finish
                      </legend>
                      <div className="grid grid-cols-2 gap-1.5">
                        {LIQUID_FINISHES.map((finish) => (
                          <button
                            key={finish.id}
                            type="button"
                            aria-pressed={style.liquid === finish.id}
                            aria-label={finish.name}
                            title={finish.hint}
                            onClick={() => update({ liquid: finish.id })}
                            className={cn(
                              "prestige-studio-option",
                              style.liquid === finish.id && "is-active",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "h-5 w-5 shrink-0 rounded-full",
                                finish.id === "gold"
                                  ? "bg-[linear-gradient(135deg,#B8860B,#FFD700_55%,#FFF3A8)]"
                                  : "bg-[linear-gradient(135deg,#9E9D9B,#E5E4E2_55%,#FFFFFF)]",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold">
                              {finish.name}
                            </span>
                            {style.liquid === finish.id && (
                              <Check className="h-3 w-3 shrink-0 text-[#4D8CFF]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="space-y-1">
                      <legend className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D8CFF]">
                        Capsule frame
                      </legend>
                      <div className="space-y-0.5">
                        {PRESTIGE_FRAMES.map((frame) => {
                          const unlocked = frameUnlocked(frame, earnedCount, total);
                          // The check marks the frame actually worn, so a frame that was taken back never reads as on.
                          const active = !preview && activeFrame === frame.id;
                          const isPreviewing = preview?.frame === frame.id;
                          const needed = badgesToUnlock(frame, earnedCount, total);
                          return (
                            <button
                              key={frame.id}
                              type="button"
                              aria-pressed={active}
                              aria-label={`${frame.name}. ${
                                unlocked
                                  ? "Unlocked."
                                  : `Locked, ${needed} more ecosystem badges needed. Five second preview.`
                              }`}
                              title={frame.hint}
                              onClick={() => chooseFrame(frame, unlocked)}
                              className={cn(
                                "prestige-studio-option",
                                active && "is-active",
                                isPreviewing && "is-previewing",
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "prestige-studio-swatch",
                                  `prestige-frame-${frame.id}`,
                                )}
                              />
                              <span className="min-w-0 flex-1 text-left">
                                <span className="block truncate text-[11px] font-semibold leading-tight">
                                  {frame.name}
                                </span>
                                <span className="block truncate text-[9px] leading-snug text-[#E5E4E2]/60">
                                  {unlocked
                                    ? frameTierLabel[frame.tier]
                                    : `Locked · ${needed} more`}
                                </span>
                              </span>
                              {active ? (
                                <Check className="h-3 w-3 shrink-0 text-[#4D8CFF]" />
                              ) : !unlocked ? (
                                <Lock className="h-3 w-3 shrink-0 text-[#E5E4E2]/45" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset className="space-y-1.5">
                      <legend className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4D8CFF]">
                        Featured badge
                      </legend>
                      <p className="text-[10px] leading-snug text-[#E5E4E2]/60">
                        The capsule always shows this tab's next badge. A pick here is worn once
                        every badge on the tab is earned.
                      </p>
                      {tabEarned.length === 0 ? (
                        <p className="text-[11px] text-[#E5E4E2]/70">
                          Earn a badge on this tab and it can sit on the capsule.
                        </p>
                      ) : (
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                          <button
                            type="button"
                            aria-pressed={!style.featuredId}
                            onClick={() => update({ featuredId: null })}
                            className={cn(
                              "prestige-pick text-[9px] font-semibold uppercase tracking-wider",
                              !style.featuredId && "is-active",
                            )}
                          >
                            Auto
                          </button>
                          {tabEarned.map((s) => (
                            <button
                              key={s.badge.id}
                              type="button"
                              title={s.badge.title}
                              aria-label={`Feature ${s.badge.title}`}
                              aria-pressed={style.featuredId === s.badge.id}
                              onClick={() => update({ featuredId: s.badge.id })}
                              className={cn(
                                "prestige-pick h-7 w-7 p-0.5",
                                style.featuredId === s.badge.id && "is-active",
                              )}
                            >
                              <img src={shelfArt(s)} alt="" className="h-6 w-6 object-contain" />
                            </button>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Held clear of the pill's rounded ends (founder, 2026-11-21): the bar has to reach the settings icon without
              the count being shaved by the curve on a narrow phone. */}
            <div ref={controlsRef} className="prestige-controls mt-2 flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={label}
                    className="prestige-track min-w-0 flex-1"
                  >
                    <div
                      className={cn(
                        "prestige-liquid",
                        style.liquid === "gold"
                          ? "prestige-liquid-gold"
                          : "prestige-liquid-platinum",
                      )}
                      style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
                    >
                      <span aria-hidden className="prestige-liquid-wave" />
                      <span aria-hidden className="prestige-meniscus" />
                      {BUBBLES.slice(0, bubbles).map((b, i) => (
                        <span
                          key={i}
                          aria-hidden
                          className="prestige-bubble"
                          style={
                            {
                              "--bubble-left": b.left,
                              "--bubble-size": `${b.size}px`,
                              "--bubble-delay": `${b.delay}s`,
                              "--bubble-duration": `${b.duration}s`,
                              "--bubble-sway": `${b.sway}px`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-72">
                  <p className="font-semibold">{badge?.title ?? "Your first badge"}</p>
                  <p>{label}</p>
                  {badge && !isCurrent && <p className="mt-1 opacity-80">{badge.milestone}</p>}
                </TooltipContent>
              </Tooltip>

              <span className="shrink-0 pr-1 text-[11px] font-bold tabular-nums text-[#E5E4E2]/70">
                {pct}%
              </span>
            </div>
          </div>
        </div>
        {/* A first-timer sees what the badge means without hovering anything (founder, 2026-11-21). */}
        {badge && next && next.count === 0 && badge.intro && (
          <p className="mt-1 text-center text-[9px] font-medium leading-snug text-[#E5E4E2]/70 sm:text-right">
            {badge.intro}
          </p>
        )}
        {preview && (
          <p
            className="mt-1 truncate text-center text-[9px] font-semibold text-[#4D8CFF] sm:text-right"
            aria-hidden
          >
            {activeFrameDef.name} · {Math.ceil(previewLeft / 1000)}s preview
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
