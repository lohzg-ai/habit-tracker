import { supabase } from './supabase';
import type { AppData, Challenge, CustomChallenge, Habit, HabitLog, UserProfile } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const dblog = __DEV__
  ? (tag: string, err: unknown) => console.warn(`[db:${tag}]`, err)
  : () => {};

// ── Converters (app camelCase ↔ DB snake_case) ────────────────────────────

const toDbHabit = (userId: string, h: Habit) => ({
  id: h.id,
  user_id: userId,
  name: h.name,
  type: h.type,
  target_count: h.targetCount,
  emoji: h.emoji,
  color: h.color,
  streak: h.streak,
  best_streak: h.bestStreak,
  created_at: h.createdAt,
  reminder: h.reminder,
});

const toDbLog = (userId: string, l: HabitLog) => ({
  id: l.id,
  user_id: userId,
  habit_id: l.habitId,
  date: l.date,
  count: l.count,
});

const toDbChallenge = (userId: string, c: Challenge) => ({
  user_id: userId,
  start_date: c.startDate,
  duration_days: c.durationDays,
  rewarded: c.rewarded,
  habit_ids: c.habitIds,
});

const toDbCustomChallenge = (userId: string, cc: CustomChallenge) => ({
  id: cc.id,
  user_id: userId,
  name: cc.name,
  description: cc.description,
  duration_days: cc.durationDays,
  start_date: cc.startDate,
  rewarded: cc.rewarded,
  habit_ids: cc.habitIds,
});

// ── DB helpers ─────────────────────────────────────────────────────────────

