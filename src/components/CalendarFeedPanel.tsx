import { useEffect, useState } from "react";
import { CalendarPlus, Copy, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmAction } from "@/components/ConfirmHost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The personal .ics feed (founder spec, 2026-11-19): one subscription URL per staff member, carrying their own entries,
 * their department calendars and the Task Bank deadlines they can see. The token is made here in the browser and kept in
 * `calendar_feed_tokens`, owner-only through RLS; the feed route resolves it with the service role.
 *
 * "New link" replaces the token in place, so a link that was shared by mistake stops working on the next refresh, and
 * "Turn off" removes it. Nothing here can widen what the feed carries: the route applies the same visibility rules the
 * calendar on this screen does.
 */
export function CalendarFeedPanel({ me }: { me: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  // The browser's own zone travels in the link, so an all-day entry stays on the day it was picked east of Greenwich.
  const timeZone =
    typeof Intl === "undefined" ? "" : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  const url =
    token && origin
      ? `${origin}/api/calendar/feed?token=${token}${timeZone ? `&tz=${encodeURIComponent(timeZone)}` : ""}`
      : "";

  async function load() {
    try {
      const { data, error } = await supabase
        .from("calendar_feed_tokens" as never)
        .select("token")
        .eq("user_id", me)
        .maybeSingle();
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setToken((data as { token?: string } | null)?.token ?? null);
    } catch {
      // A dropped request reads as a failed section, never as a page still loading.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 48 lowercase hex characters: the feed route's format, and long enough that a link cannot be guessed. */
  function newToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function create() {
    setBusy(true);
    try {
      const next = newToken();
      const { error } = await supabase
        .from("calendar_feed_tokens" as never)
        .insert({ user_id: me, token: next } as never);
      if (error) {
        toast.error("Couldn't create your feed link. Try again.");
        return;
      }
      setToken(next);
      toast.success("Your calendar feed is ready.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't create your feed link. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    const ok = await confirmAction({
      title: "Replace your calendar feed link?",
      text: "The old link stops working, and every calendar already subscribed to it goes quiet until you add the new one.",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = newToken();
      const { error } = await supabase
        .from("calendar_feed_tokens" as never)
        .update({ token: next } as never)
        .eq("user_id", me);
      if (error) {
        toast.error("Couldn't replace the link. Try again.");
        return;
      }
      setToken(next);
      toast.success("New feed link created. Add it to your calendar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't replace the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function off() {
    const ok = await confirmAction({
      title: "Turn off your calendar feed?",
      text: "The link stops working straight away. You can create a new one any time.",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("calendar_feed_tokens" as never)
        .delete()
        .eq("user_id", me);
      if (error) {
        toast.error("Couldn't turn the feed off. Try again.");
        return;
      }
      setToken(null);
      toast.success("Calendar feed turned off.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn the feed off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Feed link copied.");
    } catch {
      toast.error("Couldn't copy the link. Select it and copy it instead.");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <CalendarPlus className="h-4 w-4" />
            Personal calendar feed
          </h4>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Subscribe once and your own entries, your department calendars and your open Task Bank
            deadlines stay in sync. It only carries what you can see on this page.
          </p>
        </div>
        {!loading && !token && (
          <Button size="sm" disabled={busy || failed} onClick={() => void create()}>
            {busy ? "Creating…" : "Create feed link"}
          </Button>
        )}
      </div>

      {failed && (
        <p className="text-sm text-destructive">
          Your feed needs migration 20261119230000 before a link can be created.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Checking your feed link…</p>
      ) : token ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              readOnly
              aria-label="Your personal calendar feed link"
              value={url}
              className="min-w-0 flex-1 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void rotate()}>
              <RefreshCw className="h-4 w-4" />
              New link
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void off()}>
              <Power className="h-4 w-4" />
              Turn off
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Apple Calendar: File → New Calendar Subscription. Google Calendar: Other calendars →
            From URL. Outlook: Add calendar → Subscribe from web. All-day entries carry the date
            that was picked; the link's time zone ({timeZone || "UTC"}) covers an older entry saved
            before that date was stored. Anyone holding the link can read the feed, so keep it like
            a password — “New link” replaces it immediately.
          </p>
        </>
      ) : null}
    </section>
  );
}
