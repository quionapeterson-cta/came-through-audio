import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ExternalLink, Radio, ReceiptText, Shirt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RecoupGauge } from "@/components/LabCharts";
import type { CatalogTrack } from "@/lib/catalog";
import { countDigits, groupCount } from "@/lib/royalty-calc";
import { cn } from "@/lib/utils";
import {
  PIPELINE_SHARES,
  SOUNDEXCHANGE,
  pipelineBuckets,
  pipelineState,
  recoupmentProgress,
  recoupmentTargets,
  soundExchangeMath,
  type PipelineStage,
} from "@/lib/royalty-pipeline";
import {
  proAccountGaps,
  registrationCheck,
  registrationReadiness,
  type MissingItem,
} from "@/lib/readiness";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const count = (n: number) => n.toLocaleString("en-US");
const percent = (n: number) => `${Math.round(n * 10) / 10}%`;
/** A rate's own four decimals: one play, or one stream, in the money it actually pays. */
const unitMoney = (n: number) => `$${n.toFixed(4)}`;

/** Each agency's own site, so a flagged registration is one click from the filing. */
const AGENCY_URL: Record<string, string | undefined> = {
  ascap: "https://www.ascap.com",
  bmi: "https://www.bmi.com",
  sesac: "https://www.sesac.com",
  mlc: "https://www.themlc.com",
  soundexchange: "https://www.soundexchange.com",
};
const agencyUrl = (key: string) => AGENCY_URL[key] ?? "https://www.ascap.com";

type AgencyRow = { key: string; label: string; gaps: MissingItem[]; url: string };

const NO_SONG: MissingItem[] = [
  {
    code: "isrc",
    message: "Choose a catalog song first, so the Lab can check what each agency needs.",
    field: "isrc",
  },
];