export const db = {
  /** Pull all user data from Supabase and reconstruct AppData. Returns null on error. */
  async pull(userId: string): Promise<AppData | null> {
    const [habitsRes, logsRes, challengeRes, customRes, settingsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      supabase.from('habit_logs').select('*').eq('user_id', userId),
      supabase.from('user_challenges').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('custom_challenges').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (habitsRes.error) { dblog('pull:habits', habitsRes.error); return null; }
    if (logsRes.error)   { dblog('pull:logs', logsRes.error);   return null; }

    const habits: Habit[] = (habitsRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      targetCount: r.target_count,
      emoji: r.emoji,
      color: r.color,
      streak: r.streak,
      bestStreak: r.best_streak,
      createdAt: r.created_at,
      reminder: r.reminder ?? null,
    }));

    const logs: HabitLog[] = (logsRes.data ?? []).map((r) => ({
      id: r.id,
      habitId: r.habit_id,
      date: r.date,
      count: r.count,
    }));

    const cr = challengeRes.data;
    const challenge: Challenge | null = cr
      ? {
          startDate: cr.start_date,
          durationDays: cr.duration_days,
          rewarded: cr.rewarded,
          habitIds: cr.habit_ids ?? [],
        }
      : null;

    const customChallenges: CustomChallenge[] = (customRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      durationDays: r.duration_days,
      startDate: r.start_date,
      rewarded: r.rewarded,
      habitIds: r.habit_ids ?? [],
    }));

    const s = settingsRes.data;

    return {
      habits,
      logs,
      challenge,
      customChallenges,
      onboardingComplete: s?.onboarding_complete ?? false,
      notificationsEnabled: s?.notifications_enabled ?? false,
    };
  },

  /** Upsert all current data (no deletes — safe for rapid concurrent calls). */
  async upsertAll(userId: string, data: AppData): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: PromiseLike<any>[] = [
      supabase
        .from('user_settings')
        .upsert(
          { user_id: userId, onboarding_complete: data.onboardingComplete, notifications_enabled: data.notificationsEnabled },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => { if (error) dblog('upsert:settings', error); }),
    ];

    if (data.habits.length > 0) {
      ops.push(
        supabase.from('habits').upsert(data.habits.map((h) => toDbHabit(userId, h)), { onConflict: 'id' })
          .then(({ error }) => { if (error) dblog('upsert:habits', error); }),
      );
    }
    if (data.logs.length > 0) {
      ops.push(
        supabase.from('habit_logs').upsert(data.logs.map((l) => toDbLog(userId, l)), { onConflict: 'id' })
          .then(({ error }) => { if (error) dblog('upsert:logs', error); }),
      );
    }
    if (data.challenge) {
      ops.push(
        supabase.from('user_challenges').upsert(toDbChallenge(userId, data.challenge), { onConflict: 'user_id' })
          .then(({ error }) => { if (error) dblog('upsert:challenge', error); }),
      );
    }
    if (data.customChallenges.length > 0) {
      ops.push(
        supabase
          .from('custom_challenges')
          .upsert(data.customChallenges.map((cc) => toDbCustomChallenge(userId, cc)), { onConflict: 'id' })
          .then(({ error }) => { if (error) dblog('upsert:custom_challenges', error); }),
      );
    }

    await Promise.all(ops);
  },

  /** Delete a habit and all its logs (used when user explicitly deletes a habit). */
  async deleteHabitAndLogs(userId: string, habitId: string): Promise<void> {
    await supabase.from('habit_logs').delete().eq('user_id', userId).eq('habit_id', habitId);
    await supabase.from('habits').delete().eq('user_id', userId).eq('id', habitId);
  },

  /** Delete a custom challenge record. */
  async deleteCustomChallenge(userId: string, ccId: string): Promise<void> {
    await supabase.from('custom_challenges').delete().eq('user_id', userId).eq('id', ccId);
  },

  /**
   * Full replace: wipe all user records then re-insert from data.
   * Used after onboarding and dev resets only — not called on hot-path mutations.
   */
  async pushAll(userId: string, data: AppData): Promise<void> {
    await Promise.all([
      supabase.from('habit_logs').delete().eq('user_id', userId),
      supabase.from('habits').delete().eq('user_id', userId),
      supabase.from('custom_challenges').delete().eq('user_id', userId),
      supabase.from('user_challenges').delete().eq('user_id', userId),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: PromiseLike<any>[] = [
      supabase.from('user_settings').upsert({
        user_id: userId,
        onboarding_complete: data.onboardingComplete,
        notifications_enabled: data.notificationsEnabled,
      }),
    ];

    if (data.habits.length > 0) {
      ops.push(supabase.from('habits').insert(data.habits.map((h) => toDbHabit(userId, h))));
    }
    if (data.logs.length > 0) {
      ops.push(supabase.from('habit_logs').insert(data.logs.map((l) => toDbLog(userId, l))));
    }
    if (data.challenge) {
      ops.push(supabase.from('user_challenges').insert(toDbChallenge(userId, data.challenge)));
    }
    if (data.customChallenges.length > 0) {
      ops.push(
        supabase
          .from('custom_challenges')
          .insert(data.customChallenges.map((cc) => toDbCustomChallenge(userId, cc))),
      );
    }

    await Promise.all(ops);
  },

  // ── Profile ──────────────────────────────────────────────────────────────

  async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('display_name, avatar_url, inactivity_timeout_mins')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      displayName: data.display_name ?? null,
      avatarUrl: data.avatar_url ?? null,
      inactivityTimeoutMins: data.inactivity_timeout_mins ?? 30,
    };
  },

  async updateProfile(userId: string, changes: Partial<UserProfile>): Promise<void> {
    const row: Record<string, unknown> = { user_id: userId };
    if ('displayName' in changes) row.display_name = changes.displayName;
    if ('avatarUrl' in changes) row.avatar_url = changes.avatarUrl;
    if ('inactivityTimeoutMins' in changes) row.inactivity_timeout_mins = changes.inactivityTimeoutMins;
    await supabase.from('user_settings').upsert(row);
  },

  /** Upload avatar image from a local URI and return the public URL, or null on failure. */
  async uploadAvatar(userId: string, uri: string): Promise<string | null> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (error) return null;
      return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
    } catch {
      return null;
    }
  },
};
