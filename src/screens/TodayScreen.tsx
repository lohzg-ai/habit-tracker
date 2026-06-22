import React, { useState, useMemo } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabits, resolveHabitsForChallenge } from '../context/HabitsContext';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useProfileModal } from '../context/ProfileModalContext';
import { HabitCard } from '../components/HabitCard';
import { CoachCard } from '../components/CoachCard';
import { ProgressRing } from '../components/ProgressRing';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { ChallengeRewardModal } from '../components/ChallengeRewardModal';
import { todayLabel, greeting, today, daysBetween } from '../utils/date';
import { webOuter, webInner } from '../utils/responsive';
import { tapLight } from '../utils/haptics';

type ChallengeView = 'all' | 'kickstart' | string; // string = custom challenge id

export const TodayScreen: React.FC = () => {
  const {
    data,
    allDoneToday,
    showAllDoneBanner,
    challengeDay,
    challengeActive,
    challengeJustCompleted,
    dismissChallengeReward,
    isHabitDoneToday,
  } = useHabits();

  const [selectedView, setSelectedView] = useState<ChallengeView>('all');

  // Build the list of challenge filter options
  const challengeOptions = useMemo(() => {
    const opts: { id: ChallengeView; label: string; emoji: string }[] = [
      { id: 'all', label: 'All', emoji: '☀️' },
    ];
    if (data.challenge && !data.challenge.rewarded) {
      opts.push({ id: 'kickstart', label: 'Kickstart', emoji: '🏆' });
    }
    data.customChallenges
      .filter((c) => !c.rewarded)
      .forEach((c) => opts.push({ id: c.id, label: c.name, emoji: '🎯' }));
    return opts;
  }, [data.challenge, data.customChallenges]);

  // Filter habits based on selected view
  const filteredHabits = useMemo(() => {
    if (selectedView === 'all') return data.habits;
    if (selectedView === 'kickstart' && data.challenge) {
      return resolveHabitsForChallenge(data.challenge.habitIds, data.habits);
    }
    const cc = data.customChallenges.find((c) => c.id === selectedView);
    if (cc) return resolveHabitsForChallenge(cc.habitIds, data.habits);
    return data.habits;
  }, [selectedView, data.habits, data.challenge, data.customChallenges]);

  // Progress for selected view
  const total = filteredHabits.length;
  const done = filteredHabits.filter((h) => isHabitDoneToday(h.id)).length;
  const progress = total > 0 ? done / total : 0;
  const allFilteredDone = total > 0 && done === total;

  // Challenge-specific day label
  const activeChallenge = useMemo(() => {
    if (selectedView === 'kickstart' && data.challenge) {
      const day = Math.min(daysBetween(data.challenge.startDate, today()) + 1, data.challenge.durationDays);
      return { day, total: data.challenge.durationDays, name: '3-Day Kickstart' };
    }
    if (selectedView !== 'all' && selectedView !== 'kickstart') {
      const cc = data.customChallenges.find((c) => c.id === selectedView);
      if (cc) {
        const day = Math.min(daysBetween(cc.startDate, today()) + 1, cc.durationDays);
        return { day, total: cc.durationDays, name: cc.name };
      }
    }
    return null;
  }, [selectedView, data.challenge, data.customChallenges]);

  return (
    <View style={[styles.root, webOuter]}>
      <View style={webInner}>
        <FlatList
          data={filteredHabits}
          keyExtractor={(h) => h.id}
          renderItem={({ item }) => <HabitCard habit={item} />}
          ListHeaderComponent={
            <>
              <Header
                progress={progress}
                done={done}
                total={total}
                allDone={allFilteredDone}
                challengeDay={challengeDay}
                challengeActive={challengeActive}
                activeChallenge={activeChallenge}
              />
              {challengeOptions.length > 1 && (
                <ChallengeFilterBar
                  options={challengeOptions}
                  selected={selectedView}
                  onSelect={(id) => { tapLight(); setSelectedView(id); }}
                />
              )}
              <CoachCard />
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <Text style={styles.emptyEmoji}>{selectedView === 'all' ? '🌱' : '📋'}</Text>
              <Text style={styles.emptyTitle}>
                {selectedView === 'all' ? 'No habits yet' : 'No habits linked'}
              </Text>
              <Text style={styles.emptyBody}>
                {selectedView === 'all'
                  ? 'Head to the Habits tab to add your first habit.'
                  : 'Edit this challenge in the Habits tab to link habits.'}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <CelebrationOverlay visible={showAllDoneBanner} />
      <ChallengeRewardModal
        visible={!!challengeJustCompleted}
        challengeName={challengeJustCompleted?.name ?? ''}
        challengeDays={challengeJustCompleted?.days ?? 3}
        onDismiss={dismissChallengeReward}
      />
    </View>
  );
};

// ── Challenge filter bar ──────────────────────────────────────────────────────

type FilterOption = { id: ChallengeView; label: string; emoji: string };

const ChallengeFilterBar: React.FC<{
  options: FilterOption[];
  selected: ChallengeView;
  onSelect: (id: ChallengeView) => void;
}> = ({ options, selected, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.filterBar}
    contentContainerStyle={styles.filterBarContent}
  >
    {options.map((opt) => (
      <Pressable
        key={opt.id}
        style={[styles.filterChip, selected === opt.id && styles.filterChipActive]}
        onPress={() => onSelect(opt.id)}
      >
        <Text style={styles.filterChipEmoji}>{opt.emoji}</Text>
        <Text style={[styles.filterChipLabel, selected === opt.id && styles.filterChipLabelActive]} numberOfLines={1}>
          {opt.label}
        </Text>
      </Pressable>
    ))}
  </ScrollView>
);

// ── Header ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  progress: number; done: number; total: number;
  allDone: boolean; challengeDay: number | null; challengeActive: boolean;
  activeChallenge: { day: number; total: number; name: string } | null;
};

