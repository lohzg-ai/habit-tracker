import { supabase } from './supabase';
import type { AiNudge, AiReport, AiReportPeriod } from '../types';

const dblog = __DEV__
  ? (tag: string, err: unknown) => console.warn(`[ai:${tag}]`, err)
  : () => {};

const toNudge = (r: any): AiNudge => ({ id: r.id, message: r.message, createdAt: r.created_at });

const toReport = (r: any): AiReport => ({
  id: r.id,
  periodType: r.period_type,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  summary: r.summary,
  createdAt: r.created_at,
});

export const ai = {
  /** Latest cached nudge from the DB — no Claude call. */
  async fetchLatestNudge(userId: string): Promise<AiNudge | null> {
    const { data, error } = await supabase
      .from('ai_nudges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return toNudge(data);
  },

  /** Calls the ai-coach edge function to generate a fresh nudge via Claude. */
  async generateNudge(): Promise<{ nudge?: AiNudge; error?: string }> {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { action: 'nudge' },
    });
    if (error) { dblog('generateNudge', error); return { error: error.message }; }
    if (data?.error) return { error: data.error };
    return { nudge: toNudge({ id: data.id, message: data.message, created_at: data.createdAt }) };
  },

  /** Cached reports from the DB — no Claude call. */
  async fetchReports(userId: string): Promise<AiReport[]> {
    const { data, error } = await supabase
      .from('ai_reports')
      .select('*')
      .eq('user_id', userId)
      .order('period_start', { ascending: false })
      .limit(10);
    if (error || !data) return [];
    return data.map(toReport);
  },

  /** Calls the ai-coach edge function to generate (or refresh) a weekly/monthly report via Claude. */
  async generateReport(periodType: AiReportPeriod): Promise<{ report?: AiReport; error?: string }> {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { action: 'report', periodType },
    });
    if (error) { dblog('generateReport', error); return { error: error.message }; }
    if (data?.error) return { error: data.error };
    return {
      report: toReport({
        id: data.id,
        period_type: data.periodType,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        summary: data.summary,
        created_at: data.createdAt,
      }),
    };
  },
};
