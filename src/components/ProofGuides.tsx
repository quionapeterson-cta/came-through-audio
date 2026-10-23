import { useState } from "react";

type AppId = "apple" | "keep" | "samsung" | "memos" | "files";

const APPS: { id: AppId; label: string; title: string; gesture: string; steps: string[] }[] = [
  { id: "apple", label: "Apple Notes", title: "Apple Notes — Pull down from top to show timestamp", gesture: "Gesture: Pull down to reveal timestamp — Show both in 1 video",
    steps: ["Open note with lyrics", "Pull down slightly from top to reveal old timestamp — hold 3 seconds", "Tap inside note + hit Enter to create new current draft date", "Pull down again — now old + new timestamp both in same video"] },
  { id: "keep", label: "Google Keep", title: "Google Keep — Tap 3 dots, then Show info", gesture: "Gesture: Tap 3 dots > Show info — Show both in 1 video",
    steps: ["Open note", "Tap 3 dots > Show info = old edited time", "Make edit > Show new edited time — both in same recording"] },
  { id: "samsung", label: "Samsung Notes", title: "Samsung Notes — 3 dots, then View details", gesture: "Gesture: Tap 3 dots > View details — Show both in 1 video",
    steps: ["Open note > 3 dots > View details > Show modified date", "Edit > Show new date"] },
  { id: "memos", label: "Voice Memos", title: "Voice Memos — Scroll the list to show old and new dates", gesture: "Gesture: Scroll the list — Show both in 1 video",
    steps: ["Scroll list showing old date (e.g. Jan 10)", "Scroll to new memo today — both visible in same recording"] },
  { id: "files", label: "Files / Folder", title: "Files / Folder — Show file dates in your folder", gesture: "Gesture: Open folder — Show both in 1 video",
    steps: ["Open Files app > Show folder with old file date > Show new file date in same video"] },
];

const css = `
@keyframes pg-pull{0%,10%{transform:translateY(0)}35%,85%{transform:translateY(40px)}100%{transform:translateY(0)}}
@keyframes pg-fade1{0%,25%{opacity:0;transform:translateY(-8px)}40%,90%{opacity:1;transform:none}100%{opacity:0}}
@keyframes pg-fade2{0%,50%{opacity:0;transform:translateY(-8px)}62%,90%{opacity:1;transform:none}100%{opacity:0}}
@keyframes pg-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
@keyframes pg-menu{0%,20%{opacity:0;transform:scaleY(0)}35%,90%{opacity:1;transform:scaleY(1)}100%{opacity:0}}
@keyframes pg-scroll{0%,15%{transform:translateY(0)}55%,90%{transform:translateY(-56px)}100%{transform:translateY(0)}}
@keyframes pg-tap{0%,15%{opacity:0}25%,35%{opacity:1;transform:scale(.85)}45%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.pg-anim *{animation:none!important;opacity:1!important}}
`;

function Finger({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className="absolute h-8 w-8 text-primary drop-shadow" style={style} fill="currentColor" aria-hidden>
      <path d="M9 2a2 2 0 0 1 2 2v7h1V9a2 2 0 1 1 4 0v2h.5a2 2 0 0 1 2 2v1a2 2 0 0 1 1.5 1.9V18a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.3-3.2L4.2 16a2 2 0 0 1 3-2.6L7 13V4a2 2 0 0 1 2-2z" />
    </svg>
  );
}

const loop = (name: string, extra = "") => ({ animation: `${name} 3s ease-in-out infinite ${extra}` });

function Stamp({ text, anim }: { text: string; anim: string }) {
  return <div className="rounded bg-muted px-2 py-1 text-center text-[11px] font-semibold text-foreground" style={loop(anim)}>{text}</div>;
}

