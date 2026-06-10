import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabits, resolveHabitsForChallenge } from '../context/HabitsContext';
import { today, daysAgo } from '../utils/date';
import { webOuter, webInner } from '../utils/responsive';

const webConfirm = (message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

export const DevScreen: React.FC = () => {
  const {
    data,
    devSimulateChallengeDay,
    devCompleteFullChallenge,
    devSimulateNextNDays,
    devForceTriggerReward,
    devResetAll,
    devResetOnboarding,
    devCompleteAllHabitsToday,
  } = useHabits();

  const [status, setStatus] = useState('');

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3500);
  };

  const handleSimDay = async (day: 1 | 2 | 3) => {
    await devSimulateChallengeDay(day);
    showStatus(`✓ Challenge set to Day ${day}. Past days filled with challenge-specific habits. Complete today's habits to test.`);
  };

  const handleCompleteChallenge = async (habitIds: string[], name: string) => {
    const habits = resolveHabitsForChallenge(habitIds, data.habits);
    // Use batched update to avoid stale closure issues from logHabit-in-loop
    await devCompleteAllHabitsToday(habits.map((h) => h.id));
    showStatus(`✓ Completed ${habits.length} habit${habits.length !== 1 ? 's' : ''} for "${name}"`);
  };

  const handleCompleteAll = async () => {
    await devCompleteAllHabitsToday();
    showStatus('✓ All habits marked complete for today');
  };

  const handleForceReward = () => {
    devForceTriggerReward();
    showStatus('✓ Challenge reward modal triggered');
  };

  const handleResetAll = () => {
    webConfirm('Reset ALL data? This deletes all habits, logs, and settings.', async () => {
      await devResetAll();
      showStatus('✓ All data cleared — onboarding will show now.');
    });
  };

  const c = data.challenge;
  const todayStr = today();

  // Per-habit logs for today
  const habitLogs = data.habits.map((h) => {
    const log = data.logs.find((l) => l.habitId === h.id && l.date === todayStr);
    return { habit: h, count: log?.count ?? 0 };
  });

  return (
    <View style={[styles.root, webOuter]}>
      <View style={webInner}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={styles.headerTitle}>🛠 Dev Tools</Text>
          <Text style={styles.headerSub}>Developer testing panel — not visible in production</Text>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {!!status && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}

          {/* State overview */}
          <SectionHeader title="App State" />
          <InfoCard>
            <InfoRow label="Habits" value={String(data.habits.length)} />
            <InfoRow label="Logs" value={String(data.logs.length)} />
            <InfoRow label="Custom Challenges" value={String(data.customChallenges.length)} />
            <InfoRow label="Onboarding" value={data.onboardingComplete ? 'complete' : 'pending'} />
            <InfoRow label="Notifications" value={data.notificationsEnabled ? 'enabled' : 'off'} />
          </InfoCard>

          {/* Kickstart challenge with habit breakdown */}
          <SectionHeader title="Kickstart Challenge" />
          {c ? (
            <InfoCard>
              <InfoRow label="Start date" value={c.startDate} />
              <InfoRow label="Duration" value={`${c.durationDays} days`} />
              <InfoRow label="Rewarded" value={String(c.rewarded)} />
              <InfoRow
                label="Linked habits"
                value={
                  c.habitIds.length === 0
                    ? 'All habits'
                    : resolveHabitsForChallenge(c.habitIds, data.habits).map((h) => `${h.emoji} ${h.name}`).join(', ') || 'None'
                }
              />
            </InfoCard>
          ) : (
            <InfoCard>
              <Text style={styles.infoValue}>No active kickstart challenge</Text>
            </InfoCard>
          )}

          {/* Custom challenges with habit breakdown */}
          {data.customChallenges.length > 0 && (
            <>
              <SectionHeader title="Custom Challenges" />
              {data.customChallenges.map((cc) => (
                <View key={cc.id} style={styles.ccCard}>
                  <Text style={styles.ccName}>🎯 {cc.name} ({cc.durationDays}d)</Text>
                  <Text style={styles.ccMeta}>Start: {cc.startDate} · Rewarded: {String(cc.rewarded)}</Text>
                  <Text style={styles.ccHabits}>
                    Habits: {cc.habitIds.length === 0
                      ? 'All'
                      : resolveHabitsForChallenge(cc.habitIds, data.habits).map((h) => `${h.emoji} ${h.name}`).join(', ') || 'None'}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* Today's progress */}
          <SectionHeader title="Today's Progress" />
          <InfoCard>
            {habitLogs.length > 0
              ? habitLogs.map(({ habit, count }) => (
                  <View key={habit.id} style={styles.habitProgressRow}>
                    <Text style={styles.habitProgressEmoji}>{habit.emoji}</Text>
                    <Text style={styles.habitProgressName} numberOfLines={1}>{habit.name}</Text>
                    <Text style={[styles.habitProgressCount, count >= habit.targetCount && { color: '#43D9B8' }]}>
                      {count}/{habit.targetCount}
                    </Text>
                  </View>
                ))
              : <Text style={styles.infoValue}>No habits yet</Text>}
          </InfoCard>

          {/* Challenge simulation */}
          <SectionHeader title="Challenge Simulation" />
          <Text style={styles.sectionNote}>
            Sets the kickstart challenge start date so today = the chosen day. Previous days are auto-filled using only the challenge-linked habits. Complete today's linked habits to test challenge completion flow.
          </Text>
          <View style={styles.btnGroup}>
            {([1, 2, 3] as const).map((d) => (
              <DevBtn
                key={d}
                label={`Set Kickstart to Day ${d}`}
                sub={`Start date: ${daysAgo(d - 1)}`}
                color="#6C63FF"
                onPress={() => handleSimDay(d)}
              />
            ))}
          </View>

          {/* Per-challenge completion */}
          <SectionHeader title="Complete Challenge Habits (Today Only)" />
          <Text style={styles.sectionNote}>
            Mark today's habits done for a specific challenge only.
          </Text>
          {c && (
            <DevBtn
              label="Complete Kickstart habits today"
              sub={`${resolveHabitsForChallenge(c.habitIds, data.habits).length} habit${resolveHabitsForChallenge(c.habitIds, data.habits).length !== 1 ? 's' : ''} linked`}
              color="#6C63FF"
              onPress={() => handleCompleteChallenge(c.habitIds, '3-Day Kickstart')}
            />
          )}
          {data.customChallenges.filter((cc) => !cc.rewarded).map((cc) => (
            <DevBtn
              key={cc.id}
              label={`Complete "${cc.name}" habits today`}
              sub={`${resolveHabitsForChallenge(cc.habitIds, data.habits).length} habit${resolveHabitsForChallenge(cc.habitIds, data.habits).length !== 1 ? 's' : ''} linked`}
              color="#FFB347"
              onPress={() => handleCompleteChallenge(cc.habitIds, cc.name)}
            />
          ))}

          {/* Full challenge completion */}
          <SectionHeader title="Simulate Full Challenge Completion" />
          <Text style={styles.sectionNote}>
            Fills every day of the challenge with completed habits and triggers the reward modal. Start date is rebased so today = final day.
          </Text>
          {c ? (
            <DevBtn
              label="Complete Kickstart (all days)"
              sub={`Fills ${c.durationDays} days → triggers reward`}
              color="#43D9B8"
              onPress={async () => {
                await devCompleteFullChallenge('main');
                showStatus('✓ Kickstart fully completed — reward modal should appear');
              }}
            />
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>No active kickstart challenge</Text>
            </View>
          )}
          {data.customChallenges.filter((cc) => !cc.rewarded).map((cc) => (
            <DevBtn
              key={cc.id}
              label={`Complete "${cc.name}" (all days)`}
              sub={`Fills ${cc.durationDays} days → triggers reward`}
              color="#43D9B8"
              onPress={async () => {
                await devCompleteFullChallenge(cc.id);
                showStatus(`✓ "${cc.name}" fully completed — reward modal should appear`);
              }}
            />
          ))}

          {/* Future simulation */}
          <SectionHeader title="Simulate Future Days" />
          <Text style={styles.sectionNote}>
            Fills habits as completed for upcoming days. Simulated future bars appear in Stats (amber colour).
          </Text>
          {([3, 7, 14] as const).map((n) => (
            <DevBtn
              key={n}
              label={`Simulate next ${n} days`}
              sub={`Writes logs for today+1 through today+${n}`}
              color="#FFB347"
              onPress={async () => {
                await devSimulateNextNDays(n);
                showStatus(`✓ Simulated ${n} future days — check Stats chart`);
              }}
            />
          ))}

          {/* Quick actions */}
          <SectionHeader title="Quick Actions" />
          <DevBtn
            label="Complete ALL habits today"
            sub="Marks every habit as done regardless of challenges"
            color="#43D9B8"
            onPress={handleCompleteAll}
          />
          <DevBtn
            label="Force trigger reward modal"
            sub="Shows the challenge complete modal immediately"
            color="#FFB347"
            onPress={handleForceReward}
          />

          <SectionHeader title="Data" />
          <DevBtn
            label="Reset onboarding only"
            sub="Keeps habits & logs — shows onboarding screen again"
            color="#C77DFF"
            onPress={() => {
              webConfirm('Reset onboarding? Your habits and logs will be kept.', async () => {
                await devResetOnboarding();
                showStatus('✓ Onboarding reset — you will see the intro screens now.');
              });
            }}
          />
          <DevBtn
            label="Reset ALL data"
            sub="Clears everything — habits, logs, settings, onboarding"
            color="#FF6584"
            onPress={handleResetAll}
          />

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const InfoCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.infoCard}>{children}</View>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={3}>{value}</Text>
  </View>
);

const DevBtn: React.FC<{ label: string; sub: string; color: string; onPress: () => void }> = ({
  label, sub, color, onPress,
}) => (
  <TouchableOpacity style={[styles.devBtn, { borderColor: color + '55' }]} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.devBtnAccent, { backgroundColor: color }]} />
    <View style={{ flex: 1 }}>
      <Text style={styles.devBtnLabel}>{label}</Text>
      <Text style={styles.devBtnSub}>{sub}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B1A' },
  headerSafe: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, marginBottom: 4 },
  content: { padding: 16 },
  statusBanner: { backgroundColor: 'rgba(67,217,184,0.15)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(67,217,184,0.4)' },
  statusText: { color: '#43D9B8', fontSize: 13, fontWeight: '600' },
  sectionHeader: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  sectionNote: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  infoCard: { backgroundColor: '#1E1B2E', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 4, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, flexShrink: 0 },
  infoValue: { color: '#fff', fontSize: 12, flex: 1, textAlign: 'right' },
  ccCard: { backgroundColor: '#1E1B2E', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  ccName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ccMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 },
  ccHabits: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4, lineHeight: 17 },
  habitProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitProgressEmoji: { fontSize: 14, width: 20 },
  habitProgressName: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  habitProgressCount: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  btnGroup: { gap: 8, marginBottom: 4 },
  devBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B2E', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  devBtnAccent: { width: 4, alignSelf: 'stretch' },
  devBtnLabel: { color: '#fff', fontSize: 14, fontWeight: '600', paddingTop: 12, paddingHorizontal: 14 },
  devBtnSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, paddingBottom: 12, paddingHorizontal: 14 },
});
