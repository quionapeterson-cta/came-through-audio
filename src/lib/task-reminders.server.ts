import { ADMIN_EMAIL, emailLayout, escapeHtml, SITE_URL } from "./email-layout";

type Due = { id: string; title: string; department: string; due_at: string; owner_id: string | null; reminders_sent: string[] };
const HOUR = 3600_000;

/**
 * Hourly: emails the owner of each open Top priority task 24 hours and 1 hour before its deadline (each once). A task
 * with no owner goes to everyone in its department. Returns counts only.
 */
export async function sendDueTaskReminders(now = new Date()) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const key = process.env["RESEND_API_KEY"] || process.env["CameThroughAudio"];
  const { data } = await db.from("department_tasks" as never).select("id, title, department, due_at, owner_id, reminders_sent")
    .eq("importance", "top").neq("status", "done").not("due_at", "is", null).lte("due_at", new Date(now.getTime() + 24 * HOUR).toISOString());
  let sent = 0;
  for (const t of (data ?? []) as unknown as Due[]) {
    const left = new Date(t.due_at).getTime() - now.getTime();
    const mark = left <= HOUR ? "1h" : "24h";
    if (t.reminders_sent.includes(mark) || left < -HOUR) continue;
    const ids = t.owner_id ? [t.owner_id]
      : (((await db.from("user_roles").select("user_id").contains("departments", [t.department])).data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    const emails = (await Promise.all([...new Set(ids)].map((id) => db.auth.admin.getUserById(id).then((r) => r.data.user?.email)))).filter((e): e is string => !!e);
    if (key && emails.length) {
      const when = new Date(t.due_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
      const html = emailLayout(`<p style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b42318;margin:0">Top priority · due ${mark === "1h" ? "within the hour" : "within 24 hours"}</p>
<h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(t.title)}</h1>
<p style="font-size:15px;line-height:1.6">Deadline: <b>${escapeHtml(when)} (Eastern)</b></p>
<p><a href="${SITE_URL}/admin" style="display:inline-block;background:#004AAD;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open the task</a></p>`,
        { reason: "You're receiving this because a Top priority task in your Came Through Audio department is due soon." });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `task-${t.id}-${mark}` },
        body: JSON.stringify({ from: `Came Through Audio <${ADMIN_EMAIL}>`, to: emails, subject: `Top priority due ${mark === "1h" ? "within the hour" : "in 24 hours"}: ${t.title}`, html }),
      }).catch((e) => console.error("Task reminder failed", e));
      sent++;
    }
    await db.from("department_tasks" as never).update({ reminders_sent: [...t.reminders_sent, mark] } as never).eq("id", t.id);
  }
  return { checked: (data ?? []).length, sent };
}
