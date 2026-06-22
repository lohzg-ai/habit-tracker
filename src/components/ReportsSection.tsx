import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ai } from '../lib/ai';
import { dateLabel } from '../utils/date';
import type { AiReport, AiReportPeriod } from '../types';

export const ReportsSection: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [generating, setGenerating] = useState<AiReportPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    ai.fetchReports(user.id).then(setReports);
  }, [user]);

  const handleGenerate = async (periodType: AiReportPeriod) => {
    if (generating) return;
    setGenerating(periodType);
    setError(null);
    const { report, error: err } = await ai.generateReport(periodType);
    if (report) {
      setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
    }
    if (err) setError(err);
    setGenerating(null);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>AI Reports</Text>
        <View style={styles.btnRow}>
          <ReportButton label="Weekly" loading={generating === 'weekly'} onPress={() => handleGenerate('weekly')} />
          <ReportButton label="Monthly" loading={generating === 'monthly'} onPress={() => handleGenerate('monthly')} />
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {reports.length === 0 ? (
        <Text style={styles.placeholder}>Generate a weekly or monthly summary of your consistency, written by Claude.</Text>
      ) : (
        reports.map((r) => (
          <View key={r.id} style={styles.reportCard}>
            <Text style={styles.reportPeriod}>
              {r.periodType === 'weekly' ? '📅 Weekly' : '🗓 Monthly'} · {dateLabel(r.periodStart)} – {dateLabel(r.periodEnd)}
            </Text>
            <Text style={styles.reportSummary}>{r.summary}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const ReportButton: React.FC<{ label: string; loading: boolean; onPress: () => void }> = ({ label, loading, onPress }) => (
  <Pressable onPress={onPress} disabled={loading} style={styles.genBtn}>
    {loading ? <ActivityIndicator size="small" color="#6C63FF" /> : <Text style={styles.genBtnText}>{label}</Text>}
  </Pressable>
);

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  btnRow: { flexDirection: 'row', gap: 8 },
  genBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(108,99,255,0.15)', minWidth: 64, alignItems: 'center' },
  genBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  placeholder: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 19, fontStyle: 'italic', backgroundColor: '#1E1B2E', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  errorText: { color: '#FF6B6B', fontSize: 12, marginBottom: 8 },
  reportCard: { backgroundColor: '#1E1B2E', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  reportPeriod: { color: '#6C63FF', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  reportSummary: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
});
