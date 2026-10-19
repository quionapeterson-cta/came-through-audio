import { getPaddleEnvironment } from "@/lib/paddle";
import { TIER_LABEL, type Tier } from "@/lib/plans";

type Props = { previewTier?: Tier | "real"; onPreviewTier?: ((t: Tier | "real") => void) | undefined };

/** Test-mode notice. In sandbox only, also offers a preview-only tier switcher (never touches billing data). */
export function PaymentTestModeBanner({ previewTier, onPreviewTier }: Props) {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3 border-b border-caution bg-caution/20 px-4 py-2 text-center text-sm text-foreground">
      <span>
        All payments made in the preview are in test mode.{" "}
        <a href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer" className="font-medium underline">Read more</a>
      </span>
      {onPreviewTier && (
        <label className="flex items-center gap-2 font-semibold">
          Preview tier:
          <select
            aria-label="Preview tier"
            value={previewTier ?? "real"}
            onChange={(e) => onPreviewTier(e.target.value as Tier | "real")}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="real">My real plan</option>
            {(Object.keys(TIER_LABEL) as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