const dedupe = (items: MissingItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}:${item.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The writers' own societies share one set of requirements, but only ASCAP and BMI have a per-agency check in the shared
 * module. A SESAC or GMR writer reads the core rules, the PRO/IPI gaps and the split warning instead — the same
 * functions registrationCheck is built on, so no second rule appears here.
 */
function proGaps(track: CatalogTrack, society: string): MissingItem[] {
  const key = society.toLowerCase();
  const m = track.metadata;
  if (key === "ascap" || key === "bmi") return registrationCheck(m, key).missing;
  const base = registrationReadiness(m, "pro");
  return dedupe([...base.missing, ...base.warnings, ...proAccountGaps(m)]);
}

function BucketCard({
  label,
  name,
  share,
  bucket,
  stage,
  rows,
  registered,
  onToggle,
}: {
  label: string;
  name: string;
  share: string;
  bucket: { pool: number; yours: number };
  stage: PipelineStage;
  rows: AgencyRow[];
  registered: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <article className="fl-pipe-card" data-state={stage.kind}>
      <span className="fl-pipe-label">{label}</span>
      <span className="fl-pipe-name">{name}</span>
      <span className="fl-pipe-money">{money(bucket.yours)}</span>
      <span className="fl-pipe-share">{share}</span>
      <span className="fl-pipe-state" data-kind={stage.kind}>
        <i aria-hidden="true" />
        {stage.label}
      </span>
      {rows.length > 0 && (
        <div className="fl-pipe-reg-list">
          {rows.map((row) => {
            const on = !!registered[row.key];
            return (
              <div key={row.key} className="fl-pipe-reg">
                <span className="fl-pipe-reg-name">{row.label}</span>
                <button
                  type="button"
                  className="fl-reg-btn"
                  data-on={on}
                  aria-pressed={on}
                  onClick={() => onToggle(row.key)}
                >
                  {on && <Check className="h-3 w-3" aria-hidden="true" />}
                  {on ? "Registered" : "Mark registered"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <span className="fl-pipe-note">{stage.note}</span>
    </article>
  );
}

/**
 * "Where did my money go?" — the stream pool the Lab already forecast, cut into the three buckets it is paid through,
 * plus SoundExchange for non-interactive plays. A bucket with no registration is black box money, and one marked
 * registered while the catalog still misses something is a fix-the-registration-or-update-the-catalog reminder.
 */
export function RoyaltyPipelinePanel({
  song,
  pool,
  masterShare,
  songShare,
  streams,
}: {
  song: CatalogTrack | undefined;
  pool: number;
  masterShare: number;
  songShare: number;
  streams: number;
}) {
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [service, setService] = useState<string>(SOUNDEXCHANGE.services[0]!.id);
  const [sxRate, setSxRate] = useState(() => String(SOUNDEXCHANGE.services[0]!.rate));
  const [sxPlays, setSxPlays] = useState("0");
  const [featured, setFeatured] = useState(true);

  // A mark belongs to the song it was made on: switching songs starts the registration record clean.
  useEffect(() => setRegistered({}), [song?.id]);

  const checks = useMemo(() => {
    const m = song?.metadata;
    if (!m) return null;
    return {
      mlc: registrationCheck(m, "mlc"),
      soundexchange: registrationCheck(m, "soundexchange"),
    };
  }, [song]);

  const proRows = useMemo<AgencyRow[]>(() => {
    if (!song) return [{ key: "pro", label: "Your PRO", gaps: NO_SONG, url: agencyUrl("ascap") }];
    const m = song.metadata;
    const societies = [
      ...new Set(
        [...(m.writers ?? []), ...(m.composers ?? [])]
          .map((writer) => writer.pro?.trim())
          .filter((pro): pro is string => !!pro && pro !== "None"),
      ),
    ];
    if (!societies.length)
      return [
        {
          key: "pro",
          label: "Your PRO",
          gaps: [
            {
              code: "pro",
              message: "Add a PRO affiliation for each writer in My Catalog.",
              field: "writers-0-pro",
            },
          ],
          url: agencyUrl("ascap"),
        },
      ];
    return societies.map((society) => ({
      key: society.toLowerCase(),
      label: society,
      gaps: proGaps(song, society),
      url: agencyUrl(society),
    }));
  }, [song]);

  const mlcRow = useMemo<AgencyRow>(
    () => ({
      key: "mlc",
      label: "The MLC",
      gaps: checks?.mlc.missing ?? NO_SONG,
      url: agencyUrl("mlc"),
    }),
    [checks],
  );

  const sxRow = useMemo<AgencyRow>(
    () => ({
      key: "soundexchange",
      label: "SoundExchange",
      gaps: checks?.soundexchange.missing ?? NO_SONG,
      url: agencyUrl("soundexchange"),
    }),
    [checks],
  );

  const buckets = useMemo(
    () => pipelineBuckets({ pool, masterShare, songShare }),
    [pool, masterShare, songShare],
  );
  const bucket = (id: "master" | "pro" | "mlc") => buckets.find((b) => b.id === id)!;
  // One stream's own money: the pool divided by the streams entered, so the bar carries cents rather than only shares.
  const oneStream = streams > 0 ? Math.max(0, pool) / streams : 0;
  const shownSxPlays = groupCount(sxPlays);
  const sx = soundExchangeMath({
    plays: Number(sxPlays) || 0,
    rate: Number(sxRate) || 0,
    masterShare,
    featuredArtist: featured,
  });

  const stageFor = (bucketPool: number, rows: AgencyRow[]) => {
    const stages = rows.map((row) =>
      pipelineState({
        agency: row.label,
        pool: bucketPool,
        registered: !!registered[row.key],
        gaps: row.gaps,
      }),
    );
    return (
      stages.find((stage) => stage.kind === "mismatch") ??
      stages.find((stage) => stage.kind === "waiting") ??
      stages[0]!
    );
  };

  const masterStage: PipelineStage =
    pool > 0
      ? {
          kind: "collected",
          label: "No filing needed",
          note: "Your distributor pays this side; there is no registration to check.",
        }
      : { kind: "empty", label: "Nothing yet", note: "No streams entered yet." };
  const proStage = stageFor(bucket("pro").pool, proRows);
  const mlcStage = stageFor(bucket("mlc").pool, [mlcRow]);
  const sxStage = stageFor(sx.gross, [sxRow]);

  const held = (stage: PipelineStage, amount: number, bucketPool: number) =>
    bucketPool > 0 && (stage.kind === "waiting" || stage.kind === "mismatch") ? amount : 0;
  const blackBox =
    held(proStage, bucket("pro").yours, bucket("pro").pool) +
    held(mlcStage, bucket("mlc").yours, bucket("mlc").pool) +
    held(sxStage, sx.yours, sx.gross);

  const reminders = [
    ...proRows.map((row) => ({ row, pool: bucket("pro").pool })),
    { row: mlcRow, pool: bucket("mlc").pool },
    { row: sxRow, pool: sx.gross },
  ]
    .map(({ row, pool: bucketPool }) => ({
      row,
      stage: pipelineState({
        agency: row.label,
        pool: bucketPool,
        registered: !!registered[row.key],
        gaps: row.gaps,
      }),
    }))
    .filter(({ stage }) => stage.kind === "waiting" || stage.kind === "mismatch");

  const anyMoney = pool > 0 || sx.gross > 0;

  // A listed publisher collects the publishing side of the song, so the writing cards' figure is not what the member
  // keeps. With no publisher on the song there is no cut to name, and the approved line stays as it is.
  const publisherCut = (song?.metadata.publishers ?? []).some((row) => row.name.trim())
    ? ", before your publisher's cut"
    : "";

  function toggle(key: string) {
    setRegistered((current) => ({ ...current, [key]: !current[key] }));
  }

  function chooseService(id: string) {
    const next =
      SOUNDEXCHANGE.services.find((item) => item.id === id) ?? SOUNDEXCHANGE.services[0]!;
    setService(next.id);
    setSxRate(String(next.rate));
  }

  const cards = [
    {
      id: "master",
      label: "Distributor · master",
      name: "Your recording",
      share: `${percent(PIPELINE_SHARES.master * 100)} of the pool · your master share ${percent(
        masterShare,
      )}, before your distributor's cut`,
      bucket: bucket("master"),
      stage: masterStage,
      rows: [] as AgencyRow[],
    },
    {
      id: "pro",
      label: "PRO · performance",
      name: proRows.map((row) => row.label).join(" · "),
      share: `${percent(PIPELINE_SHARES.pro * 100)} of the pool · your song share ${percent(songShare)}${publisherCut}`,
      bucket: bucket("pro"),
      stage: proStage,
      rows: proRows,
    },
    {
      id: "mlc",
      label: "The MLC · mechanical",
      name: "The MLC",
      share: `${percent(PIPELINE_SHARES.mlc * 100)} of the pool · your song share ${percent(songShare)}${publisherCut}`,
      bucket: bucket("mlc"),
      stage: mlcStage,
      rows: [mlcRow],
    },
  ];

  return (
    <section className="fl-telemetry fl-pipe" aria-label="Where did my money go?">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="fl-eyebrow flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
            <ReceiptText className="h-3.5 w-3.5" /> Royalty pipeline
          </div>
          <h3 className="mt-1 text-lg font-extrabold">Where did my money go?</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {money(pool)} reaches all rights holders together before your distributor takes its cut.
            It is already divided between the recording, your PRO and The MLC.
          </p>
        </div>
        <span className="fl-chip ml-auto">{count(streams)} STREAMS</span>
      </div>

      <div className="fl-step-label mt-3">
        <span className="fl-step-num">1</span> Read where the stream pool goes
      </div>

      <div
        className="fl-pipe-bar"
        role="img"
        aria-label={`One stream: ${unitMoney(oneStream * PIPELINE_SHARES.master)} to the master (${percent(
          PIPELINE_SHARES.master * 100,
        )}), ${unitMoney(oneStream * PIPELINE_SHARES.pro)} to the performance (${percent(
          PIPELINE_SHARES.pro * 100,
        )}) and ${unitMoney(oneStream * PIPELINE_SHARES.mlc)} to the mechanical (${percent(
          PIPELINE_SHARES.mlc * 100,
        )}).`}
      >
        <div className="fl-pipe-seg fl-pipe-seg-master" style={{ flex: 8 }}>
          <span>{percent(PIPELINE_SHARES.master * 100)}</span>
          <small>{unitMoney(oneStream * PIPELINE_SHARES.master)}</small>
        </div>
        <div className="fl-pipe-seg fl-pipe-seg-pro" style={{ flex: 1 }}>
          <span>{percent(PIPELINE_SHARES.pro * 100)}</span>
          <small>{unitMoney(oneStream * PIPELINE_SHARES.pro)}</small>
        </div>
        <div className="fl-pipe-seg fl-pipe-seg-mlc" style={{ flex: 1 }}>
          <span>{percent(PIPELINE_SHARES.mlc * 100)}</span>
          <small>{unitMoney(oneStream * PIPELINE_SHARES.mlc)}</small>
        </div>
      </div>
      {/* The bar's own segments are too narrow for a name, so the three buckets are always spelled out under it, with
          the money one stream puts in each. The bar carries the same split for a screen reader. */}
      <ul className="fl-pipe-legend" aria-hidden="true">
        <li>
          <span className="fl-pipe-dot fl-pipe-dot-master" />
          Master <b>{percent(PIPELINE_SHARES.master * 100)}</b> ·{" "}
          {unitMoney(oneStream * PIPELINE_SHARES.master)} a stream
        </li>
        <li>
          <span className="fl-pipe-dot fl-pipe-dot-pro" />
          PRO <b>{percent(PIPELINE_SHARES.pro * 100)}</b> ·{" "}
          {unitMoney(oneStream * PIPELINE_SHARES.pro)}
        </li>
        <li>
          <span className="fl-pipe-dot fl-pipe-dot-mlc" />
          The MLC <b>{percent(PIPELINE_SHARES.mlc * 100)}</b> ·{" "}
          {unitMoney(oneStream * PIPELINE_SHARES.mlc)}
        </li>
      </ul>

      <div className="fl-step-label mt-3">
        <span className="fl-step-num">2</span> Mark the registrations you&apos;ve filed
      </div>

      <div className="fl-pipe-grid">
        {cards.map((card) => (
          <BucketCard
            key={card.id}
            label={card.label}
            name={card.name}
            share={card.share}
            bucket={card.bucket}
            stage={card.stage}
            rows={card.rows}
            registered={registered}
            onToggle={toggle}
          />
        ))}
      </div>

      <div className="fl-step-label mt-3">
        <span className="fl-step-num">3</span> Add your non-interactive plays
      </div>

      <div className="fl-pipe-sx">
        <div className="min-w-0">
          <div className="fl-pipe-sx-name">
            <Radio className="h-4 w-4" aria-hidden="true" /> SoundExchange
          </div>
          <p className="fl-pipe-sx-sub">
            Pandora radio and webcasts — {count(sx.plays)} performances at {unitMoney(sx.rate)} pay{" "}
            {money(sx.gross)}.{" "}
            {featured
              ? `You keep ${percent(sx.share * 100)} of it: the 45% featured-artist share, plus ${percent(
                  masterShare,
                )} of the 50% recording-owner share.`
              : `You keep ${percent(sx.share * 100)} of it: ${percent(
                  masterShare,
                )} of the 50% recording-owner share, while the 45% featured-artist share goes to the
                featured artist.`}{" "}
            5% goes to the non-featured players and singers.
          </p>
          <label className="fl-pipe-sx-role">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
            />
            I&apos;m the featured artist on this recording
          </label>
        </div>
        <div className="fl-pipe-sx-controls">
          <div className="fl-field">
            <label htmlFor="fl-sx-service">Service</label>
            <select
              id="fl-sx-service"
              className="fl-select"
              value={service}
              onChange={(event) => chooseService(event.target.value)}
            >
              {SOUNDEXCHANGE.services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fl-field">
            <label htmlFor="fl-sx-plays">Plays</label>
            <Input
              id="fl-sx-plays"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={cn(
                "fl-input fl-mono fl-count h-8 w-full text-right",
                shownSxPlays.length > 12 && "fl-count-long",
              )}
              value={shownSxPlays}
              placeholder="0"
              onFocus={(event) => {
                if (event.currentTarget.value === "0") event.currentTarget.select();
              }}
              onChange={(event) => setSxPlays(countDigits(event.target.value))}
            />
          </div>
          <div className="fl-field">
            <label htmlFor="fl-sx-rate">Per play ($)</label>
            <Input
              id="fl-sx-rate"
              type="number"
              min={0}
              step="0.0001"
              inputMode="decimal"
              className="fl-input fl-mono h-8 w-full text-right"
              value={sxRate}
              onChange={(event) => setSxRate(event.target.value)}
            />
          </div>
        </div>
        <div className="fl-pipe-sx-foot">
          <span className="fl-pipe-money">{money(sx.yours)}</span>
          <span className="fl-pipe-state" data-kind={sxStage.kind}>
            <i aria-hidden="true" />
            {sxStage.label}
          </span>
          <button
            type="button"
            className="fl-reg-btn"
            data-on={!!registered["soundexchange"]}
            aria-pressed={!!registered["soundexchange"]}
            onClick={() => toggle("soundexchange")}
          >
            {registered["soundexchange"] && <Check className="h-3 w-3" aria-hidden="true" />}
            {registered["soundexchange"] ? "Registered" : "Mark registered"}
          </button>
          <span className="fl-pipe-note">{sxStage.note}</span>
          <a
            href={SOUNDEXCHANGE.source.url}
            target="_blank"
            rel="noreferrer"
            className="fl-ref-link"
            title={`${SOUNDEXCHANGE.source.label} source`}
            aria-label={`${SOUNDEXCHANGE.source.label} source`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="fl-pipe-summary">
        {blackBox > 0 ? (
          <>
            <b>{money(blackBox)} is black box</b> — it is already being collected, but it cannot
            reach you until every registration below is filed and matched.
          </>
        ) : anyMoney ? (
          <>
            Every bucket holding money is marked registered. Keep the catalog and the filings in
            step.
          </>
        ) : (
          <>Enter streams above and the buckets that are holding your money will show up here.</>
        )}
      </div>

      <div className="fl-pipe-reminders">
        <div className="fl-eyebrow text-[0.65rem] font-bold uppercase tracking-[0.2em]">
          Registration reminders
        </div>
        {reminders.length ? (
          <ul className="fl-pipe-reminder-list">
            {reminders.map(({ row, stage }) => (
              <li key={row.key} className="fl-pipe-reminder" data-kind={stage.kind}>
                <div className="min-w-0">
                  <strong>
                    {row.label} —{" "}
                    {stage.kind === "mismatch"
                      ? "fix the registration or update the catalog"
                      : "not registered yet"}
                  </strong>
                  <span>{stage.note}</span>
                </div>
                <a href={row.url} target="_blank" rel="noreferrer" className="fl-pipe-link">
                  {stage.kind === "mismatch" ? "Fix registration" : "Register"}{" "}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fl-pipe-note">Nothing is waiting on a registration right now.</p>
        )}
      </div>

      <p className="fl-pipe-foot">
        The split is the Lab's own rule of thumb: {percent(PIPELINE_SHARES.master * 100)} recording,{" "}
        {percent(PIPELINE_SHARES.pro * 100)} performance and {percent(PIPELINE_SHARES.mlc * 100)}{" "}
        mechanical. The even split inside the publishing half is a convention for showing the two
        sides, not an official rate; the real balance moves with the rates in force. Registration
        state comes from this song's writers' PRO and IPI, its ISRC and its UPC — and from the
        buttons you press here, which are kept for this session until the catalog's saved
        registration record ships.{" "}
        <a
          href={SOUNDEXCHANGE.source.url}
          target="_blank"
          rel="noreferrer"
          className="fl-pipe-link"
        >
          SoundExchange's own rates
        </a>
        . Satellite radio (SiriusXM) pays a share of revenue rather than a per-play rate, so it is
        not in this estimate. Estimates only.
      </p>
    </section>
  );
}

/**
 * Recoupment & goal reality: the reverse of the forecast. A project cost over what one stream or one shirt actually
 * pays the member, using the Lab's own editable rates and the Budget Planner's target spend.
 */
export function RecoupmentPanel({
  target,
  earned,
  streamCut,
  merchProfit,
  spotifyRate,
  appleRate,
  onOpenMerch,
  onOpenBudget,
  taxRate,
}: {
  target: string;
  /** The Lab's projected take for the streams and plays already entered, read as money back on the project. */
  earned: number;
  streamCut: number;
  merchProfit: number;
  spotifyRate: number;
  appleRate: number;
  /** Carries the member to the merch calculator when a shirt target needs a price it has not got yet. */
  onOpenMerch?: (() => void) | undefined;
  /** Carries the member to the Budget Planner whose target spend is the prefill this cost starts from. */
  onOpenBudget?: (() => void) | undefined;
  /** The rate in the tax worksheet, shown as an after-tax read on this project cost. */
  taxRate?: number | undefined;
}) {
  const [value, setValue] = useState(target);
  // The Budget Planner's target spend is the prefill: change it there and every target here moves with it.
  useEffect(() => setValue(target), [target]);
  const cost = Number(value) || 0;
  const cut = Math.max(0, Math.min(100, streamCut));
  const rate = Math.max(0, Math.min(100, taxRate ?? 0));
  const targets = recoupmentTargets({
    cost,
    streamCut: cut,
    spotifyRate,
    appleRate,
    merchProfit,
  });
  const progress = recoupmentProgress({
    cost,
    earned,
    streamCut: cut,
    spotifyRate,
    appleRate,
  });
  const tiles = [
    {
      id: "spotify",
      name: "Spotify",
      note: `${unitMoney(spotifyRate)} per stream`,
      units: cost > 0 ? targets.spotify : null,
      icon: Radio,
    },
    {
      id: "apple",
      name: "Apple Music",
      note: `${unitMoney(appleRate)} per stream`,
      units: cost > 0 ? targets.apple : null,
      icon: ReceiptText,
    },
    {
      id: "merch",
      name: "T-shirts",
      note: merchProfit > 0 ? `${money(merchProfit)} profit each` : "Set a merch price",
      units: cost > 0 ? targets.merch : null,
      icon: Shirt,
    },
  ];

  return (
    <section
      id="fl-recoupment"
      className="fl-telemetry fl-pipe"
      aria-label="Recoupment and goal reality"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="fl-eyebrow flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
            <Shirt className="h-3.5 w-3.5" /> Recoupment
          </div>
          <h3 className="mt-1 text-lg font-extrabold">Streams to pay off the project</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            A target, not a forecast: the project cost measured at the rates above and your own
            stream cut. No growth curve and no twelve-month promise.
          </p>
        </div>
        {/* The chip names where the cost comes from, so it is also the way to the field that sets it. */}
        {onOpenBudget ? (
          <button
            type="button"
            className="fl-chip fl-chip-jump ml-auto"
            onClick={onOpenBudget}
            title="Open the Budget Planner to set your target spend"
          >
            FROM YOUR BUDGET
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : (
          <span className="fl-chip ml-auto">FROM YOUR BUDGET</span>
        )}
      </div>

      <div className="fl-step-label mt-3">
        <span className="fl-step-num">1</span> Name the project cost
      </div>

      <div className="fl-recoup-controls">
        <div className="fl-field">
          <label htmlFor="fl-recoup-cost">Project cost ($)</label>
          <Input
            id="fl-recoup-cost"
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            className="fl-input fl-mono"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="fl-recoup-read">
          <span>Your combined stream cut</span>
          <strong>{percent(cut)}</strong>
        </div>
      </div>
      <p className="fl-hint">
        {cost > 0
          ? "Prefilled from the Budget Planner's target spend. Change the cost here and every target below follows it."
          : "Name the cost here, or set a target spend in the Budget Planner and it fills in."}
      </p>
      {rate > 0 && cost > 0 ? (
        <p className="fl-hint">
          At the {percent(rate)} rate in your write-off worksheet, a {money(cost)} project could
          mean about {money((cost * rate) / 100)} back, leaving about{" "}
          {money(cost * (1 - rate / 100))} to earn. An estimate, not a refund.
        </p>
      ) : null}

      <div className="fl-step-label mt-3">
        <span className="fl-step-num">2</span> Read what it takes to earn it back
      </div>
      <RecoupGauge progress={progress} spotifyRate={spotifyRate} />
      <p className="fl-hint">
        Earned is the projection from the streams and plays entered above, not a payout statement.
      </p>

      <div className="fl-recoup-grid">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <article key={tile.id} className="fl-recoup-tile" data-hero={tile.id === "spotify"}>
              <div className="fl-recoup-name">
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tile.name}
                </span>
                {/* Without a price there is no shirt target, so the note becomes the way to the field that sets one. */}
                {tile.id === "merch" && merchProfit <= 0 && onOpenMerch ? (
                  <button type="button" className="fl-jump" onClick={onOpenMerch}>
                    Set a merch price
                  </button>
                ) : (
                  <em>{tile.note}</em>
                )}
              </div>
              <div className="fl-recoup-number">
                {tile.units === null ? "—" : count(tile.units)}
              </div>
              <div className="fl-recoup-unit">
                {tile.units === null
                  ? cost <= 0
                    ? "Add a project cost above"
                    : tile.id === "merch"
                      ? "Add a selling price in the merch calculator"
                      : "Set your stream shares above"
                  : tile.id === "merch"
                    ? "shirts sold to recover the cost"
                    : "streams to break even"}
              </div>
            </article>
          );
        })}
      </div>

      <p className="fl-pipe-foot">
        Spotify and Apple Music multiply the editable rates in Projected Royalty Earnings by your{" "}
        {percent(cut)} cut. T-shirt units divide the cost by the{" "}
        {/* Every mention of another tool is the way to it, so the footnote's calculator opens too. */}
        {onOpenMerch ? (
          <button type="button" className="fl-jump" onClick={onOpenMerch}>
            Merch &amp; Sales Calculator
          </button>
        ) : (
          <>Merch &amp; Sales Calculator</>
        )}
        {"'s price minus unit cost"}
        {merchProfit > 0 ? ` (${money(merchProfit)} a shirt)` : ""}. Real payouts vary by country,
        subscription tier and deal, so treat these as targets to aim at.
      </p>
    </section>
  );
}
