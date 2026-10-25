import { emailLayout, escapeHtml as esc, SITE_URL } from "./email-layout";
import { resendKey } from "./collab-trial.server";

/**
 * Release-day email (PLAN-pre-distribution §5, approved 2026-10-25): the morning a catalog song's release date arrives,
 * its owner gets one note for that song with the after-release steps. Run by the daily registration-reminders job.
 */
const FROM = "Came Through Audio <registrations@camethroughaudio.com>";

export async function sendReleaseDayEmails(today = new Date().toISOString().slice(0, 10)): Promise<{ released: number; sent: number }> {
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const key = resendKey();
  const { data } = await db.from("catalogs").select("id, user_id, track_title, details").eq("details->>releaseDate" as never, today);
  const songs = (data ?? []) as { id: string; user_id: string; track_title: string | null }[];
  if (!key) return { released: songs.length, sent: 0 };
  let sent = 0;
  for (const s of songs) {
    const { data: u } = await db.auth.admin.getUserById(s.user_id);
    const email = u.user?.email;
    if (!email) continue;
    const title = s.track_title || "Your song";
    const body = `<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#004AAD;margin:0">Release day</p>
<h1 style="font-size:24px;margin:8px 0 16px">"${esc(title)}" is out today</h1>
<p style="font-size:15px;line-height:1.6">Came Through Audio came through for ${esc(title)}. Two things to do now that it's released:</p>
<ol style="font-size:15px;line-height:1.6;padding-left:20px"><li>Register the recording with SoundExchange (it waits for release day).</li><li>Check that your PRO and The MLC found the song.</li></ol>
<a href="${SITE_URL}/workspace?tab=health" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open my Royalty Health Hub</a>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      // One per song: the key stops a second run on the same day from sending it again.
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `release-day-${s.id}-${today}` },
      body: JSON.stringify({ from: FROM, to: [email], subject: `"${title}" is out today: your next two steps`,
        html: emailLayout(body, { reason: `You're receiving this because "${title}" in your Came Through Audio catalog has today as its release date. It's a one-time note for this song.` }) }),
    });
    if (res.ok) sent++; else console.error(`Release-day email failed [${res.status}]: ${await res.text()}`);
  }
  return { released: songs.length, sent };
}
