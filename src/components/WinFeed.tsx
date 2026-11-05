import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PartyPopper, Settings, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { listWins } from "@/lib/queue.functions";

const SOUND_KEY = "cta.winSound";
const read = (): boolean => { try { return localStorage.getItem(SOUND_KEY) === "on"; } catch { return false; } };
const write = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* storage blocked */ } };

/** A short rising cheer, made in the browser — no audio file to load or license. */
function playCheer() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  if (ctx.state === "suspended") { void ctx.close(); return; }
  [523, 659, 784].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = f;
    const t = ctx.currentTime + i * 0.1;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.26);
  });
  setTimeout(() => void ctx.close(), 1200);
}

const KIND_COPY: Record<string, string> = {
  task: "Task crossed off",
  ticket: "Support ticket answered",
  reg: "Registration finished",
};

const line = (actor: string, kind: string, title: string) => {
  if (kind === "ticket") return `🎉 ${actor} just resolved "${title}"`;
  if (kind === "reg") return `🎉 ${actor} just finished registering "${title}"`;
  return `🎉 ${actor} just finished "${title}"`;
};

/**
 * The team's win feed (founder, 2026-11-05). Every signed-in staff member gets this in the header: it polls the shared
 * feed and toasts anything new by someone else, with an optional cheer. The visual is always on — sound is the only
 * thing anyone can turn off, so the team keeps seeing what the team gets done.
 */
export function WinFeed({ me }: { me: string }) {
  const fetchWins = useServerFn(listWins);
  const q = useQuery({ queryKey: ["staff-wins"], queryFn: () => fetchWins(), refetchInterval: 12_000, refetchOnWindowFocus: true });
  const [sound, setSound] = useState<boolean>(read);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const wins = q.data;
    if (!wins) return;
    // The first load marks the history as read: opening Admin should not replay a morning of wins.
    if (seen.current === null) { seen.current = new Set(wins.map((w) => w.id)); return; }
    const fresh = wins.filter((w) => !seen.current!.has(w.id));
    if (!fresh.length) return;
    for (const w of fresh) seen.current.add(w.id);
    const latest = fresh.find((w) => w.userId !== me);
    if (!latest) return;
    toast(line(latest.actorName, latest.kind, latest.title), { description: KIND_COPY[latest.kind] ?? "Came Through", duration: 8000, icon: <PartyPopper className="h-4 w-4" /> });
    if (sound) playCheer();
  }, [q.data, me, sound]);

  const toggle = (on: boolean) => { setSound(on); write(on); if (on) playCheer(); };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Win notification settings" className="text-ink-muted hover:bg-ink-border hover:text-ink-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-sm font-bold">Team wins</p>
          <p className="text-xs text-muted-foreground">Everyone sees every finished task, so nobody has to ask what got done.</p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <Label htmlFor="win-sound" className="flex items-center gap-2 text-sm font-medium">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}Notification sound
          </Label>
          <Switch id="win-sound" checked={sound} onCheckedChange={toggle} />
        </div>
        <p className="text-xs text-muted-foreground">The pop-up itself is always on. Only the sound can be switched off.</p>
      </PopoverContent>
    </Popover>
  );
}
