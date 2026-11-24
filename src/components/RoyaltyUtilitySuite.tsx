import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AudioLines,
  Calculator,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Disc3,
  ExternalLink,
  Gauge,
  Headphones,
  MonitorPlay,
  Moon,
  Music2,
  Radio,
  ReceiptText,
  Repeat,
  Smartphone,
  Shirt,
  Sparkles,
  Sun,
  TrendingUp,
  Wallet,
  Waves,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { LabBudgetPlanner } from "@/components/LabBudgetPlanner";
import { LabMerchCalculator } from "@/components/LabMerchCalculator";
import { RecoupmentPanel, RoyaltyPipelinePanel } from "@/components/RoyaltyPipeline";
import { UpgradeLock } from "@/components/UpgradeLock";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadOnboarding } from "@/lib/artist-profile";
import { listTracks, type CatalogTrack } from "@/lib/catalog";
import { COUNTRIES, countryByCode } from "@/lib/repertoires";
import {
  MASTER_PORTION,
  PLATFORMS,
  PRO_SCALES,
  RATE_SOURCES,
  convertBetween,
  countDigits,
  estimateEarnings,
  groupCount,
  rateFromTotals,
  songShareRows,
  yourSongShare,
  type ProScale,
} from "@/lib/royalty-calc";
import {
  COPY_AGENCIES,
  contextForTrack,
  copyForAgency,
  fullReport,
  taxSavings,
  breakEvenStreams,
  type CopyContext,
} from "@/lib/financial-lab-copy";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
/** A per-stream rate's own decimals: four is enough for a statement average, six for a very small one. */
const rateMoney = (n: number) => `$${n.toFixed(n >= 0.0001 ? 4 : 6)}`;
/**
 * A count box that opens on 0 is right-aligned, so a click lands the caret before that zero and the first digit typed
 * turns 0 into 10. Selecting the lone zero makes the first keystroke replace it, the way a number field would.
 */
const selectZero = (event: ReactFocusEvent<HTMLInputElement>) => {
  if (event.currentTarget.value === "0") event.currentTarget.select();
};
const SCALES = Object.keys(PRO_SCALES) as ProScale[];

/**
 * The Financial Lab's three sub-tabs: royalty intelligence, the production budget planner and the merch & sales
 * calculator. The first keeps every panel that shipped before this split, unchanged.
 */
type LabTab = "royalty" | "budget" | "merch";
const LAB_TABS: {
  id: LabTab;
  label: string;
  eyebrow: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  {
    id: "royalty",
    label: "Royalty Intelligence",
    eyebrow: "Royalty intelligence",
    blurb:
      "Convert catalog splits, forecast every platform and hand each agency a clean registration sheet.",
    icon: Gauge,
  },
  {
    id: "budget",
    label: "Budget Planner",
    eyebrow: "Budget planner",
    blurb:
      "Pick a project, name the spend and let CTA split it — then track every line from estimated to paid.",
    icon: Wallet,
  },
  {
    id: "merch",
    label: "Merch & Sales Calculator",
    eyebrow: "Merch & sales",
    blurb: "Model the run: upfront cost, the breakeven unit and the cash left at any number sold.",
    icon: Shirt,
  },
];

const PLATFORM_ICON: Record<string, LucideIcon> = {
  spotify: Music2,
  apple: Headphones,
  amazon: Disc3,
  youtube_music: Youtube,
  tidal: Waves,
  deezer: AudioLines,
  pandora: Radio,
  youtube: MonitorPlay,
  soundcloud: AudioLines,
  audiomack: Disc3,
  tiktok: Smartphone,
  meta: Smartphone,
};

export function RoyaltyUtilitySuite({
  unlocked,
  onUpgrade,
  userId,
}: {
  unlocked: boolean;
  onUpgrade: () => void;
  userId?: string;
}) {
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  useEffect(() => {
    if (unlocked)
      listTracks()
        .then(setTracks)
        .catch(() => {});
  }, [unlocked]);
  if (!unlocked) {
    return (
      <UpgradeLock
        className=""
        title="The Financial Lab"
        tier="collaborate"
        onUpgrade={onUpgrade}
        text="Turn your catalog splits into the numbers BMI, ASCAP and SESAC ask for, forecast your payouts by platform, and plan a project budget or a merch run before you spend."
      />
    );
  }
  return <FinancialLab tracks={tracks} userId={userId} />;
}

function useLabTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("cta.studioMode", next ? "on" : "off");
    } catch {
      /* storage blocked */
    }
    setDark(next);
  }
  return { dark, toggle };
}

