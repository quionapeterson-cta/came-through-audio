import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAccess } from "./departments";
import { registrationAuthorization } from "./contract-blueprints";
import { assistanceTotal } from "./plans";
import type { RegistrationOrder, RegistrationSong, SongStatus } from "./registration";

const purchaseInput = z.object({ purchaseId: z.string().uuid() });

/** The caller's own paid Expert Assistance purchase, or an error. */
async function ownPurchase(supabase: { from: (t: string) => any }, userId: string, purchaseId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await supabase.from("purchases").select("id, user_id, kind, details, created_at").eq("id", purchaseId).eq("user_id", userId).maybeSingle();
  const p = data as { id: string; user_id: string; kind: string; details: Record<string, string>; created_at: string } | null;
  if (!p || p.kind !== "expert") throw new Error("Registration order not found.");
  if (p.details["refunded_at"]) throw new Error("This order was refunded.");
  return p;
}

/** Creates the intake for an order paid before intake existed (or if the webhook couldn't), then returns it. */
export const ensureRegistrationOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => purchaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const p = await ownPurchase(context.supabase, context.userId, data.purchaseId);
    const { admin, startRegistration } = await import("./registration.server");
    await startRegistration(await admin(), p);
    return { ok: true };
  });

/** Links a paid song to one of the user's catalog songs: an uncataloged title once it's added, or a swap (§1, Q5). */
export const linkRegistrationSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ songId: z.string().uuid(), trackId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await import("./registration.server");
    const db = await admin();
    const { data: row } = await db.from("registration_songs" as never).select("id, purchase_id, user_id, submitted_at").eq("id", data.songId).maybeSingle();
    const song = row as { id: string; purchase_id: string; user_id: string; submitted_at: string | null } | null;
    if (!song || song.user_id !== context.userId) throw new Error("Song not found.");
    if (song.submitted_at) throw new Error("This song is already submitted. Ask us to unlock it if something needs fixing.");
    const { data: track } = await context.supabase.from("catalogs").select("id").eq("id", data.trackId).eq("user_id", context.userId).maybeSingle();
    if (!track) throw new Error("Pick a song from your catalog.");
    const { data: dupe } = await db.from("registration_songs" as never).select("id").eq("purchase_id", song.purchase_id).eq("track_id", data.trackId).neq("id", song.id).limit(1);
    if ((dupe ?? []).length) throw new Error("That song is already in this order.");
    const { error } = await db.from("registration_songs" as never).update({ track_id: data.trackId, updated_at: new Date().toISOString() } as never).eq("id", song.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Submit for registration (§3 step 3): re-checks every paid song on the server with the shared readiness module, then
 * saves a registration copy of each so later catalog edits don't change what the agent registers. Work starts here.
 */
export const submitRegistrationSongs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => purchaseInput.parse(d))
  .handler(async ({ data, context }) => {
    await ownPurchase(context.supabase, context.userId, data.purchaseId);
    const { admin, loadOrder } = await import("./registration.server");
    const db = await admin();
    const loaded = await loadOrder(db, data.purchaseId);
    if (!loaded) throw new Error("Registration order not found.");
    const blocked = loaded.checks.filter((c) => !c.song.submitted_at && (c.needsCatalog || c.missing.length));
    if (blocked.length) throw new Error(`Finish ${blocked.map((c) => `"${c.title}"`).join(", ")} first.`);
    const now = new Date().toISOString();
    const status = Object.fromEntries(loaded.order.agencies.map((a) => [a, "pending"]));
    for (const c of loaded.checks.filter((x) => !x.song.submitted_at)) {
      const { error } = await db.from("registration_songs" as never).update({ snapshot: c.metadata, submitted_at: now, status, updated_at: now } as never).eq("id", c.song.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Signs the Registration Authorization (§6). The text is built and hashed here, never taken from the browser. */
export const signRegistrationAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => purchaseInput.extend({ legalName: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await ownPurchase(context.supabase, context.userId, data.purchaseId);
    const { admin, loadOrder } = await import("./registration.server");
    const db = await admin();
    const loaded = await loadOrder(db, data.purchaseId);
    if (!loaded) throw new Error("Registration order not found.");
    if (loaded.order.agreement_signed_at) return { ok: true };
    if (loaded.checks.some((c) => !c.song.submitted_at)) throw new Error("Submit every song first.");
    const body = agreementFor(loaded.order, loaded.checks.map((c) => c.metadata), p, data.legalName);
    const now = new Date().toISOString();
    const { error } = await db.from("registration_orders" as never).update({
      agreement_body: body, agreement_hash: createHash("sha256").update(body, "utf8").digest("hex"), agreement_name: data.legalName, agreement_signed_at: now, updated_at: now,
    } as never).eq("purchase_id", data.purchaseId).is("agreement_signed_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The agreement as it will read for this order (shown before signing; the signed copy is the stored one). */
export const previewRegistrationAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => purchaseInput.extend({ legalName: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await ownPurchase(context.supabase, context.userId, data.purchaseId);
    const { admin, loadOrder } = await import("./registration.server");
    const loaded = await loadOrder(await admin(), data.purchaseId);
    if (!loaded) throw new Error("Registration order not found.");
    return { body: loaded.order.agreement_body ?? agreementFor(loaded.order, loaded.checks.map((c) => c.metadata), p, data.legalName.trim() || "[Your legal name]") };
  });

function agreementFor(o: RegistrationOrder, songs: ({ title: string; isrc: string } | null)[], p: { created_at: string; details: Record<string, string> }, client: string) {
  const day = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const n = songs.length;
  const amount = assistanceTotal(p.details["type"] === "album" ? "album" : "single", n, o.agencies.length);
  return registrationAuthorization({
    effectiveDate: day(new Date()),
    client,
    // The site is pre-launch while the passcode gate is on.
    prelaunch: !!process.env["SITE_PASSWORD"],
    songs: songs.map((s) => ({ title: s?.title || "Untitled", isrc: s?.isrc ?? "" })),
    agencies: o.agencies,
    purchasedOn: day(p.created_at),
    amount: `$${amount.toFixed(2)}`,
  });
}

/** The user added Came Through Audio as their representative at one agency (§3 step 5). */
export const confirmRegistrationAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => purchaseInput.extend({ agency: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await ownPurchase(context.supabase, context.userId, data.purchaseId);
    const { admin } = await import("./registration.server");
    const db = await admin();
    const { data: row } = await db.from("registration_orders" as never).select("agencies, access_confirmed, agreement_signed_at").eq("purchase_id", data.purchaseId).maybeSingle();
    const o = row as Pick<RegistrationOrder, "agencies" | "access_confirmed" | "agreement_signed_at"> | null;
    if (!o || !o.agencies.includes(data.agency)) throw new Error("That agency isn't in this order.");
    if (!o.agreement_signed_at) throw new Error("Sign the Registration Authorization first.");
    const { error } = await db.from("registration_orders" as never).update({ access_confirmed: { ...o.access_confirmed, [data.agency]: new Date().toISOString() }, updated_at: new Date().toISOString() } as never).eq("purchase_id", data.purchaseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Staff: Admin → Registrations ─────────────────────────────────────────────

async function requireRegistrationStaff(context: { supabase: any; userId: string }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await context.supabase.from("user_roles").select("role, departments").eq("user_id", context.userId);
  const access = resolveAccess(data ?? []);
  if (!access || !access.departments.includes("registration")) throw new Error("Forbidden");
}

export type QueueSong = { id: string; title: string; submitted: boolean; status: Record<string, SongStatus>; snapshot: RegistrationSong["snapshot"]; trackId: string | null; ready: boolean };
export type QueueOrder = {
  purchaseId: string; customer: string; email: string | null; agencies: string[]; createdAt: string; signedAt: string | null;
  access: Record<string, string>; songs: QueueSong[]; state: "Waiting on customer" | "Ready to register" | "In progress" | "Registered"; stale: boolean;
};

/** Every paid order with its songs, the submitted copies and where each one stands, oldest first. */
export const listRegistrationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueueOrder[]> => {
    await requireRegistrationStaff(context);
    const { admin, loadOrder } = await import("./registration.server");
    const db = await admin();
    const { data } = await db.from("registration_orders" as never).select("purchase_id, user_id").order("created_at").limit(200);
    const rows = (data ?? []) as { purchase_id: string; user_id: string }[];
    const out: QueueOrder[] = [];
    for (const r of rows) {
      const [loaded, { data: prof }, { data: u }] = await Promise.all([
        loadOrder(db, r.purchase_id),
        db.from("profiles").select("stage_name, legal_name").eq("id", r.user_id).maybeSingle(),
        db.auth.admin.getUserById(r.user_id),
      ]);
      if (!loaded) continue;
      const o = loaded.order;
      const songs = loaded.checks.map((c) => ({
        id: c.song.id, title: c.title, submitted: !!c.song.submitted_at, status: c.song.status, snapshot: c.song.snapshot, trackId: c.song.track_id,
        // Re-checked on the server against the submitted copy, never trusted from the browser.
        ready: !!c.song.submitted_at && !!c.song.snapshot && !c.missing.length,
      }));
      const allIn = songs.length > 0 && songs.every((s) => s.submitted) && !!o.agreement_signed_at && o.agencies.every((a) => o.access_confirmed[a]);
      const statuses = songs.flatMap((s) => o.agencies.map((a) => s.status[a]));
      const state = !allIn ? "Waiting on customer" : statuses.every((s) => s === "registered") ? "Registered" : statuses.some((s) => s === "in_progress" || s === "registered") ? "In progress" : "Ready to register";
      const submittedAt = loaded.checks.map((c) => c.song.submitted_at).filter(Boolean).sort()[0];
      out.push({
        purchaseId: o.purchase_id, customer: prof?.stage_name || prof?.legal_name || "—", email: u.user?.email ?? null, agencies: o.agencies, createdAt: o.created_at,
        signedAt: o.agreement_signed_at, access: o.access_confirmed, songs, state,
        // Internal target only, never shown to users (§3 step 6).
        stale: state !== "Registered" && !!submittedAt && Date.parse(submittedAt) < Date.now() - 30 * 86400000,
      });
    }
    return out;
  });

/** Moves one song at one agency along Pending → In progress → Registered; emails the user once an agency is all filed. */
export const setRegistrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ songId: z.string().uuid(), agency: z.string().max(60), status: z.enum(["pending", "in_progress", "registered"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRegistrationStaff(context);
    const { admin, sendFiledEmail } = await import("./registration.server");
    const db = await admin();
    const { data: row } = await db.from("registration_songs" as never).select("purchase_id, status, submitted_at").eq("id", data.songId).maybeSingle();
    const song = row as { purchase_id: string; status: Record<string, SongStatus>; submitted_at: string | null } | null;
    if (!song?.submitted_at) throw new Error("This song hasn't been submitted.");
    const { error } = await db.from("registration_songs" as never).update({ status: { ...song.status, [data.agency]: data.status }, updated_at: new Date().toISOString() } as never).eq("id", data.songId);
    if (error) throw new Error(error.message);
    if (data.status === "registered") await sendFiledEmail(db, song.purchase_id, data.agency);
    return { ok: true };
  });

/** Lets the customer fix a submitted song: clears its registration copy so it goes back through the check. */
export const unlockRegistrationSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ songId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRegistrationStaff(context);
    const { admin } = await import("./registration.server");
    const { error } = await (await admin()).from("registration_songs" as never).update({ snapshot: null, submitted_at: null, status: {}, updated_at: new Date().toISOString() } as never).eq("id", data.songId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

