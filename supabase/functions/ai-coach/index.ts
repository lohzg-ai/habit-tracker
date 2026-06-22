// Supabase Edge Function — AI coaching nudges + weekly/monthly reports.
// Calls Claude (Anthropic SDK) with the caller's habit/log data and persists the result.
//
// Deploy:   supabase functions deploy ai-coach
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Invoked from the app via supabase.functions.invoke('ai-coach', { body: { action, periodType } }).
// The client's session JWT is forwarded automatically and used to scope all queries via RLS.

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-6";
const MIN_INTERVAL_MS = 60_000; // one AI call per user per minute, across nudge + report

// Set the ALLOWED_ORIGINS secret to a comma-separated list of your web app's
// deployed origin(s), e.g. "https://habitflow.app,http://localhost:8081".
// Native (iOS/Android) requests don't send an Origin header, so they're unaffected.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

// ── Stats ─────────────────────────────────────────────────────────────────

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

// ── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401, corsHeaders);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401, corsHeaders);
    const userId = userData.user.id;

    // Rate-limit: each AI call costs a real Claude API request, so cap how often
    // a single user can trigger one regardless of which action they call.
    const [{ data: lastNudge }, { data: lastReport }] = await Promise.all([
      supabase.from("ai_nudges").select("created_at").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_reports").select("created_at").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const lastCallAt = [lastNudge?.created_at, lastReport?.created_at]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime())
      .sort((a, b) => b - a)[0];
    if (lastCallAt && Date.now() - lastCallAt < MIN_INTERVAL_MS) {
      return json({ error: "Please wait a bit before requesting another AI insight." }, 429, corsHeaders);
    }

    const { action, periodType } = await req.json();

    const [{ data: habits, error: habitsErr }, { data: logs, error: logsErr }] = await Promise.all([
      supabase.from("habits").select("*").eq("user_id", userId),
      supabase.from("habit_logs").select("habit_id, date, count").eq("user_id", userId),
    ]);
    if (habitsErr) throw habitsErr;
    if (logsErr) throw logsErr;
    if (!habits || habits.length === 0) {
      return json({ error: "Add at least one habit before generating insights." }, 400, corsHeaders);
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const todayStr = today();

    if (action === "nudge") {
      const stats = (habits as HabitRow[]).map((h) => ({
        name: h.name,
        type: h.type,
        currentStreak: h.streak,
        bestStreak: h.best_streak,
        last7Days: habitStats(h, logs as LogRow[], 7, todayStr),
        last14Days: habitStats(h, logs as LogRow[], 14, todayStr),
      }));

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 300,
        system:
          "You are an encouraging, data-driven habit coach inside the HabitFlow app. Write ONE short nudge " +
          "(2-4 sentences, under 400 characters) based on the user's real habit data. Cite specific numbers " +
          "for one habit going well (streak or completion %) and one habit that's slipping, then give one " +
          "concrete, actionable tip for the slipping habit. No generic praise, no markdown, at most one emoji.",
        messages: [
          { role: "user", content: `Habit data (last 7 and 14 days):\n${JSON.stringify(stats, null, 2)}` },
        ],
      });

      const text = extractText(message);
      const { data: inserted, error: insertErr } = await supabase
        .from("ai_nudges")
        .insert({ user_id: userId, message: text })
        .select()
        .single();
      if (insertErr) throw insertErr;

      return json(
        { id: inserted.id, message: inserted.message, createdAt: inserted.created_at },
        200,
        corsHeaders,
      );
    }

    if (action === "report") {
      if (periodType !== "weekly" && periodType !== "monthly") {
        return json({ error: "periodType must be 'weekly' or 'monthly'" }, 400, corsHeaders);
      }
      const windowDays = periodType === "monthly" ? 30 : 7;
      const periodStart = addDays(todayStr, -(windowDays - 1));

      const stats = (habits as HabitRow[]).map((h) => ({
        name: h.name,
        type: h.type,
        ...habitStats(h, logs as LogRow[], windowDays, todayStr),
      }));

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 500,
        system:
          `You are a habit-data analyst inside the HabitFlow app. Write a concise ${periodType} report ` +
          "(3-5 sentences, no markdown, no headers) covering: the most consistent habit and its completion " +
          "percentage, any habit that was notably inconsistent or dropped off mid-period with specifics, and " +
          "one practical observation or suggestion. Use only the exact numbers provided — never invent data.",
        messages: [
          {
            role: "user",
            content: `Habit completion data for the ${periodType} period (${periodStart} to ${todayStr}):\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
      });

      const text = extractText(message);
      const { data: inserted, error: insertErr } = await supabase
        .from("ai_reports")
        .upsert(
          { user_id: userId, period_type: periodType, period_start: periodStart, period_end: todayStr, summary: text },
          { onConflict: "user_id,period_type,period_start" },
        )
        .select()
        .single();
      if (insertErr) throw insertErr;

      return json(
        {
          id: inserted.id,
          periodType: inserted.period_type,
          periodStart: inserted.period_start,
          periodEnd: inserted.period_end,
          summary: inserted.summary,
          createdAt: inserted.created_at,
        },
        200,
        corsHeaders,
      );
    }

    return json({ error: `Unknown action '${action}'` }, 400, corsHeaders);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500, corsHeaders);
  }
});
