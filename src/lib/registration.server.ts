import { fromCatalogRow } from "@/lib/catalog";
import { emailLayout, escapeHtml as esc, SITE_URL } from "./email-layout";
import { resendKey } from "./collab-trial.server";
import { missingFor, orderAgencies, orderSongsOf, type RegistrationOrder, type RegistrationSong } from "./registration";
import type { Metadata } from "./metadata";

// Service-role client (bypasses RLS); only ever used inside server functions and routes.
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const FROM = "Came Through Audio <registrations@camethroughaudio.com>";
const DAY = 86400000;

export const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** One song's readiness in an order: the catalog song it's linked to, or "add it to My Catalog first". */
export type SongCheck = { song: RegistrationSong; title: string; metadata: Metadata | null; needsCatalog: boolean; missing: ReturnType<typeof missingFor> };

/** Loads an order with its songs and checks every unsubmitted song against the order's agencies (shared readiness module). */
export async function loadOrder(db: Admin, purchaseId: string) {
  const [{ data: order }, { data: songRows }] = await Promise.all([
    db.from("registration_orders" as never).select("*").eq("purchase_id", purchaseId).maybeSingle(),
    db.from("registration_songs" as never).select("*").eq("purchase_id", purchaseId).order("position"),
  ]);
  const o = order as RegistrationOrder | null;
  if (!o) return null;
  const songs = (songRows ?? []) as RegistrationSong[];
  const ids = songs.map((s) => s.track_id).filter((x): x is string => !!x);
  const { data: rows } = ids.length ? await db.from("catalogs").select("*").in("id", ids).eq("user_id", o.user_id) : { data: [] };
  const tracks = new Map((rows ?? []).map((r) => { const t = fromCatalogRow(r as Record<string, unknown>); return [t.id, t]; }));
  const targets = orderAgencies(o.agencies);
  const checks: SongCheck[] = songs.map((song) => {
    const t = song.track_id ? tracks.get(song.track_id) : undefined;
    const metadata = song.snapshot ?? t?.metadata ?? null;
    const title = metadata?.title || song.pending_title || "Untitled";
    if (song.submitted_at || !metadata) return { song, title, metadata, needsCatalog: !metadata, missing: [] };
    return { song, title, metadata, needsCatalog: false, missing: missingFor(metadata, targets) };
  });
  return { order: o, checks };
}

/**
 * Creates the intake for a paid Expert Assistance purchase (once), then checks every song and alerts the user
 * straight away (PLAN-registration-intake §3 step 2). Called by the payment webhook; safe to call again.
 */
export async function startRegistration(db: Admin, purchase: { id: string; user_id: string; details: Record<string, string> }) {
  const { data: existing } = await db.from("registration_orders" as never).select("purchase_id").eq("purchase_id", purchase.id).maybeSingle();
  if (existing) return;
  const agencies = (purchase.details["agencies"] ?? "").split(" | ").filter(Boolean);
  const { error } = await db.from("registration_orders" as never).insert({ purchase_id: purchase.id, user_id: purchase.user_id, agencies } as never);
  if (error) { if (error.code === "23505") return; throw error; }
  const { trackIds, newSongs } = orderSongsOf(purchase.details);
  // Older orders (a song count, no picked songs) start as typed placeholders the user links to catalog songs.
  const placeholders = Math.max(0, Number(purchase.details["songs"] ?? 0) - trackIds.length - newSongs.length);
  const rows = [
    ...trackIds.map((track_id) => ({ track_id })),
    ...newSongs.map((s) => ({ pending_title: s.title.slice(0, 200), pending_artist: s.artist.slice(0, 200) })),
    ...Array.from({ length: placeholders }, () => ({})),
  ].map((r, position) => ({ ...r, position, purchase_id: purchase.id, user_id: purchase.user_id }));
  if (rows.length) {
    const { error: songErr } = await db.from("registration_songs" as never).insert(rows as never);
    if (songErr) throw songErr;
  }
  await sendReadinessEmail(db, purchase.id, "alert");
}