const Header: React.FC<HeaderProps> = ({ progress, done, total, allDone, challengeDay, challengeActive, activeChallenge }) => {
  const { openProfile } = useProfileModal();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const initials = profile.displayName
    ? profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase();

  return (
  <LinearGradient colors={['#1A0A2E', '#2D1B69', '#1A1726']} style={styles.header}>
    <SafeAreaView edges={['top']} style={styles.headerInner}>
      <View style={styles.headerTop}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.dateText}>{todayLabel()}</Text>
          {activeChallenge ? (
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>
                🏆 {activeChallenge.name} · Day {activeChallenge.day}/{activeChallenge.total}
              </Text>
            </View>
          ) : challengeActive && challengeDay !== null ? (
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>🏆 Day {challengeDay} of 3</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={openProfile} style={styles.headerAvatar} hitSlop={10}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatarCircle}>
                <Text style={styles.headerAvatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.headerAvatarDot} />
          </Pressable>
          <ProgressRing
            progress={progress}
            size={72}
            strokeWidth={5}
            color={allDone ? '#43D9B8' : '#6C63FF'}
            label={`${done}/${total}`}
            sublabel="done"
          />
        </View>
      </View>

      {allDone ? (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>🎉 All habits done — amazing work!</Text>
        </View>
      ) : (
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{done}/{total} done</Text>
        </View>
      )}
    </SafeAreaView>
  </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B1A' },
  header: { paddingBottom: 20 },
  headerInner: { paddingHorizontal: 20, paddingTop: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerText: { flex: 1 },
  headerRight: { alignItems: 'center', gap: 8 },
  headerAvatar: { width: 32, height: 32 },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#6C63FF' },
  headerAvatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerAvatarDot: { position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#43D9B8', borderWidth: 2, borderColor: '#1A0A2E' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 },
  dateText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  challengeBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(108,99,255,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#6C63FF' },
  challengeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  progressBarWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 3 },
  progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, minWidth: 50 },
  allDoneBanner: { backgroundColor: 'rgba(67,217,184,0.15)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(67,217,184,0.4)' },
  allDoneText: { color: '#43D9B8', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  // Filter bar
  filterBar: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  filterBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'transparent', maxWidth: 160 },
  filterChipActive: { backgroundColor: 'rgba(108,99,255,0.2)', borderColor: '#6C63FF' },
  filterChipEmoji: { fontSize: 14 },
  filterChipLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  filterChipLabelActive: { color: '#fff' },
  // Empty state
  emptyWrapper: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