function FinancialLab({ tracks, userId }: { tracks: CatalogTrack[]; userId: string | undefined }) {
  const [tab, setTab] = useState<LabTab>("royalty");
  const [songId, setSongId] = useState("");
  const [code, setCode] = useState(() => loadOnboarding(userId)?.healthCountry || "US");
  const [focus, setFocus] = useState("all");
  const [bedazzle, setBedazzle] = useState(false);
  // Lifted here so the royalty tools can prefill from the other two: the Budget Planner's target spend and the merch
  // calculator's live price and cost. Neither tool writes the other's state; the parent only carries the numbers.
  // Empty until the artist names their own spend: a filled-in target pre-prices the recoupment tool with a project
  // that isn't theirs (founder, 2026-11-24).
  const [budgetCap, setBudgetCap] = useState("");
  // No shirt margin until the merch calculator reports one: a preset margin here would price the recoupment panel's
  // shirts tile with a run nobody made (founder, 2026-11-24).
  const [merchMargin, setMerchMargin] = useState({ price: 0, cost: 0 });
  const theme = useLabTheme();
  const song = tracks.find((t) => t.id === songId);
  const rows = useMemo(() => (song ? songShareRows(song.metadata) : []), [song]);
  const contributors = useMemo(() => [...new Set(rows.map((r) => r.label))], [rows]);
  const country = countryByCode(code) ?? COUNTRIES[0]!;
  const activeTab = LAB_TABS.find((item) => item.id === tab) ?? LAB_TABS[0]!;

  useEffect(() => {
    setFocus((current) => (current !== "all" && !contributors.includes(current) ? "all" : current));
  }, [contributors]);

  useEffect(() => {
    try {
      setBedazzle(localStorage.getItem("cta.bedazzle") === "on");
    } catch {
      /* storage blocked */
    }
  }, []);

  function setSparkle(on: boolean) {
    setBedazzle(on);
    try {
      localStorage.setItem("cta.bedazzle", on ? "on" : "off");
    } catch {
      /* storage blocked */
    }
  }

  function trackPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const lab = e.currentTarget;
    const box = lab.getBoundingClientRect();
    lab.style.setProperty("--mouse-x", `${e.clientX - box.left}px`);
    lab.style.setProperty("--mouse-y", `${e.clientY - box.top}px`);
    for (const panel of lab.querySelectorAll<HTMLElement>(".fl-crystal, .fl-telemetry, .fl-dock")) {
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      panel.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    }
  }

  return (
    <div
      className={cn("financial-lab space-y-4", bedazzle && "fl-bedazzle")}
      onPointerMove={trackPointer}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--mouse-x", "50%");
        e.currentTarget.style.setProperty("--mouse-y", "50%");
      }}
    >
      <LabHeader
        dark={theme.dark}
        onTheme={theme.toggle}
        bedazzle={bedazzle}
        onBedazzle={setSparkle}
        blurb={activeTab.blurb}
      />
      <nav className="fl-tab-strip" role="tablist" aria-label="The Financial Lab sections">
        {LAB_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`fl-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`fl-panel-${item.id}`}
              className="fl-tab"
              onClick={() => setTab(item.id)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
      {/*
        All three panels stay mounted and only the active one is shown, so a half-tracked budget or a merch simulation
        is still there after a look at another tab.
      */}
      {LAB_TABS.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`fl-panel-${item.id}`}
          aria-labelledby={`fl-tab-${item.id}`}
          hidden={tab !== item.id}
        >
          {item.id === "royalty" && (
            <div className="space-y-4">
              <Intake
                countryCode={country.code}
                onCountry={setCode}
                tracks={tracks}
                songId={songId}
                onSong={setSongId}
                contributors={contributors}
                focus={focus}
                onFocus={setFocus}
                songSelected={!!song}
              />
              <Converter
                song={song}
                rows={rows}
                countryName={country.name}
                societies={
                  (country.societies.performance ?? []).map((s) => s.name).join(", ") ||
                  "your society"
                }
                us={country.code === "US"}
                focus={focus}
              />
              <Earnings
                tracks={tracks}
                song={song}
                songId={songId}
                userId={userId}
                bedazzle={bedazzle}
                budgetCap={budgetCap}
                merchMargin={merchMargin}
              />
            </div>
          )}
          {item.id === "budget" && <LabBudgetPlanner target={budgetCap} onTarget={setBudgetCap} />}
          {item.id === "merch" && <LabMerchCalculator onMarginChange={setMerchMargin} />}
        </div>
      ))}
      <p className="fl-footnote">
        Every number here is an estimate to help you plan and register. It isn't financial, legal or
        tax advice, and agencies decide the final amounts.
      </p>
    </div>
  );
}

function LabHeader({
  dark,
  onTheme,
  bedazzle,
  onBedazzle,
  blurb,
}: {
  dark: boolean;
  onTheme: () => void;
  bedazzle: boolean;
  onBedazzle: (on: boolean) => void;
  blurb: string;
}) {
  return (
    <header className="fl-header fl-crystal">
      <div className="relative z-10 min-w-0">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">The Financial Lab</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="fl-mode-btn"
          onClick={onTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to Studio Mode (dark)"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Daylight" : "Obsidian"}
        </button>
        <div className="fl-switch-label">
          <Sparkles className="fl-sparkle h-4 w-4" data-on={bedazzle} />
          <span>Bedazzle Mode</span>
          <Switch
            checked={bedazzle}
            onCheckedChange={onBedazzle}
            aria-label="Toggle Bedazzle Mode"
            className="fl-switch"
          />
        </div>
      </div>
    </header>
  );
}

function Intake({
  countryCode,
  onCountry,
  tracks,
  songId,
  onSong,
  contributors,
  focus,
  onFocus,
  songSelected,
}: {
  countryCode: string;
  onCountry: (value: string) => void;
  tracks: CatalogTrack[];
  songId: string;
  onSong: (value: string) => void;
  contributors: string[];
  focus: string;
  onFocus: (value: string) => void;
  songSelected: boolean;
}) {
  return (
    <section className="fl-panel fl-intake fl-crystal" aria-label="Financial Lab intake">
      <div className="grid gap-2 sm:grid-cols-[1.1fr_1.6fr_1fr_auto]">
        <div className="fl-field">
          <Label htmlFor="calc-country">Country</Label>
          <select
            id="calc-country"
            value={countryCode}
            onChange={(e) => onCountry(e.target.value)}
            className="fl-select"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fl-field">
          <Label htmlFor="calc-song">Song</Label>
          <select
            id="calc-song"
            value={songId}
            onChange={(e) => onSong(e.target.value)}
            className="fl-select"
          >
            <option value="">Enter shares by hand</option>
            {[...tracks]
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.metadata.album ? ` — ${t.metadata.album}` : ""}
                </option>
              ))}
          </select>
        </div>
        <div className="fl-field">
          <Label htmlFor="calc-contributor">Contributor</Label>
          <select
            id="calc-contributor"
            value={focus}
            onChange={(e) => onFocus(e.target.value)}
            disabled={!songSelected || !contributors.length}
            className="fl-select"
          >
            <option value="all">All contributors</option>
            {contributors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <span className="fl-chip whitespace-nowrap">
            <Calculator className="h-3.5 w-3.5" /> Formula converter
          </span>
        </div>
      </div>
    </section>
  );
}

function Converter({
  song,
  rows,
  countryName,
  societies,
  us,
  focus,
}: {
  song: CatalogTrack | undefined;
  rows: ReturnType<typeof songShareRows>;
  countryName: string;
  societies: string;
  us: boolean;
  focus: string;
}) {
  const [value, setValue] = useState("100");
  const [from, setFrom] = useState<ProScale>("bmi");
  const n = Number(value) || 0;
  const visibleRows = focus === "all" ? rows : rows.filter((r) => r.label === focus);
  const totals = SCALES.map((k) => ({
    id: k,
    value: song
      ? visibleRows.reduce((t, r) => t + r.catalog * PRO_SCALES[k].factor, 0)
      : convertBetween(n, from, k),
  }));
  const copyContext = useMemo(
    () =>
      contextForTrack(song, {
        ...(focus !== "all" ? { focus } : {}),
        ...(!song ? { manual: { scale: from, value: n } } : {}),
      }),
    [song, focus, from, n],
  );

  return (
    <section className="fl-panel fl-crystal overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="fl-icon-badge">
            <Repeat className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">Royalty Formula Converter</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Your catalog keeps each half of the song out of 100%. BMI asks for 200% (writer +
              publisher); ASCAP and SESAC ask for 100% (50/50).
            </p>
          </div>
        </div>
        <span className="fl-chip">PRO SHARE</span>
      </div>

      <div className="mt-3">
        <div className="fl-step-label">
          <span className="fl-step-num">1</span> Choose a song above, or enter the share by hand
        </div>
        <p className="fl-hint">
          Country and song sit at the top of this tab. A song brings its catalog splits; with no
          song, type one share and pick the scale it is written on.
        </p>
      </div>

      {!song && (
        <div className="fl-manual mt-3">
          <div className="fl-field">
            <Label htmlFor="calc-from">Convert from</Label>
            <select
              id="calc-from"
              value={from}
              onChange={(e) => setFrom(e.target.value as ProScale)}
              className="fl-select"
            >
              {SCALES.map((k) => (
                <option key={k} value={k}>
                  {PRO_SCALES[k].name} ({PRO_SCALES[k].total}%)
                </option>
              ))}
            </select>
          </div>
          <div className="fl-field">
            <Label htmlFor="calc-value">Share (%)</Label>
            <Input
              id="calc-value"
              type="number"
              min={0}
              max={PRO_SCALES[from].total}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="fl-input fl-mono"
            />
          </div>
          <p className="fl-hint sm:col-span-2">
            The meter and every agency copy update as you type. Nothing is saved to the catalog.
          </p>
        </div>
      )}

      <div className="mt-3">
        <div className="fl-step-label">
          <span className="fl-step-num">2</span> Read each society&apos;s converted shares
        </div>
        <SplitMeter values={totals} />
      </div>

      {song ? (
        visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Half</th>
                  <th className="text-right">Your catalog</th>
                  {us ? (
                    SCALES.map((k) => (
                      <th key={k} className="text-right">
                        {PRO_SCALES[k].name} ({PRO_SCALES[k].total}%)
                      </th>
                    ))
                  ) : (
                    <th className="text-right">{societies} (100%)</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.field}>
                    <td className="font-semibold">{r.label}</td>
                    <td className="text-muted-foreground">{r.half}</td>
                    <td className="fl-mono text-right">{pct(r.catalog)}</td>
                    {us ? (
                      SCALES.map((k) => (
                        <td key={k} className="fl-mono text-right font-semibold">
                          {pct(r.catalog * PRO_SCALES[k].factor)}
                        </td>
                      ))
                    ) : (
                      <td className="fl-mono text-right font-semibold">{pct(r.catalog / 2)}</td>
                    )}
                  </tr>
                ))}
                <tr className="fl-total-row">
                  <td colSpan={2}>Total{visibleRows.length !== rows.length ? " (focused)" : ""}</td>
                  <td className="fl-mono text-right">
                    {pct(visibleRows.reduce((t, r) => t + r.catalog, 0))}
                  </td>
                  {us ? (
                    SCALES.map((k) => (
                      <td key={k} className="fl-mono text-right">
                        {pct(visibleRows.reduce((t, r) => t + r.catalog * PRO_SCALES[k].factor, 0))}
                      </td>
                    ))
                  ) : (
                    <td className="fl-mono text-right">
                      {pct(visibleRows.reduce((t, r) => t + r.catalog / 2, 0))}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="fl-empty">
            This song has no writer splits yet. Add them in My Catalog, or choose “Enter shares by
            hand” above.
          </p>
        )
      ) : null}

      {!us && (
        <p className="fl-note">
          Most societies outside the US, including {societies}, count out of 100% and split
          performance royalties between writers and publishers. The usual split is 50/50, but some
          societies use their own, so check {societies}'s registration guide before you register.
        </p>
      )}
      <p className="fl-hint">
        Country: {countryName}. Shares are catalog values; no calculation was changed.
      </p>
      <div className="mt-3">
        <div className="fl-step-label">
          <span className="fl-step-num">3</span> Copy the result for your agency
        </div>
        <CopyDeck context={copyContext} showFullReport={false} />
      </div>
    </section>
  );
}

function SplitMeter({ values }: { values: { id: ProScale; value: number }[] }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <div className="fl-split-meter" aria-label="Unified PRO split meter">
      {values.map(({ id, value }) => (
        <div
          key={id}
          className={cn("fl-split-seg", `fl-seg-${id}`)}
          style={{ "--fill": `${Math.min(100, (value / max) * 100)}%` } as CSSProperties}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-widest">
              {PRO_SCALES[id].name}
            </span>
            <span className="fl-mono text-sm font-bold">{pct(value)}</span>
          </div>
          <div className="mt-1 text-[0.65rem] uppercase tracking-wider opacity-70">
            {PRO_SCALES[id].total}% scale
          </div>
        </div>
      ))}
    </div>
  );
}

function Earnings({
  tracks,
  song,
  songId,
  userId,
  bedazzle,
  budgetCap,
  merchMargin,
}: {
  tracks: CatalogTrack[];
  song: CatalogTrack | undefined;
  songId: string;
  userId: string | undefined;
  bedazzle: boolean;
  budgetCap: string;
  merchMargin: { price: number; cost: number };
}) {
  // The Lab opens on no streams entered: a pre-filled count would put a projection on screen that isn't the member's
  // own (founder, 2026-11-24).
  const [streams, setStreams] = useState<Record<string, string>>({ spotify: "0" });
  // The member's own statement totals for the platform in view: pasting a payout and its streams gives their real
  // average, which they can apply over the published default.
  const [own, setOwn] = useState({ paid: "", streams: "" });
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(PLATFORMS.map((p) => [p.id, String(p.rate)])),
  );
  const [master, setMaster] = useState("100");
  const [songShare, setSongShare] = useState("100");
  const [radio, setRadio] = useState({ plays: "0", perPlay: "0" });
  const [pulse, setPulse] = useState(0);
  const [platform, setPlatform] = useState(PLATFORMS[0]!.id);

  useEffect(() => {
    const t = tracks.find((x) => x.id === songId);
    if (!t) return;
    const ob = loadOnboarding(userId);
    const names = [ob?.legalName, ob?.stageName].filter((x): x is string => !!x?.trim());
    setMaster(t.metadata.masterShare || "100");
    setSongShare(String(Math.round(yourSongShare(songShareRows(t.metadata), names) * 100) / 100));
  }, [songId, tracks, userId]);

  const num = (r: Record<string, string>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v) || 0]));
  const r = estimateEarnings({
    streams: num(streams),
    rates: num(rates),
    masterShare: Number(master) || 0,
    songShare: Number(songShare) || 0,
    radioPlays: Number(radio.plays) || 0,
    perPlay: Number(radio.perPlay) || 0,
  });
  const selected = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0]!;
  const selectedRow = r.platforms.find((x) => x.id === selected.id)!;
  // What the two count boxes show: grouped digits, with a smaller size once the number outgrows the box.
  const shownStreams = groupCount(streams[selected.id] ?? "");
  const shownPlays = groupCount(radio.plays);
  const longCount = (shown: string) => (shown.length > 12 ? "fl-count-long" : "");
  const ownRate = rateFromTotals(Number(own.paid) || 0, Number(own.streams) || 0);

  // A pasted statement belongs to the platform it came from: switching platforms starts the paste clean.
  useEffect(() => setOwn({ paid: "", streams: "" }), [selected.id]);

  function useOwnAverage() {
    if (ownRate === null) return;
    setRates((current) => ({ ...current, [selected.id]: String(Number(ownRate.toFixed(6))) }));
    setPulse((p) => p + 1);
    toast.success(`${selected.name} now uses your own average of ${rateMoney(ownRate)} a stream.`);
  }
  const selectedSource = selected.source ? RATE_SOURCES[selected.source] : undefined;
  const enteredCount = PLATFORMS.filter((p) => Number(streams[p.id]) > 0).length;
  const enteredLabel =
    enteredCount === 1
      ? `1 of ${PLATFORMS.length} platforms has streams entered.`
      : `${enteredCount} of ${PLATFORMS.length} platforms have streams entered.`;
  const copyContext = useMemo(
    () =>
      contextForTrack(song, {
        earnings: {
          total: r.yours,
          radio: r.radio,
          masterShare: Number(master) || 0,
          songShare: Number(songShare) || 0,
          platforms: PLATFORMS.map((p) => {
            const row = r.platforms.find((x) => x.id === p.id)!;
            return {
              name: p.name,
              streams: Number(streams[p.id]) || 0,
              rate: Number(rates[p.id]) || 0,
              total: row.total,
              yours: row.yours,
            };
          }),
        },
      }),
    [song, r, master, songShare, streams, rates],
  );

  // One cut, read by the readout, the pipeline and the recoupment targets, so the three can never disagree.
  const streamCut =
    MASTER_PORTION * (Number(master) || 0) + (1 - MASTER_PORTION) * (Number(songShare) || 0);
  const streamPool = r.platforms.reduce((n, p) => n + p.total, 0);
  const streamCount = Object.values(streams).reduce((n, v) => n + (Number(v) || 0), 0);

  function setStream(id: string, value: string) {
    setStreams((current) => ({ ...current, [id]: value }));
    setPulse((p) => p + 1);
  }

  return (
    <section className="fl-panel fl-crystal fl-earnings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="fl-icon-badge">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">Projected Royalty Earnings</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Rates start at the published average where there is one, checked against the source
              beside it, and stay editable. About {Math.round(MASTER_PORTION * 100)}% of a stream
              goes to the master and {Math.round((1 - MASTER_PORTION) * 100)}% to the song.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="fl-chip">STEP 1–4</span>
          <span className="fl-chip">{song ? song.title : "MANUAL SHARES"}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="fl-step-label">
          <span className="fl-step-num">1</span> Set your share of the master and the song
        </div>
        <p className="fl-hint">
          From your split sheet: the master share you own and the song share you hold. The combined
          cut is what one stream pays you.
        </p>
      </div>

      <div className="fl-controls">
        <div className="fl-field">
          <Label htmlFor="earn-master">Your share of the master (%)</Label>
          <Input
            id="earn-master"
            type="number"
            min={0}
            max={100}
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            className="fl-input fl-mono"
          />
        </div>
        <div className="fl-field">
          <Label htmlFor="earn-song-share">Your share of the song (%)</Label>
          <Input
            id="earn-song-share"
            type="number"
            min={0}
            max={100}
            value={songShare}
            onChange={(e) => setSongShare(e.target.value)}
            className="fl-input fl-mono"
          />
        </div>
        <div className="fl-readout">
          <span>Your combined stream cut</span>
          <strong>{pct(streamCut)}</strong>
        </div>
      </div>

      <div className="fl-platform-block">
        <div className="fl-step-label">
          <span className="fl-step-num">2</span> Pick each platform you&apos;re on and add its
          streams
        </div>
        <p className="fl-hint">
          Choose a platform, type its streams, then switch to the next. Each platform keeps its own
          count, and your total adds them all together.
        </p>
        <div className="fl-field mt-2">
          <Label htmlFor="earn-platform">Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger id="earn-platform" className="fl-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="fl-platform-grid">
          <div className="fl-field">
            <Label htmlFor="earn-streams">Streams</Label>
            <Input
              id="earn-streams"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={cn(
                "fl-input fl-mono fl-count h-8 w-full text-right",
                longCount(shownStreams),
              )}
              value={shownStreams}
              placeholder="0"
              onFocus={selectZero}
              onChange={(e) => setStream(selected.id, countDigits(e.target.value))}
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="earn-rate">Per stream ($)</Label>
            <Input
              id="earn-rate"
              type="number"
              min={0}
              step="0.0001"
              className="fl-input fl-mono h-8 w-full text-right"
              value={rates[selected.id] ?? ""}
              onChange={(e) => setRates({ ...rates, [selected.id]: e.target.value })}
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="earn-estimate">Your estimate</Label>
            <output id="earn-estimate" className="fl-estimate">
              {money(selectedRow.yours)}
            </output>
          </div>
        </div>

        {(selected.note || selectedSource) && (
          <p className="fl-platform-note">
            {selected.note}
            {selected.note && selectedSource ? " " : ""}
            {selectedSource && (
              <a
                href={selectedSource.url}
                target="_blank"
                rel="noreferrer"
                className="fl-ref-link fl-ref-link-named"
                title={`${selectedSource.label} source`}
                aria-label={`${selectedSource.label} source`}
              >
                <ExternalLink className="h-3 w-3" />
                {selectedSource.label}
              </a>
            )}
          </p>
        )}
        <p className="fl-platform-note">
          {enteredLabel} Switching platforms keeps every number you type.
        </p>

        <div className="fl-ownavg">
          <div className="fl-ownavg-head">
            <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" /> Use your own totals
          </div>
          <div className="fl-platform-grid">
            <div className="fl-field">
              <Label htmlFor="earn-own-paid">Total paid ($)</Label>
              <Input
                id="earn-own-paid"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="fl-input fl-mono h-8 w-full text-right"
                value={own.paid}
                placeholder="0.00"
                onChange={(e) => setOwn({ ...own, paid: e.target.value.replace(/[^0-9.]/g, "") })}
              />
            </div>
            <div className="fl-field">
              <Label htmlFor="earn-own-streams">Streams</Label>
              <Input
                id="earn-own-streams"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={cn(
                  "fl-input fl-mono fl-count h-8 w-full text-right",
                  longCount(groupCount(own.streams)),
                )}
                value={groupCount(own.streams)}
                placeholder="0"
                onFocus={selectZero}
                onChange={(e) => setOwn({ ...own, streams: countDigits(e.target.value) })}
              />
            </div>
            <div className="fl-field">
              <Label htmlFor="earn-own-average">Your average</Label>
              <output id="earn-own-average" className="fl-estimate">
                {ownRate === null ? "—" : rateMoney(ownRate)}
              </output>
            </div>
          </div>
          <div className="fl-ownavg-foot">
            <button
              type="button"
              className="fl-ghost-btn disabled:cursor-not-allowed disabled:opacity-50"
              onClick={useOwnAverage}
              disabled={ownRate === null}
            >
              Use this rate for {selected.name}
            </button>
            <span className="fl-platform-note !mt-0">
              Paste a distributor statement&apos;s total and its streams for any period. It replaces
              the published rate above for this platform only.
            </span>
          </div>
        </div>
      </div>

      <div className="fl-platform-block">
        <h4 className="fl-step-label">
          <span className="fl-step-num">3</span> Add radio, SiriusXM and live plays
        </h4>
        <div className="fl-platform-grid">
          <div className="fl-field">
            <Label htmlFor="earn-radio-plays">Plays</Label>
            <Input
              id="earn-radio-plays"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={cn(
                "fl-input fl-mono fl-count h-8 w-full text-right",
                longCount(shownPlays),
              )}
              value={shownPlays}
              placeholder="0"
              onFocus={selectZero}
              onChange={(e) => {
                setRadio({ ...radio, plays: countDigits(e.target.value) });
                setPulse((p) => p + 1);
              }}
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="earn-radio-rate">Per play ($)</Label>
            <Input
              id="earn-radio-rate"
              type="number"
              min={0}
              step="0.01"
              className="fl-input fl-mono h-8 w-full text-right"
              value={radio.perPlay}
              onChange={(e) => setRadio({ ...radio, perPlay: e.target.value })}
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="earn-radio-estimate">Your estimate</Label>
            <output id="earn-radio-estimate" className="fl-estimate">
              {money(r.radio)}
            </output>
          </div>
        </div>
        <p className="fl-platform-note">
          Performance royalties: the song side only. Airplay pays through your PRO&apos;s blanket
          licences, so there is no public per-play rate to prefill; digital radio&apos;s statutory
          per-play rates sit in the Royalty Pipeline below.
        </p>
      </div>

      <div className="mt-4">
        <div className="fl-step-label">
          <span className="fl-step-num">4</span> Copy the breakdown for your notes
        </div>
        <CopyDeck context={copyContext} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <Telemetry r={r} streams={streams} rates={rates} />
        <MiniDrawers />
      </div>

      <RoyaltyPipelinePanel
        song={song}
        pool={streamPool}
        masterShare={Number(master) || 0}
        songShare={Number(songShare) || 0}
        streams={streamCount}
      />

      <RecoupmentPanel
        target={budgetCap}
        earned={r.yours}
        streamCut={streamCut}
        merchProfit={merchMargin.price - merchMargin.cost}
        spotifyRate={Number(rates["spotify"]) || 0}
        appleRate={Number(rates["apple"]) || 0}
      />

      <TotalDock total={r.yours} context={copyContext} pulse={pulse} bedazzle={bedazzle} />
    </section>
  );
}

function Telemetry({
  r,
  streams,
  rates,
}: {
  r: ReturnType<typeof estimateEarnings>;
  streams: Record<string, string>;
  rates: Record<string, string>;
}) {
  const [advanced, setAdvanced] = useState(true);
  const [log, setLog] = useState(false);
  // No growth is assumed for them: the curve moves only by the rate they type.
  const [growth, setGrowth] = useState("0");
  const gradientId = useId().replace(/:/g, "");
  const growthN = Number(growth) || 0;
  const points = Array.from({ length: 12 }, (_, i) => r.yours * Math.pow(1 + growthN / 100, i));
  const maxValue = Math.max(...points, 1);
  const maxLog = Math.log10(maxValue + 1);
  const x = (i: number) => 10 + (i * 300) / 11;
  const y = (v: number) => 118 - (log ? Math.log10(v + 1) / maxLog : v / maxValue) * 98;
  const path = points
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${x(11)},124 L${x(0)},124 Z`;
  const ranked = [...r.platforms].sort((a, b) => b.yours - a.yours);
  const top = ranked[0];
  const maxPlatform = Math.max(...ranked.map((p) => p.yours), 1);

  return (
    <section className="fl-telemetry" aria-label="Royalty telemetry and revenue radar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="fl-eyebrow flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
            <Gauge className="h-3.5 w-3.5" /> Telemetry
          </div>
          <h3 className="mt-1 text-lg font-extrabold">Royalty Telemetry &amp; Revenue Radar</h3>
          <p className="text-sm text-muted-foreground">
            Stream mix on the left, a 12-month compounding projection on the right.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="fl-mini-toggle">
            <Switch
              checked={advanced}
              onCheckedChange={setAdvanced}
              aria-label="Toggle advanced analytics"
            />{" "}
            Advanced analytics
          </label>
          <label className="fl-mini-toggle">
            <Switch checked={log} onCheckedChange={setLog} aria-label="Toggle logarithmic mode" />{" "}
            Logarithmic
          </label>
        </div>
      </div>

      {advanced ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)]">
          <div className="fl-radar-stack">
            {ranked.slice(0, 8).map((p) => {
              const Icon = PLATFORM_ICON[p.id] ?? Music2;
              return (
                <div key={p.id} className="fl-radar-row">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="fl-radar-bar">
                    <span style={{ width: `${Math.max(3, (p.yours / maxPlatform) * 100)}%` }} />
                  </div>
                  <span className="fl-mono text-right">{money(p.yours)}</span>
                </div>
              );
            })}
          </div>
          <div className="fl-chart-card">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                12-month projection
              </span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Growth{" "}
                <Input
                  aria-label="Monthly growth percent"
                  type="number"
                  min={0}
                  step={1}
                  value={growth}
                  onChange={(e) => setGrowth(e.target.value)}
                  className="fl-input fl-mono h-7 w-14 text-right"
                />
                %
              </label>
            </div>
            <svg
              className="fl-radar-chart"
              viewBox="0 0 320 140"
              role="img"
              aria-label={`Illustrative 12-month projection at ${growthN} percent monthly growth`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#4D8CFF" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#4D8CFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1={x(0)}
                  x2={x(11)}
                  y1={20 + i * 32}
                  y2={20 + i * 32}
                  className="fl-chart-grid"
                />
              ))}
              <path d={area} fill={`url(#${gradientId})`} />
              <path d={path} className="fl-chart-line" />
              {[0, 5, 11].map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y="136"
                  textAnchor={i === 0 ? "start" : i === 11 ? "end" : "middle"}
                  className="fl-chart-label"
                >
                  M{i + 1}
                </text>
              ))}
            </svg>
            <p className="mt-1 text-[0.68rem] leading-snug text-muted-foreground">
              Illustrative only: {money(points[11]!)} at month 12. Change the growth assumption to
              model your own release.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="fl-stat">
            <span>Top platform</span>
            <strong>{top?.name ?? "—"}</strong>
            <small>{money(top?.yours ?? 0)}</small>
          </div>
          <div className="fl-stat">
            <span>Month 12 projection</span>
            <strong>{money(points[11]!)}</strong>
            <small>Illustrative</small>
          </div>
          <div className="fl-stat">
            <span>Current stream cut</span>
            <strong>{money(r.yours)}</strong>
            <small>
              {Object.values(streams)
                .reduce((n, v) => n + (Number(v) || 0), 0)
                .toLocaleString("en-US")}{" "}
              streams entered
            </small>
          </div>
        </div>
      )}
      {!advanced && (
        <p className="mt-2 text-xs text-muted-foreground">
          Turn on Advanced analytics to compare the platform stack against the compounding curve.
        </p>
      )}
    </section>
  );
}

