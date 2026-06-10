import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabits, resolveHabitsForChallenge } from '../context/HabitsContext';
import { AddHabitModal } from '../components/AddHabitModal';
import { CreateChallengeModal } from '../components/CreateChallengeModal';
import { SelectHabitsModal } from '../components/SelectHabitsModal';
import type { CustomChallenge, Habit, Challenge, HabitLog } from '../types';
import { tapLight } from '../utils/haptics';
import { today, daysBetween, addDays } from '../utils/date';
import { webOuter, webInner } from '../utils/responsive';

export const HabitsScreen: React.FC = () => {
  const { data, addHabit, deleteHabit, deleteCustomChallenge, updateChallengeHabits } = useHabits();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [challengeModalVisible, setChallengeModalVisible] = useState(false);

  // Editing challenge habits
  const [editingChallenge, setEditingChallenge] = useState<
    { type: 'main'; habitIds: string[] } | { type: string; habitIds: string[]; name: string } | null
  >(null);

  const confirmAction = (message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if ((global as any).confirm?.(message) ?? window.confirm(message)) onConfirm();
    } else {
      Alert.alert('Confirm', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleDelete = (habit: Habit) => {
    tapLight();
    confirmAction(`Remove "${habit.name}"? This will also delete all logs.`, () => deleteHabit(habit.id));
  };

  const handleDeleteChallenge = (cc: CustomChallenge) => {
    tapLight();
    confirmAction(`Delete "${cc.name}"? Challenge progress will be removed.`, () => deleteCustomChallenge(cc.id));
  };

  const openEditHabits = (type: 'main' | string, habitIds: string[], name?: string) => {
    tapLight();
    if (type === 'main') {
      setEditingChallenge({ type: 'main', habitIds });
    } else {
      setEditingChallenge({ type, habitIds, name: name ?? '' });
    }
  };

  const handleConfirmHabits = async (newHabitIds: string[]) => {
    if (!editingChallenge) return;
    await updateChallengeHabits(editingChallenge.type, newHabitIds);
    setEditingChallenge(null);
  };

  const activeKickstart = data.challenge && !data.challenge.rewarded;
  const activeCustom = data.customChallenges.filter((c) => !c.rewarded);

  return (
    <View style={[styles.root, webOuter]}>
      <View style={webInner}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={styles.headerTitle}>My Habits</Text>
          <Text style={styles.headerSub}>{data.habits.length} habit{data.habits.length !== 1 ? 's' : ''} tracked</Text>
        </SafeAreaView>

        <FlatList
          data={data.habits}
          keyExtractor={(h) => h.id}
          renderItem={({ item }) => (
            <HabitRow habit={item} onDelete={() => handleDelete(item)} />
          )}
          ListHeaderComponent={
            <>
              {(activeKickstart || activeCustom.length > 0) ? (
                <ChallengesSection
                  kickstart={activeKickstart ? data.challenge! : null}
                  custom={activeCustom}
                  allHabits={data.habits}
                  logs={data.logs}
                  onDeleteCustom={handleDeleteChallenge}
                  onNewChallenge={() => { tapLight(); setChallengeModalVisible(true); }}
                  onEditHabits={openEditHabits}
                />
              ) : (
                <View style={styles.newChallengeRow}>
                  <TouchableOpacity style={styles.newChallengeBtn} onPress={() => { tapLight(); setChallengeModalVisible(true); }}>
                    <Text style={styles.newChallengeBtnText}>🏁  Start a Custom Challenge</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.habitsSectionHeader}>
                <Text style={styles.habitsSectionTitle}>MY HABITS</Text>
                <Text style={styles.habitsSectionCount}>{data.habits.length} total</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No habits yet</Text>
              <Text style={styles.emptyBody}>Tap + to add your first habit.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          contentContainerStyle={{ paddingTop: 0 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { tapLight(); setAddModalVisible(true); }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddHabitModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} onAdd={addHabit} />
      <CreateChallengeModal visible={challengeModalVisible} onClose={() => setChallengeModalVisible(false)} />

      <SelectHabitsModal
        visible={!!editingChallenge}
        title="Edit Challenge Habits"
        subtitle={`Choose which habits count toward ${editingChallenge?.type === 'main' ? 'the 3-Day Kickstart' : (editingChallenge as any)?.name ?? 'this challenge'}.`}
        initialSelected={editingChallenge?.habitIds ?? []}
        onConfirm={handleConfirmHabits}
        onClose={() => setEditingChallenge(null)}
      />
    </View>
  );
};

// ── Challenges section ──────────────────────────────────────────────────────

const ChallengesSection: React.FC<{
  kickstart: Challenge | null;
  custom: CustomChallenge[];
  allHabits: Habit[];
  logs: HabitLog[];
  onDeleteCustom: (c: CustomChallenge) => void;
  onNewChallenge: () => void;
  onEditHabits: (type: 'main' | string, habitIds: string[], name?: string) => void;
}> = ({ kickstart, custom, allHabits, logs, onDeleteCustom, onNewChallenge, onEditHabits }) => {
  const t = today();

  const challengeProgress = (startDate: string, durationDays: number, habitIds: string[], allHabits2: Habit[], logs2: HabitLog[]) => {
    const day = Math.min(daysBetween(startDate, t) + 1, durationDays);
    // Count fully-completed days (all linked habits done)
    let completedDays = 0;
    const habits = resolveHabitsForChallenge(habitIds, allHabits2);
    for (let i = 0; i < day; i++) {
      const dateStr = addDays(startDate, i);
      if (habits.length > 0 && habits.every((h) => {
        const log = logs2.find((l) => l.habitId === h.id && l.date === dateStr);
        return (log?.count ?? 0) >= h.targetCount;
      })) completedDays++;
    }
    return { day, total: durationDays, pct: durationDays > 0 ? completedDays / durationDays : 0, completedDays };
  };

  return (
    <View style={styles.challengesSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Challenges</Text>
        <Pressable onPress={onNewChallenge} style={styles.newChipBtn}>
          <Text style={styles.newChipBtnText}>+ New</Text>
        </Pressable>
      </View>

      {kickstart && (() => {
        const { day, total, pct, completedDays } = challengeProgress(kickstart.startDate, kickstart.durationDays, kickstart.habitIds, allHabits, logs);
        const linkedHabits = resolveHabitsForChallenge(kickstart.habitIds, allHabits);
        return (
          <View style={styles.challengeCard}>
            <View style={styles.challengeCardLeft}>
              <Text style={styles.challengeCardEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeCardName}>3-Day Kickstart</Text>
                <Text style={styles.challengeCardSub}>{completedDays}/{total} days done</Text>
                <View style={styles.challengeBar}>
                  <View style={[styles.challengeBarFill, { width: `${pct * 100}%` as any }]} />
                </View>
                <LinkedHabitsRow habits={linkedHabits} />
              </View>
            </View>
            <Pressable
              style={styles.editBtn}
              onPress={() => onEditHabits('main', kickstart.habitIds)}
              hitSlop={8}
            >
              <Text style={styles.editBtnText}>Edit habits</Text>
            </Pressable>
          </View>
        );
      })()}

      {custom.map((cc) => {
        const { day, total, pct, completedDays } = challengeProgress(cc.startDate, cc.durationDays, cc.habitIds, allHabits, logs);
        const linkedHabits = resolveHabitsForChallenge(cc.habitIds, allHabits);
        return (
          <View key={cc.id} style={styles.challengeCard}>
            <View style={styles.challengeCardLeft}>
              <Text style={styles.challengeCardEmoji}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeCardName}>{cc.name}</Text>
                <Text style={styles.challengeCardSub}>{completedDays}/{total} days done</Text>
                {cc.description ? <Text style={styles.challengeCardDesc} numberOfLines={1}>{cc.description}</Text> : null}
                <View style={styles.challengeBar}>
                  <View style={[styles.challengeBarFill, { width: `${pct * 100}%` as any, backgroundColor: '#FFB347' }]} />
                </View>
                <LinkedHabitsRow habits={linkedHabits} />
              </View>
            </View>
            <View style={styles.challengeActions}>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditHabits(cc.id, cc.habitIds, cc.name)}
                hitSlop={8}
              >
                <Text style={styles.editBtnText}>Edit habits</Text>
              </Pressable>
              <Pressable onPress={() => onDeleteCustom(cc)} style={styles.challengeDelete} hitSlop={8}>
                <Text style={styles.challengeDeleteText}>✕</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const LinkedHabitsRow: React.FC<{ habits: Habit[] }> = ({ habits }) => {
  if (habits.length === 0) return null;
  return (
    <View style={styles.linkedRow}>
      {habits.slice(0, 5).map((h) => (
        <View key={h.id} style={[styles.linkedEmoji, { backgroundColor: h.color + '33' }]}>
          <Text style={{ fontSize: 11 }}>{h.emoji}</Text>
        </View>
      ))}
      {habits.length > 5 && (
        <Text style={styles.linkedMore}>+{habits.length - 5}</Text>
      )}
    </View>
  );
};

// ── Habit row ────────────────────────────────────────────────────────────────

const HabitRow: React.FC<{ habit: Habit; onDelete: () => void }> = ({ habit, onDelete }) => (
  <View style={styles.row}>
    <View style={[styles.emojiCircle, { backgroundColor: habit.color + '33' }]}>
      <Text style={{ fontSize: 20 }}>{habit.emoji}</Text>
    </View>
    <View style={styles.rowInfo}>
      <Text style={styles.rowName}>{habit.name}</Text>
      <Text style={styles.rowMeta} numberOfLines={1}>
        {habit.type === 'volume' ? `${habit.targetCount}× per day` : 'Once daily'}
        {habit.streak > 0 ? `  •  🔥 ${habit.streak}d` : ''}
        {habit.reminder?.enabled ? `  •  🔔` : ''}
      </Text>
    </View>
    <View style={styles.rowRight}>
      <View style={[styles.streakBadge, { borderColor: habit.color }]}>
        <Text style={[styles.streakBadgeText, { color: habit.color }]}>{habit.bestStreak}</Text>
        <Text style={styles.streakBadgeSub}>best</Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B1A' },
  headerSafe: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  // Challenges
  challengesSection: { margin: 12, marginBottom: 0, backgroundColor: '#1A1535', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#A89FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  // Habits section header
  habitsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, borderTopWidth: 0 },
  habitsSectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  habitsSectionCount: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  newChipBtn: { backgroundColor: 'rgba(108,99,255,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#6C63FF55' },
  newChipBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  challengeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' },
  challengeCardLeft: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  challengeCardEmoji: { fontSize: 24, marginTop: 2 },
  challengeCardName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  challengeCardSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  challengeCardDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  challengeBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  challengeBarFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 2 },
  challengeActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  editBtn: { backgroundColor: 'rgba(108,99,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#6C63FF55' },
  editBtnText: { color: '#6C63FF', fontSize: 11, fontWeight: '600' },
  challengeDelete: { padding: 4 },
  challengeDeleteText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  linkedEmoji: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkedMore: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  newChallengeRow: { padding: 16, paddingBottom: 4 },
  newChallengeBtn: { borderWidth: 1, borderColor: 'rgba(108,99,255,0.4)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed' },
  newChallengeBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 14 },
  // Habit rows
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B2E', borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12 },
  emojiCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: { alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  streakBadgeText: { fontSize: 15, fontWeight: '700' },
  streakBadgeSub: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  emptyWrapper: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
