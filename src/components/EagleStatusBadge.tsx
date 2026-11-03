import { EAGLE_ART, eagleStatus, type EagleStatus } from "@/lib/eagle-status";
import { useBilling } from "@/hooks/useBilling";

/**
 * The Catalog Management soaring status (PLAN-badges-roles-app.md, art added by the founder 2026-11-03).
 *
 * - `disc`: the full badge, for a profile or a catalog header.
 * - `dot`: the transparent eagle alone, as a small status marker next to a name.
 * - `locked`: grayed out, for people who aren't on Catalog Management yet, shown beside the features they'd unlock.
 *
 * Pure: pass the status in. Use `useEagleStatus` where billing is already loaded, so a page never fetches it twice.
 */
export function EagleStatusBadge({ status, variant = "dot", size, className = "" }: {
  status: EagleStatus; variant?: "dot" | "disc"; size?: number; className?: string;
}) {
  const px = size ?? (variant === "disc" ? 44 : 18);
  return (
    <span
      className={`group relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      title={status.locked ? `${status.label} · ${status.detail}` : `${status.label} · ${status.detail}`}
    >
      {variant === "disc" && !status.locked && (
        <img src={EAGLE_ART.glow} alt="" aria-hidden loading="lazy"
          className="absolute inset-0 h-full w-full scale-150 object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-90" />
      )}
      <img
        src={status.art}
        alt={status.locked ? "Catalog Management status, locked" : `${status.label} status: ${status.detail}`}
        loading="lazy"
        className={`relative h-full w-full object-contain ${status.locked ? "opacity-45 grayscale" : ""}`}
      />
      <span className="sr-only">{status.locked ? `Locked: ${status.detail}` : `${status.label}. ${status.detail}`}</span>
    </span>
  );
}

/** The status for a signed-in user, from the plan they already have loaded. Paused accounts count as Free. */
export function useEagleStatus(userId: string | undefined) {
  const { tier, sub } = useBilling(userId);
  return eagleStatus({ onManagement: tier === "management", startedAt: sub?.current_period_start ?? null });
}

/** The grayed-out eagle shown beside a Catalog Management feature a lower plan can't use yet. */
export function LockedEagle({ className = "", size }: { className?: string; size?: number }) {
  return <EagleStatusBadge status={eagleStatus({ onManagement: false })} {...(size ? { size } : {})} className={className} />;
}
