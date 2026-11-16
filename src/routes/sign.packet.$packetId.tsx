import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfSignaturePad, type SignatureValue } from "@/components/PdfSignaturePad";
import { getSigningPacket, submitSigningPacket } from "@/lib/pdf-packets.functions";
import {
  packetProblems,
  packetProgress,
  recipientCheckboxes,
  recipientFields,
  visibleBlocks,
  type PacketStatus,
  type PacketValues,
} from "@/lib/pdf-packets";
import { BRAND, formatBlockDate, TAGLINE } from "@/lib/pdf-templates";

export const Route = createFileRoute("/sign/packet/$packetId")({
  head: () => ({
    meta: [
      { title: "Sign your packet — Came Through Audio" },
      {
        name: "description",
        content: "Review the packet Came Through Audio sent you, fill in your details and sign.",
      },
      {
        property: "og:title",
        content: "A packet from Came Through Audio is ready for your signature",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PacketSigningPage,
});

type LoadedPacket = NonNullable<Awaited<ReturnType<typeof getSigningPacket>>>;

/**
 * The recipient's own page (founder, 2026-11-15). No account, no app: the link is the key. They fill the fields, tick the
 * boxes and sign once; the company countersigns afterwards.
 *
 * The path is /sign/packet/:id rather than /sign/:id because /sign/:rowId already belongs to split-sheet signing.
 */
function PacketSigningPage() {
  const { packetId } = Route.useParams();
  const load = useServerFn(getSigningPacket);
  const submit = useServerFn(submitSigningPacket);
  const [packet, setPacket] = useState<LoadedPacket | null | undefined>(undefined);
  const [values, setValues] = useState<PacketValues>({});
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ completed: boolean } | null>(null);

  useEffect(() => {
    load({ data: { id: packetId } })
      .then((result) => {
        setPacket(result);
        if (result) setValues({ ...result.adminValues, ...result.values });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't open this packet."));
  }, [packetId, load]);

  const template = packet?.snapshot;
  const blocks = useMemo(
    () => (packet && template ? visibleBlocks(template, packet.enabledForms) : []),
    [packet, template],
  );
  const fields = useMemo(
    () => (packet && template ? recipientFields(template, packet.enabledForms) : []),
    [packet, template],
  );
  const groups = useMemo(
    () => (packet && template ? recipientCheckboxes(template, packet.enabledForms) : []),
    [packet, template],
  );
  const progress = useMemo(
    () =>
      packet && template
        ? packetProgress(template, packet.enabledForms, {
            ...values,
            ...(signature ? { __signature: "yes" } : {}),
          })
        : { required: 0, done: 0 },
    [packet, template, values, signature],
  );
  const problems = useMemo(
    () =>
      packet && template
        ? packetProblems(template, packet.enabledForms, {
            ...values,
            ...(signature ? { __signature: "yes" } : {}),
          })
        : [],
    [packet, template, values, signature],
  );

  async function handIn() {
    if (!packet) return;
    if (problems.length) {
      setError(problems[0]!);
      return;
    }
    if (!signature) {
      setError("Add your signature before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await submit({
        data: {
          id: packet.id,
          values,
          signature: { ...signature, name: signature.name || packet.recipientName },
        },
      });
      setDone({ completed: result.completed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit your signature.");
    } finally {
      setBusy(false);
    }
  }

  const wordmark = (
    <div className="flex items-center gap-2">
      <span className="text-lg font-extrabold text-white">
        Came Through <span style={{ color: BRAND.electric }}>Audio</span>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header style={{ background: BRAND.black }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-5 py-4">
          {wordmark}
          <span className="text-[9px] uppercase tracking-[3px]" style={{ color: BRAND.platinum }}>
            {TAGLINE}
          </span>
        </div>
        <div className="h-[3px]" style={{ background: BRAND.cobalt }} />
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {packet === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening your packet…
          </div>
        ) : !packet ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-lg font-bold">This signing link isn't valid.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the Came Through Audio team to send a fresh link.
            </p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BRAND.gold }}>
            <ShieldCheck className="mx-auto h-12 w-12" style={{ color: BRAND.gold }} />
            <h1 className="mt-3 text-2xl font-bold">Signed and submitted.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {done.completed
                ? "Came Through Audio has counter-signed this packet. The final PDF has gone to the admin inbox."
                : "Came Through Audio will counter-sign next, then send you and the admin the final PDF."}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {packet.title} · {packet.recipientName}
            </p>
          </div>
        ) : packet.status !== "sent" ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-lg font-bold">This packet is already signed.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {packet.status === "completed"
                ? "It is fully executed. Came Through Audio has the final copy."
                : "It is waiting on Came Through Audio's counter-signature."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[3px]"
                style={{ color: BRAND.cobalt }}
              >
                Signature needed
              </p>
              <h1 className="mt-1 text-3xl font-bold">{packet.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                For {packet.recipientName}. Review each form, fill in what applies to you, then sign
                once at the end.
              </p>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {progress.done} of {progress.required} required fields completed
                </span>
                <span className="text-muted-foreground">
                  {Math.round((progress.done / Math.max(1, progress.required)) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((progress.done / Math.max(1, progress.required)) * 100)}%`,
                    background: progress.done === progress.required ? BRAND.gold : BRAND.cobalt,
                  }}
                />
              </div>
            </div>

            {blocks.map((block) => {
              if (block.kind === "header") return null;
              if (block.kind === "section") {
                return (
                  <section key={block.id} className="pt-3">
                    <h2
                      className="border-b-2 pb-2 text-xl font-bold"
                      style={{ borderColor: BRAND.platinum }}
                    >
                      {block.title}
                    </h2>
                    {block.subtitle ? (
                      <p
                        className="mt-1 text-[10px] uppercase tracking-[2px]"
                        style={{ color: BRAND.cobalt }}
                      >
                        {block.subtitle}
                      </p>
                    ) : null}
                  </section>
                );
              }
              if (block.kind === "clause") {
                return (
                  <section key={block.id}>
                    <h3 className="font-semibold">{block.heading}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{block.body}</p>
                  </section>
                );
              }
              if (block.kind === "meta") {
                return (
                  <section key={block.id} className="rounded-lg border border-border p-3">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[2px]"
                      style={{ color: BRAND.cobalt }}
                    >
                      {block.heading}
                    </p>
                    <dl className="mt-2 space-y-1 text-sm">
                      {block.rows.map((row) => (
                        <div
                          key={row.id}
                          className="flex gap-3 border-b py-1 last:border-0"
                          style={{ borderColor: BRAND.platinum }}
                        >
                          <dt className="w-2/5 font-semibold">{row.label}</dt>
                          <dd className="min-w-0 flex-1">{values[row.id] ?? row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              }
              if (block.kind === "fields") {
                if (block.role === "admin") return null;
                return (
                  <section key={block.id} className="rounded-xl border border-border p-3">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[2px]"
                      style={{ color: BRAND.cobalt }}
                    >
                      {block.heading}
                    </p>
                    <div className="mt-2 space-y-3">
                      {block.fields
                        .filter((f) => f.role === "recipient")
                        .map((field) => (
                          <div key={field.id}>
                            <label htmlFor={`field-${field.id}`} className="text-sm font-medium">
                              {field.label}
                              {field.required ? (
                                <span style={{ color: BRAND.cobalt }}> *</span>
                              ) : null}
                            </label>
                            {field.type === "textarea" ? (
                              <textarea
                                id={`field-${field.id}`}
                                rows={3}
                                value={String(values[field.id] ?? "")}
                                onChange={(e) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm focus:outline-none"
                                style={{ outlineColor: BRAND.electric }}
                              />
                            ) : (
                              <input
                                id={`field-${field.id}`}
                                type={field.type === "date" ? "date" : "text"}
                                value={String(values[field.id] ?? "")}
                                onChange={(e) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.id]: e.target.value,
                                  }))
                                }
                                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                                style={{ outlineColor: BRAND.electric }}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </section>
                );
              }
              if (block.kind === "checkboxes") {
                if (block.role === "admin") return null;
                const chosen = new Set((values[block.id] as string[] | undefined) ?? []);
                return (
                  <section key={block.id} className="rounded-xl border border-border p-3">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[2px]"
                      style={{ color: BRAND.cobalt }}
                    >
                      {block.heading}
                      {block.required ? " *" : ""}
                    </p>
                    <div className="mt-2 space-y-2">
                      {block.options.map((option) => (
                        <label key={option.id} className="flex items-start gap-2 text-sm">
                          <input
                            type={block.mode === "single" ? "radio" : "checkbox"}
                            name={block.id}
                            checked={chosen.has(option.id)}
                            onChange={(e) =>
                              setValues((current) => {
                                const selected = new Set(
                                  (current[block.id] as string[] | undefined) ?? [],
                                );
                                if (block.mode === "single") {
                                  return {
                                    ...current,
                                    [block.id]: e.target.checked ? [option.id] : [],
                                  };
                                }
                                if (e.target.checked) selected.add(option.id);
                                else selected.delete(option.id);
                                return { ...current, [block.id]: [...selected] };
                              })
                            }
                            className="mt-0.5 h-4 w-4"
                            style={{ accentColor: BRAND.cobalt }}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              }
              if (block.kind === "signature") {
                if (block.noStamp) {
                  return (
                    <section
                      key={block.id}
                      className="rounded-xl border p-3"
                      style={{ borderColor: BRAND.platinum }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-[2px]"
                        style={{ color: BRAND.cobalt }}
                      >
                        {block.heading}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Signed separately on the printed copy, if a parent or guardian is required.
                      </p>
                    </section>
                  );
                }
                if (block.role === "admin") {
                  const signed = packet.adminSignature;
                  return (
                    <section
                      key={block.id}
                      className="rounded-xl border p-3"
                      style={{ borderColor: BRAND.platinum }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-[2px]"
                        style={{ color: BRAND.cobalt }}
                      >
                        {block.heading}
                      </p>
                      <p className="mt-1 text-sm">
                        {signed
                          ? `Signed by ${signed.name} on ${new Date(signed.signedAt).toLocaleDateString("en-GB")}.`
                          : "Came Through Audio signs after you submit."}
                      </p>
                    </section>
                  );
                }
                return null;
              }
              if (block.kind === "date") {
                return (
                  <section key={block.id}>
                    {block.label.trim() ? (
                      <p
                        className="text-[10px] font-bold uppercase tracking-[2px]"
                        style={{ color: BRAND.cobalt }}
                      >
                        {block.label}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-semibold">
                      {formatBlockDate(block) || "\u2014"}
                    </p>
                  </section>
                );
              }
              if (block.kind === "seal") return null;
              return null;
            })}

            <section
              className="rounded-xl border p-3"
              style={{ borderColor: signature ? BRAND.gold : BRAND.platinum }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[2px]"
                style={{ color: BRAND.cobalt }}
              >
                Your signature
              </p>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">
                One signature covers every recipient signature line. A parent/guardian line is
                signed separately on the printed copy.
              </p>
              <PdfSignaturePad
                value={signature}
                onChange={setSignature}
                label="Sign once"
                name={packet.recipientName}
              />
            </section>

            {error ? (
              <p className="rounded-lg border p-3 text-sm" style={{ borderColor: "#0b0b0b33" }}>
                {error}
              </p>
            ) : null}

            {problems.length ? (
              <ul className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                {problems.map((problem) => (
                  <li key={problem} className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {problem}
                  </li>
                ))}
              </ul>
            ) : null}

            <Button
              className="w-full"
              style={{ background: signature && !problems.length ? BRAND.cobalt : undefined }}
              disabled={busy || !signature || problems.length > 0}
              onClick={() => void handIn()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Check />} Submit &amp; sign document
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Submitting records your name, the time and the device you signed from on the audit
              certificate.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
