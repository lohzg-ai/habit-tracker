import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabits } from '../context/HabitsContext';
import { today, isToday } from '../utils/date';
import { webOuter, webInner } from '../utils/responsive';

type DaySummary = { date: string; done: number; total: number; allDone: boolean; isFuture: boolean; isSimulated: boolean };

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const HistoryScreen: React.FC = () => {
  const { data } = useHabits();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const t = today();

  // Furthest future date that has any simulated log
  const maxSimDate = useMemo(() => {
    const futureLogs = data.logs.filter((l) => l.date > t && l.id.startsWith('dev_'));
    if (futureLogs.length === 0) return null;
    return futureLogs.reduce((max, l) => (l.date > max ? l.date : max), futureLogs[0].date);
  }, [data.logs, t]);

  const days = useMemo<DaySummary[]>(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
      return { date, done, total, allDone: total > 0 && done === total, isFuture: date > t, isSimulated };
    }).reverse(); // most recent first
  }, [year, month, daysInMonth, data, t]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    const maxFwd = maxSimDate ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thisMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    if (thisMonthStr >= maxFwd.slice(0, 7) + '-01') return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const isLastAllowedMonth = !maxSimDate
    ? isCurrentMonth
    : `${year}-${String(month + 1).padStart(2, '0')}` >= maxSimDate.slice(0, 7);

  // Current streak (consecutive allDone days ending today, within this dataset)
  const streak = useMemo(() => {
    const sorted = [...days].reverse(); // oldest first for streak calc
    let s = 0;
    for (const d of sorted.slice().reverse()) {
      if (d.allDone) s++;
      else break;
    }
    return s;
  }, [days]);

  const completedDays = days.filter((d) => d.allDone).length;
  const activeDays = days.filter((d) => d.total > 0).length;
  const rate = activeDays > 0 ? Math.round((completedDays / activeDays) * 100) : 0;

  return (
    <View style={[styles.root, webOuter]}>
      <View style={webInner}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={styles.headerTitle}>Activity Log</Text>

          {/* Month navigator */}
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            <Pressable
              onPress={nextMonth}
              style={[styles.navBtn, isLastAllowedMonth && styles.navBtnDisabled]}
            >
              <Text style={[styles.navBtnText, isLastAllowedMonth && styles.navBtnTextDisabled]}>›</Text>
            </Pressable>
          </View>

          {/* Month stats chips */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipVal}>{streak}</Text>
              <Text style={styles.statChipLabel}>streak</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipVal}>{completedDays}</Text>
              <Text style={styles.statChipLabel}>perfect days</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipVal}>{rate}%</Text>
              <Text style={styles.statChipLabel}>completion</Text>
            </View>
          </View>
        </SafeAreaView>

        <FlatList
          data={days}
          keyExtractor={(d) => d.date}
          renderItem={({ item }) => <DayRow day={item} />}
          ListEmptyComponent={<Text style={styles.empty}>No data for this month.</Text>}
          ListFooterComponent={<View style={{ height: 100 }} />}
          contentContainerStyle={{ paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const DayRow: React.FC<{ day: DaySummary }> = ({ day }) => {
  const pct = day.total > 0 ? day.done / day.total : 0;
  const isT = isToday(day.date);

  const d = new Date(day.date + 'T00:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = d.getDate();

  // Future day with no simulated data — show as empty
  if (day.isFuture && !day.isSimulated && day.done === 0) {
    return (
      <View style={[styles.row, styles.rowFuture]}>
        <View style={styles.dateCol}>
          <Text style={styles.weekday}>{weekday}</Text>
          <Text style={[styles.dayNum, styles.dayNumFuture]}>{dayNum}</Text>
        </View>
        <Text style={styles.futureText}>—</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.row,
      isT && styles.rowToday,
      day.allDone && !day.isSimulated && styles.rowDone,
      day.isSimulated && !day.isFuture && styles.rowSim,
      day.isFuture && styles.rowFutureSim,
    ]}>
      <View style={styles.dateCol}>
        <Text style={[styles.weekday, isT && { color: '#6C63FF' }, day.isFuture && { color: 'rgba(255,179,71,0.6)' }]}>
          {isT ? 'Today' : weekday}
        </Text>
        <Text style={[styles.dayNum, isT && { color: '#6C63FF' }, day.isFuture && { color: 'rgba(255,179,71,0.8)' }]}>
          {dayNum}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {day.total === 0 ? (
          <Text style={styles.noHabitsText}>No habits</Text>
        ) : (
          <>
            <View style={[styles.barBg, day.isFuture && styles.barBgFuture]}>
              <View style={[
                styles.barFill,
                { width: `${pct * 100}%` as any },
                day.allDone && !day.isSimulated && styles.barFillDone,
                day.isSimulated && !day.isFuture && styles.barFillSim,
                day.isFuture && styles.barFillFuture,
              ]} />
            </View>
            <Text style={[
              styles.countText,
              day.allDone && !day.isSimulated && { color: '#43D9B8' },
              day.isSimulated && !day.isFuture && { color: 'rgba(199,125,255,0.8)' },
              day.isFuture && { color: 'rgba(255,179,71,0.8)' },
            ]}>
              {day.done}/{day.total}
            </Text>
            {day.isSimulated && (
              <Text style={[styles.simTag, day.isFuture && styles.simTagFuture]}>SIM</Text>
            )}
            {day.allDone && !day.isSimulated && <Text style={styles.doneIcon}>✓</Text>}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B1A' },
  headerSafe: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12, marginBottom: 14 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: '#fff', fontSize: 22, fontWeight: '300' },
  navBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
  monthLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { flex: 1, backgroundColor: '#1E1B2E', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statChipVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statChipLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
  // Day rows
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B2E', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 16, marginVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12 },
  rowToday: { borderColor: 'rgba(108,99,255,0.4)', backgroundColor: 'rgba(108,99,255,0.08)' },
  rowDone: { borderColor: 'rgba(67,217,184,0.2)' },
  rowSim: { borderColor: 'rgba(199,125,255,0.25)', backgroundColor: 'rgba(199,125,255,0.06)' },
  rowFuture: { opacity: 0.3 },
  rowFutureSim: { borderColor: 'rgba(255,179,71,0.25)', backgroundColor: 'rgba(255,179,71,0.06)' },
  dateCol: { width: 46 },
  weekday: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  dayNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dayNumFuture: { color: 'rgba(255,255,255,0.3)' },
  rowRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#6C63FF88', borderRadius: 3 },
  barFillDone: { backgroundColor: '#43D9B8' },
  barFillSim: { backgroundColor: '#C77DFF88' },
  barFillFuture: { backgroundColor: '#FFB34788' },
  barBgFuture: { backgroundColor: 'rgba(255,179,71,0.1)' },
  simTag: { color: 'rgba(199,125,255,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  simTagFuture: { color: 'rgba(255,179,71,0.7)' },
  countText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, minWidth: 30, textAlign: 'right' },
  doneIcon: { color: '#43D9B8', fontSize: 14 },
  noHabitsText: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
  futureText: { color: 'rgba(255,255,255,0.15)', fontSize: 14 },
  empty: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 60 },
});
