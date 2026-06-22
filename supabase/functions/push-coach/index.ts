// Supabase Edge Function — sends a daily AI coaching push notification to every user
// who has notifications enabled and a registered Expo push token.
//
// Not user-invoked. Triggered on a schedule via pg_cron + pg_net (see deploy notes below).
// Requires the SERVICE ROLE key as the Authorization bearer — this is a privileged batch job,
// not something the anon key (shipped in the client bundle) should be able to trigger.
//
// Deploy:  supabase functions deploy push-coach
// Secret:  reuses ANTHROPIC_API_KEY already set for ai-coach (project-wide secret)
//
// Schedule (run once in the Supabase SQL editor — adjust the cron hour to your desired
// LOCAL send time converted to UTC, e.g. 3pm PT == 22:00 UTC / 23:00 UTC during DST,
// or 8:05pm SGT (UTC+8) == 12:05 UTC):
//
//   select cron.schedule(
//     'daily-coach-push',
//     '5 12 * * *',
//     $$
//     select net.http_post(
//       url := 'https://<project-ref>.functions.supabase.co/push-coach',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>',
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-6";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Date helpers (UTC-safe; mirrors src/utils/date.ts) ──────────────────────

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type HabitRow = {
  id: string;
  name: string;
  type: string;
  target_count: number;
  streak: number;
  best_streak: number;
  created_at: string;
};

type LogRow = { habit_id: string; date: string; count: number };

function habitStats(habit: HabitRow, logs: LogRow[], windowDays: number, todayStr: string) {
  const windowStart = addDays(todayStr, -(windowDays - 1));
  const createdDate = habit.created_at.slice(0, 10);
  const start = createdDate > windowStart ? createdDate : windowStart;
  const totalDays = Math.max(1, daysBetween(start, todayStr) + 1);
  let done = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const log = logs.find((l) => l.habit_id === habit.id && l.date === d);
    if (log && log.count >= habit.target_count) done++;
  }
  return { totalDays, done, completionPct: Math.round((done / totalDays) * 100) };
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text") as { text?: string } | undefined;
  return (block?.text ?? "").trim();
}

type PushTarget = { userId: string; pushToken: string; displayName: string | null };
type PushMessage = { to: string; title: string; body: string; sound: "default" };

// ── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: "Forbidden — this endpoint is for the scheduled job only" }, 403);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const todayStr = today();

    const { data: targets, error: targetsErr } = await supabase
      .from("user_settings")
      .select("user_id, display_name, push_token")
      .eq("notifications_enabled", true)
      .not("push_token", "is", null);
    if (targetsErr) throw targetsErr;
    if (!targets || targets.length === 0) return json({ sent: 0, message: "No push-eligible users." });

    const pushMessages: PushMessage[] = [];
    const nudgeRows: { user_id: string; message: string; source: "push" }[] = [];

    for (const t of targets as { user_id: string; display_name: string | null; push_token: string }[]) {
      const target: PushTarget = { userId: t.user_id, pushToken: t.push_token, displayName: t.display_name };

      const [{ data: habits }, { data: logs }] = await Promise.all([
        supabase.from("habits").select("*").eq("user_id", target.userId),
        supabase.from("habit_logs").select("habit_id, date, count").eq("user_id", target.userId),
      ]);
      if (!habits || habits.length === 0) continue; // nothing to coach on yet

      const stats = (habits as HabitRow[]).map((h) => ({
        name: h.name,
        type: h.type,
        currentStreak: h.streak,
        bestStreak: h.best_streak,
        last7Days: habitStats(h, (logs ?? []) as LogRow[], 7, todayStr),
        last14Days: habitStats(h, (logs ?? []) as LogRow[], 14, todayStr),
      }));

      try {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 200,
          system:
            "You are an encouraging, data-driven habit coach writing a push notification for the HabitFlow app. " +
            "Output EXACTLY two lines and nothing else: line 1 is a punchy title under 40 characters, line 2 is " +
            "the body under 140 characters. " +
            (target.displayName ? `Address the user by their first name, "${target.displayName.split(' ')[0]}". ` : '') +
            "Cite a specific number (a streak or completion %) for one habit going well, name one habit that's " +
            "slipping, and end with one quick, concrete suggestion for it. No markdown, no quotes, at most one emoji.",
          messages: [
            { role: "user", content: `Habit data (last 7 and 14 days):\n${JSON.stringify(stats, null, 2)}` },
          ],
        });

        const text = extractText(message);
        const [title, ...rest] = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const body = rest.join(" ") || title;
        if (!title) continue;

        pushMessages.push({ to: target.pushToken, title, body, sound: "default" });
        nudgeRows.push({ user_id: target.userId, message: `${title} — ${body}`, source: "push" });
      } catch (err) {
        console.error(`Claude generation failed for user ${target.userId}`, err);
      }
    }

    // Expo accepts up to 100 messages per request — chunk just in case.
    for (let i = 0; i < pushMessages.length; i += 100) {
      const chunk = pushMessages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) console.error("Expo push send failed", await res.text());
    }

    if (nudgeRows.length > 0) {
      const { error: insertErr } = await supabase.from("ai_nudges").insert(nudgeRows);
      if (insertErr) console.error("Failed to log push nudges", insertErr);
    }

    return json({ sent: pushMessages.length, eligible: targets.length });
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
