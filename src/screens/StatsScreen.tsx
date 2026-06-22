import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useHabits } from '../context/HabitsContext';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';
import { ReportsSection } from '../components/ReportsSection';
import { addDays, today, shortDay } from '../utils/date';
import { scheduleReminders, cancelAllReminders, requestPermissions, getExpoPushToken } from '../utils/notifications';
import { db } from '../lib/db';
import { webOuter, webInner } from '../utils/responsive';

const CHART_DAYS = 7;

type BarData = {
  date: string;
  label: string;
  pct: number;
  allDone: boolean;
  isFuture: boolean;
  isSimulated: boolean;
  done: number;
  total: number;
};

export const StatsScreen: React.FC = () => {
  const { data, toggleNotifications } = useHabits();
  const { user } = useAuth();
  const [notifLoading, setNotifLoading] = useState(false);

  const bars = useMemo<BarData[]>(() => {
    const t = today();
    const futureDates = Array.from(new Set(data.logs.filter((l) => l.date > t).map((l) => l.date)))
      .sort().slice(0, 3);
    const pastCount = CHART_DAYS - 1 - futureDates.length;
    const dates: string[] = [];
    for (let i = pastCount; i >= 0; i--) dates.push(addDays(t, -i));
    dates.push(...futureDates);

    return dates.map((date) => {
      const total = data.habits.length;
      let done = 0;
      let isSimulated = false;
      for (const h of data.habits) {
        const log = data.logs.find((l) => l.habitId === h.id && l.date === date);
        if (log && log.count >= h.targetCount) {
          done++;
          if (log.id.startsWith('dev_')) isSimulated = true;
        }
      }
      return {
        date,
        label: shortDay(date),
        pct: total > 0 ? done / total : 0,
        allDone: total > 0 && done === total,
        isFuture: date > t,
        isSimulated,
        done,
        total,
      };
    });
  }, [data]);

  const completionRate7d = bars.reduce((sum, b) => sum + b.pct, 0) / bars.length;
  const totalCompletions = useMemo(() =>
    data.logs.reduce((sum, l) => {
      const h = data.habits.find((h) => h.id === l.habitId);
      return sum + ((h && l.count >= h.targetCount) ? 1 : 0);
    }, 0), [data]);
  const longestStreak = Math.max(0, ...data.habits.map((h) => h.bestStreak));

  const handleNotifToggle = async (val: boolean) => {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      if (val) {
        if (Platform.OS !== 'web') {
          const granted = await requestPermissions();
          if (!granted) {
            Alert.alert('Permission needed', 'Please enable notifications in your device settings to receive reminders.');
            return;
          }
          await scheduleReminders();
          const pushToken = await getExpoPushToken();
          if (user && pushToken) await db.updatePushToken(user.id, pushToken);
        }
        await toggleNotifications(true);
      } else {
        cancelAllReminders();
        if (user) await db.updatePushToken(user.id, null);
        await toggleNotifications(false);
      }
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <View style={[styles.root, webOuter]}>
      <View style={webInner}>
        <ScreenHeader title="Stats" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <StatCard icon="📈" value={`${Math.round(completionRate7d * 100)}%`} label="7-day rate" />
            <StatCard icon="✅" value={String(totalCompletions)} label="Total done" />
            <StatCard icon="🏅" value={String(longestStreak)} label="Best streak" />
          </View>

          {/* Bar chart */}
          <View style={styles.section}>
            <View style={styles.chartHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                {bars.some((b) => b.isFuture || b.isSimulated) ? 'Activity (incl. simulated)' : 'Last 7 days'}
              </Text>
              {bars.some((b) => b.isSimulated) && (
                <View style={styles.simLegend}>
                  <View style={styles.simDot} />
                  <Text style={styles.simLegendText}>SIM = dev simulated</Text>
                </View>
              )}
            </View>
            <View style={styles.chartWrapper}>
              {bars.map((b, i) => (
                <View key={b.date} style={[styles.barRow, i < bars.length - 1 && styles.barRowDivider]}>
                  {/* Day label */}
                  <View style={styles.barDayCol}>
                    <Text style={[styles.barDayLabel, b.isFuture && styles.barDayLabelFuture]}>{b.label}</Text>
                    {b.isSimulated && (
                      <Text style={[styles.barSimTag, b.isFuture && styles.barSimTagFuture]}>SIM</Text>
                    )}
                  </View>
                  {/* Full-width horizontal bar */}
                  <View style={[styles.barTrack, b.isFuture && styles.barTrackFuture, b.isSimulated && !b.isFuture && styles.barTrackSim]}>
                    <View style={[
                      styles.barFill,
                      { width: `${b.pct * 100}%` as any },
                      b.allDone && !b.isSimulated && styles.barFillComplete,
                      b.isSimulated && !b.isFuture && styles.barFillSim,
                      b.isFuture && styles.barFillFuture,
                      b.allDone && b.isFuture && styles.barFillFutureDone,
                    ]} />
                  </View>
                  {/* Count + done check */}
                  <View style={styles.barCountCol}>
                    <Text style={[
                      styles.barCount,
                      b.allDone && styles.barCountDone,
                      b.isFuture && styles.barCountFuture,
                      b.total === 0 && styles.barCountEmpty,
                    ]}>
                      {b.total > 0 ? `${b.done}/${b.total}` : '–'}
                    </Text>
                    {b.allDone && <Text style={[styles.barDoneCheck, b.isFuture && styles.barDoneCheckFuture]}>✓</Text>}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <ReportsSection />

          {/* Per-habit */}
          {data.habits.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Habit streaks</Text>
              {data.habits.map((h) => (
                <View key={h.id} style={styles.habitRow}>
                  <View style={[styles.habitEmoji, { backgroundColor: h.color + '33' }]}>
                    <Text style={{ fontSize: 18 }}>{h.emoji}</Text>
                  </View>
                  <View style={styles.habitInfo}>
                    <Text style={styles.habitName} numberOfLines={1}>{h.name}</Text>
                    {h.reminder?.enabled && (
                      <Text style={styles.habitReminder}>🔔 {h.reminder.hour}:{String(h.reminder.minute).padStart(2,'0')}</Text>
                    )}
                    <View style={styles.miniBarBg}>
                      <View style={[styles.miniBarFill, { width: `${Math.min((h.streak / Math.max(h.bestStreak, 1)) * 100, 100)}%` as any, backgroundColor: h.color }]} />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.habitStreak, { color: h.color }]}>{h.streak}</Text>
                    <Text style={styles.habitStreakLabel}>now</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <Text style={styles.habitBest}>{h.bestStreak}</Text>
                    <Text style={styles.habitStreakLabel}>best</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Daily reminders & AI coach pushes</Text>
                <Text style={styles.settingMeta}>
                  {Platform.OS === 'web'
                    ? 'Active on mobile device when installed'
                    : '8 AM · 2 PM · 8 PM reminders, plus an AI coaching nudge later in the day (per-habit reminders set in Habits tab)'}
                </Text>
              </View>
              <Switch
                value={data.notificationsEnabled}
                onValueChange={handleNotifToggle}
                disabled={notifLoading}
                trackColor={{ false: '#333', true: '#6C63FF' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const StatCard: React.FC<{ icon: string; value: string; label: string }> = ({ icon, value, label }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B1A' },
  headerSafe: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12 },
  scrollContent: { padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#1E1B2E', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  simLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  simDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C77DFF' },
  simLegendText: { color: 'rgba(199,125,255,0.6)', fontSize: 10 },
  chartWrapper: { backgroundColor: '#1E1B2E', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  barRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  barDayCol: { width: 32, alignItems: 'flex-start' },
  barDayLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  barDayLabelFuture: { color: 'rgba(255,179,71,0.7)' },
  barTrack: { flex: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#6C63FFCC', borderRadius: 10 },
  barFillComplete: { backgroundColor: '#43D9B8' },
  barFillSim: { backgroundColor: '#C77DFF99' },
  barFillFuture: { backgroundColor: '#FFB34788' },
  barFillFutureDone: { backgroundColor: '#FFB347CC' },
  barTrackFuture: { backgroundColor: 'rgba(255,179,71,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,71,0.2)' },
  barTrackSim: { backgroundColor: 'rgba(199,125,255,0.08)', borderWidth: 1, borderColor: 'rgba(199,125,255,0.18)' },
  barCountCol: { width: 40, flexDirection: 'row', alignItems: 'center', gap: 3, justifyContent: 'flex-end' },
  barCount: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  barCountDone: { color: '#43D9B8' },
  barCountFuture: { color: 'rgba(255,179,71,0.7)' },
  barCountEmpty: { color: 'rgba(255,255,255,0.2)' },
  barDoneCheck: { color: '#43D9B8', fontSize: 11, fontWeight: '800' },
  barDoneCheckFuture: { color: 'rgba(255,179,71,0.8)' },
  barSimTag: { color: 'rgba(199,125,255,0.6)', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  barSimTagFuture: { color: 'rgba(255,179,71,0.6)' },
  habitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B2E', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10 },
  habitEmoji: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  habitInfo: { flex: 1 },
  habitName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  habitReminder: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 },
  miniBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  miniBarFill: { height: '100%', borderRadius: 2 },
  habitStreak: { fontSize: 18, fontWeight: '800' },
  habitBest: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '700' },
  habitStreakLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E1B2E', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12 },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  settingMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, lineHeight: 16 },
});