function Animation({ id }: { id: AppId }) {
  const card = "relative mx-auto h-[150px] w-[220px] overflow-hidden rounded-lg border border-border bg-background p-3 shadow-sm";
  const lines = <div className="mt-2 space-y-1.5">{[90, 70, 80, 55].map((w) => <div key={w} className="h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />)}</div>;
  if (id === "apple") return (
    <div className={card}>
      <div className="space-y-1"><Stamp text="Edited Jan 10, 2025 at 2:34 PM" anim="pg-fade1" /><Stamp text="Edited Today at 3:12 PM" anim="pg-fade2" /></div>
      <div style={loop("pg-pull")}>{lines}</div>
      <Finger style={{ top: 0, left: "45%", ...loop("pg-pull") }} />
    </div>
  );
  if (id === "keep" || id === "samsung") return (
    <div className={card}>
      <div className="flex justify-end"><span className="text-lg font-bold leading-none text-primary" style={loop("pg-pulse")}>⋮</span></div>
      {lines}
      <div className="absolute right-3 top-8 origin-top space-y-1 rounded border border-border bg-card p-2 text-[11px] shadow" style={loop("pg-menu")}>
        <p className="font-semibold">{id === "keep" ? "Show info" : "View details"}</p>
        <p style={loop("pg-fade2")}>{id === "keep" ? "Edited Jan 10 • Edited Today" : "Modified Jan 10 • Modified Today"}</p>
      </div>
      <Finger style={{ top: 4, right: 0, ...loop("pg-tap") }} />
    </div>
  );
  const rows = id === "memos" ? ["Idea — Jan 10", "Rough take — Jan 15", "Hook redo — Feb 2", "Final take — Today"] : ["song_idea.m4a · Jan 10", "verse_v2.mp3 · Jan 15", "mix_v3.mp3 · Feb 2", "final_song.mp3 · Today"];
  return (
    <div className={card}>
      <div style={loop("pg-scroll")} className="space-y-2">
        {rows.map((r) => <div key={r} className="flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-[11px] font-medium"><span className={`cta-icon !h-4 !w-4 ${id === "files" ? "cta-catalog" : "cta-mic"}`} aria-hidden /> {r}</div>)}
      </div>
      <Finger style={{ bottom: 6, right: 20, ...loop("pg-scroll") }} />
    </div>
  );
}

export function NoteGuide() {
  const [app, setApp] = useState<AppId>("apple");
  const a = APPS.find((x) => x.id === app)!;
  return (
    <div className="pg-anim space-y-3 rounded-lg border border-border p-3">
      <style>{css}</style>
      <div className="flex flex-wrap gap-2">
        {APPS.map((x) => (
          <button key={x.id} type="button" onClick={() => setApp(x.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${app === x.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold">{a.title}</p>
      <div className="flex h-[200px] items-center rounded-xl bg-muted/60"><Animation key={app} id={app} /></div>
      <p className="text-center text-xs text-muted-foreground">{a.gesture}</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs">{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="text-xs font-semibold text-primary">Tip: show your oldest draft and your newest draft, with their dates on screen, in one video. Drafts days or weeks apart are your strongest evidence.</p>
    </div>
  );
}

export function RecordGuide() {
  return (
    <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
      <p className="font-semibold">How to record</p>
      <details className="rounded-md border border-border p-2"><summary className="cursor-pointer font-medium">iPhone</summary>
        <p className="mt-2 text-xs">Settings &gt; Control Center &gt; Add Screen Recording &gt; Open project/note &gt; Long-press record &gt; Mic ON &gt; Start &gt; DAW: Solo tracks then play full mix / Draft: Show old timestamp + new timestamp in same video &gt; Stop via red bar &gt; Upload from Photos</p>
      </details>
      <details className="rounded-md border border-border p-2"><summary className="cursor-pointer font-medium">Android</summary>
        <p className="mt-2 text-xs">Swipe down twice &gt; Screen Record &gt; Record audio ON &gt; Start &gt; Same actions &gt; Stop &gt; Upload from Gallery</p>
      </details>
    </div>
  );
}