function MiniDrawers() {
  const [expenses, setExpenses] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [releaseCost, setReleaseCost] = useState("");
  const [netPerStream, setNetPerStream] = useState("");
  const tax = taxSavings(expenses, taxRate);
  const streams = breakEvenStreams(releaseCost, netPerStream);

  return (
    <aside className="space-y-2" aria-label="Financial Lab side drawers">
      <details className="fl-drawer">
        <summary>
          <span className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" /> Artist Tax Write-Off Estimator
          </span>
          <ChevronDown className="fl-drawer-chevron h-4 w-4" />
        </summary>
        <div className="space-y-2">
          <div className="fl-field">
            <Label htmlFor="tax-expenses">Deductible expenses ($)</Label>
            <Input
              id="tax-expenses"
              type="number"
              min={0}
              className="fl-input fl-mono"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="tax-rate">Your marginal tax rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              min={0}
              max={100}
              className="fl-input fl-mono"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="fl-drawer-result">
            <span>Estimated tax savings</span>
            <strong>{money(tax)}</strong>
          </div>
          <p className="fl-hint">
            Estimate only. Your tax professional decides what qualifies and your actual rate.
          </p>
        </div>
      </details>
      <details className="fl-drawer">
        <summary>
          <span className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4" /> Release Break-Even Check
          </span>
          <ChevronDown className="fl-drawer-chevron h-4 w-4" />
        </summary>
        <div className="space-y-2">
          <div className="fl-field">
            <Label htmlFor="break-cost">Release cost ($)</Label>
            <Input
              id="break-cost"
              type="number"
              min={0}
              className="fl-input fl-mono"
              value={releaseCost}
              onChange={(e) => setReleaseCost(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="fl-field">
            <Label htmlFor="break-net">Your net per stream ($)</Label>
            <Input
              id="break-net"
              type="number"
              min={0}
              step="0.0001"
              className="fl-input fl-mono"
              value={netPerStream}
              onChange={(e) => setNetPerStream(e.target.value)}
              placeholder="0.0000"
            />
          </div>
          <div className="fl-drawer-result">
            <span>Streams to break even</span>
            <strong>{streams === null ? "—" : streams.toLocaleString("en-US")}</strong>
          </div>
          <p className="fl-hint">Uses your own net-per-stream estimate, not a platform promise.</p>
        </div>
      </details>
    </aside>
  );
}

function CopyDeck({
  context,
  showFullReport = true,
}: {
  context: CopyContext;
  showFullReport?: boolean;
}) {
  return (
    <div className="fl-copy-deck">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="fl-eyebrow text-[0.65rem] font-bold uppercase tracking-[0.2em]">
            1-click agency copy
          </div>
          <p className="text-xs text-muted-foreground">
            Paste into a registration form, email or your own notes.
          </p>
        </div>
        <span className="fl-chip ml-auto">Ready to paste</span>
      </div>
      <div className="fl-copy-row">
        {COPY_AGENCIES.map((a) => (
          <CopyButton
            key={a.id}
            label={`COPY FOR ${a.label}`}
            text={copyForAgency(a.id, context)}
          />
        ))}
        {showFullReport && <CopyButton label="COPY FULL REPORT" text={fullReport(context)} gold />}
      </div>
    </div>
  );
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({
  label,
  text,
  gold = false,
}: {
  label: string;
  text: string;
  gold?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!(await writeClipboard(text))) {
      toast.error("Couldn't copy. Select the text and copy it manually.");
      return;
    }
    setCopied(true);
    toast.success(copied ? "Copied again." : `${label.replace("COPY ", "").toLowerCase()} copied.`);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      type="button"
      className={cn("fl-copy", gold && "fl-copy-gold")}
      data-copied={copied}
      onClick={() => void copy()}
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

function TotalDock({
  total,
  context,
  pulse,
  bedazzle,
}: {
  total: number;
  context: CopyContext;
  pulse: number;
  bedazzle: boolean;
}) {
  return (
    <div className={cn("fl-dock", bedazzle && "fl-dock-bedazzle")} data-pulse={pulse}>
      {bedazzle &&
        Array.from({ length: 4 }, (_, i) => (
          <span
            key={`${pulse}-${i}`}
            className="fl-glint"
            style={{
              left: `${18 + i * 21}%`,
              top: i % 2 ? "6px" : "auto",
              bottom: i % 2 ? "auto" : "6px",
              animationDelay: `${i * 90}ms`,
            }}
            aria-hidden="true"
          />
        ))}
      <div className="min-w-0">
        <div className="fl-dock-label flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.2em]">
          <TrendingUp className="h-3.5 w-3.5" /> Your projected total
        </div>
        <div className="fl-dock-total">{money(total)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:block">
          All entered platforms + PRO table
        </span>
        <CopyButton label="Copy Breakdown" text={fullReport(context)} gold />
      </div>
    </div>
  );
}