async function emailOf(db: Admin, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** "N of M songs need a few details" right after payment, or the reminder. Returns false when nothing was sent. */
export async function sendReadinessEmail(db: Admin, purchaseId: string, kind: "alert" | "reminder"): Promise<boolean> {
  const loaded = await loadOrder(db, purchaseId);
  const key = resendKey();
  if (!loaded || !key) return false;
  const pending = loaded.checks.filter((c) => !c.song.submitted_at);
  const todo = pending.filter((c) => c.needsCatalog || c.missing.length);
  if (kind === "reminder" && !todo.length) return false;
  const email = await emailOf(db, loaded.order.user_id);
  if (!email) return false;
  const link = `${SITE_URL}/workspace?tab=health&view=expert`;
  const total = loaded.checks.length;
  const heading = todo.length
    ? `${todo.length} of ${total} song${total === 1 ? "" : "s"} need${todo.length === 1 ? "s" : ""} a few details before our agents can register ${todo.length === 1 ? "it" : "them"}`
    : `All ${total} song${total === 1 ? " is" : "s are"} ready ✓`;
  const list = todo.map((c) => `<li style="margin:0 0 12px"><b>${esc(c.title)}</b><ul style="margin:4px 0 0;padding-left:18px">${c.needsCatalog ? "<li>⚠️ Add this song to My Catalog.</li>" : ""}${c.missing.map((m) =>
    `<li>⚠️ ${esc(m.message)}${m.agencies.length ? ` <span style="color:#666">(${esc(m.agencies.join(", "))})</span>` : ""}</li>`).join("")}</ul></li>`).join("");
  const body = `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Expert Registration Assistance</p>
<h1 style="font-size:24px;margin:8px 0 16px">${esc(heading)}</h1>
${todo.length ? `<p style="font-size:15px;line-height:1.6">Here's exactly what to add. Each song turns ✓ as soon as you save it in My Catalog, so there's nothing to re-send.</p><ul style="font-size:14px;line-height:1.6;padding-left:18px">${list}</ul>
<p style="font-size:13px;line-height:1.6;color:#555">Your 30-day refund window keeps running until you submit your songs.</p>`
    : `<p style="font-size:15px;line-height:1.6">Next, confirm and submit your songs so our agents can start.</p>`}
<a href="${link}" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open my registration checklist</a>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `registration-${kind}-${purchaseId}-${new Date().toISOString().slice(0, 10)}` },
    body: JSON.stringify({ from: FROM, to: [email], subject: todo.length ? "A few details before we register your songs" : "Your songs are ready to submit", html: emailLayout(body, { reason: "You're receiving this because you bought Expert Registration Assistance from Came Through Audio." }) }),
  });
  if (!res.ok) { console.error(`Registration email failed [${res.status}]: ${await res.text()}`); return false; }
  await db.from("registration_orders" as never).update({ [kind === "alert" ? "alerted_at" : "reminded_at"]: new Date().toISOString() } as never).eq("purchase_id", purchaseId);
  return true;
}

/** Cron: reminders 3 days after payment, then weekly, while any song still needs details (stops once all are ready). */
export async function sendDueRegistrationReminders(): Promise<{ scanned: number; sent: number }> {
  const db = await admin();
  const { data } = await db.from("registration_orders" as never).select("purchase_id, created_at, reminded_at").lte("created_at", new Date(Date.now() - 3 * DAY).toISOString());
  const due = ((data ?? []) as { purchase_id: string; reminded_at: string | null }[]).filter((o) => !o.reminded_at || Date.parse(o.reminded_at) <= Date.now() - 7 * DAY);
  let sent = 0;
  for (const o of due) {
    const { data: p } = await db.from("purchases").select("details").eq("id", o.purchase_id).maybeSingle();
    if ((p?.details as Record<string, string> | undefined)?.["refunded_at"]) continue;
    if (await sendReadinessEmail(db, o.purchase_id, "reminder")) sent++;
  }
  return { scanned: due.length, sent };
}

/** "Your songs are filed with {agency}", once every song in the order is Registered there. */
export async function sendFiledEmail(db: Admin, purchaseId: string, agency: string) {
  const loaded = await loadOrder(db, purchaseId);
  const key = resendKey();
  if (!loaded || !key || !loaded.checks.every((c) => c.song.status[agency] === "registered")) return;
  const email = await emailOf(db, loaded.order.user_id);
  if (!email) return;
  const body = `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Expert Registration Assistance</p>
<h1 style="font-size:24px;margin:8px 0 16px">Came Through Audio came through: your songs are filed with ${esc(agency)}</h1>
<ul style="font-size:14px;line-height:1.6;padding-left:18px">${loaded.checks.map((c) => `<li>${esc(c.title)}</li>`).join("")}</ul>
<p style="font-size:15px;line-height:1.6">${esc(agency)} reviews each registration on its own schedule. When our work for this account is done, you can remove Came Through Audio's access there.</p>
<a href="${SITE_URL}/workspace?tab=health&view=expert" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">See my registrations</a>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `registration-filed-${purchaseId}-${agency}` },
    body: JSON.stringify({ from: FROM, to: [email], subject: `Your songs are filed with ${agency}`, html: emailLayout(body, { reason: "You're receiving this because you bought Expert Registration Assistance from Came Through Audio." }) }),
  });
  if (!res.ok) console.error(`Filed email failed [${res.status}]: ${await res.text()}`);
}
