import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NewHabitInput } from '../context/HabitsContext';
import { useHabits } from '../context/HabitsContext';
import { tapLight, celebrate } from '../utils/haptics';
import { requestPermissions, scheduleReminders } from '../utils/notifications';
import { webInner } from '../utils/responsive';

const PRESET_HABITS: NewHabitInput[] = [
  { name: 'Morning exercise', type: 'daily', targetCount: 1, emoji: '🏃', color: '#6C63FF', reminder: null },
  { name: 'Drink water', type: 'volume', targetCount: 8, emoji: '💧', color: '#00B4D8', reminder: null },
  { name: 'Read', type: 'daily', targetCount: 1, emoji: '📚', color: '#43D9B8', reminder: null },
  { name: 'Meditate', type: 'daily', targetCount: 1, emoji: '🧘', color: '#C77DFF', reminder: null },
  { name: 'No social media', type: 'daily', targetCount: 1, emoji: '🌿', color: '#A8E6CF', reminder: null },
  { name: 'Healthy meal', type: 'volume', targetCount: 3, emoji: '🥗', color: '#FFB347', reminder: null },
  { name: 'Journal', type: 'daily', targetCount: 1, emoji: '✍️', color: '#FF6584', reminder: null },
  { name: 'Sleep 8h', type: 'daily', targetCount: 1, emoji: '😴', color: '#5B8DEF', reminder: null },
];

const TOTAL_STEPS = 4;

const STEP_BTNS = [
  'Show me challenges →',
  'Tell me about reminders →',
  'Pick my habits →',
];

export const OnboardingScreen: React.FC = () => {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { completeOnboarding, toggleNotifications } = useHabits();

  const togglePreset = (i: number) => {
    tapLight();
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else if (s.size < 5) s.add(i);
      return s;
    });
  };

  const handleFinish = async () => {
    celebrate();
    const chosenHabits = Array.from(selected).map((i) => PRESET_HABITS[i]);
    const permGranted = await requestPermissions();
    if (permGranted) {
      await scheduleReminders();
      await toggleNotifications(true);
    }
    await completeOnboarding(chosenHabits);
  };

  const next = () => { tapLight(); setStep((s) => s + 1); };
  const skipToPickHabits = () => { tapLight(); setStep(3); };

  const btnLabel = step < 3
    ? STEP_BTNS[step]
    : selected.size > 0
      ? `Start with ${selected.size} habit${selected.size !== 1 ? 's' : ''} →`
      : 'Start fresh →';

  return (
    <LinearGradient colors={['#0D0B1A', '#1A1726', '#0D0B1A']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.inner, webInner]}>
            {/* Progress dots + skip */}
            <View style={styles.dotsRow}>
              <View style={styles.dotsCenter}>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
                ))}
              </View>
              {step < 3 && (
                <TouchableOpacity onPress={skipToPickHabits} style={styles.skipBtn} hitSlop={16}>
                  <Text style={styles.skipBtnText}>Skip</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Scrollable content — all steps share this scroll container */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces
            >
              {step === 0 && <HowItWorksContent />}
              {step === 1 && <ChallengesContent />}
              {step === 2 && <RemindersContent />}
              {step === 3 && <PickHabitsContent selected={selected} onToggle={togglePreset} />}
            </ScrollView>

            {/* Pinned bottom button — always visible, outside scroll */}
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={step === 3 ? handleFinish : next}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{btnLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// ── Step content components (no button, no outer scroll) ──────────────────────

const HowItWorksContent: React.FC = () => (
  <View>
    <Text style={styles.bigEmoji}>✨</Text>
    <Text style={styles.heading}>Build habits that{'\n'}actually stick.</Text>
    <Text style={styles.body}>
      HabitFlow is your personal habit coach — create daily routines, take challenges, and track your progress all in one place.
    </Text>
    <View style={styles.cardGrid}>
      <FeatureCard emoji="📋" title="Create Habits" body="Add once-daily habits or counted goals like 'Drink 8 glasses'. Each habit is yours to customize." color="#6C63FF" />
      <FeatureCard emoji="🏆" title="Take Challenges" body="3-day kickstart or custom multi-day challenges. Link specific habits to each challenge." color="#FFB347" />
      <FeatureCard emoji="📊" title="Track Progress" body="See your streaks, completion rates, and monthly history. Watch your consistency grow over time." color="#43D9B8" />
      <FeatureCard emoji="🔔" title="Stay on Track" body="Personalized reminders for each habit at exactly the time you choose — morning, noon, or night." color="#FF6584" />
    </View>
  </View>
);

const FeatureCard: React.FC<{ emoji: string; title: string; body: string; color: string }> = ({
  emoji, title, body, color,
}) => (
  <View style={[styles.featureCard, { borderColor: color + '44' }]}>
    <View style={[styles.featureCardIcon, { backgroundColor: color + '22' }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
    <Text style={[styles.featureCardTitle, { color }]}>{title}</Text>
    <Text style={styles.featureCardBody}>{body}</Text>
  </View>
);

const ChallengesContent: React.FC = () => (
  <View>
    <Text style={styles.bigEmoji}>🏆</Text>
    <Text style={styles.heading}>Challenges for{'\n'}Every Goal</Text>
    <Text style={styles.body}>
      Challenges keep you accountable. Pick a duration, link your habits, and complete them every single day to unlock rewards.
    </Text>
    <View style={styles.challengeOptions}>
      <View style={styles.challengeOption}>
        <View style={[styles.challengeOptionBadge, { backgroundColor: '#6C63FF33', borderColor: '#6C63FF' }]}>
          <Text style={styles.challengeOptionEmoji}>🚀</Text>
          <Text style={[styles.challengeOptionLabel, { color: '#6C63FF' }]}>3-Day Kickstart</Text>
        </View>
        <Text style={styles.challengeOptionDesc}>Automatically starts when you set up your habits. Perfect for building momentum.</Text>
      </View>
      <View style={styles.challengeArrow}>
        <Text style={styles.challengeArrowText}>+</Text>
      </View>
      <View style={styles.challengeOption}>
        <View style={[styles.challengeOptionBadge, { backgroundColor: '#FFB34733', borderColor: '#FFB347' }]}>
          <Text style={styles.challengeOptionEmoji}>🎯</Text>
          <Text style={[styles.challengeOptionLabel, { color: '#FFB347' }]}>Custom Challenges</Text>
        </View>
        <Text style={styles.challengeOptionDesc}>Create 5, 7, 14, or 30-day challenges. Name them, pick habits, and go.</Text>
      </View>
    </View>
    <View style={styles.howRow}>
      <Text style={styles.howLabel}>How challenges work:</Text>
      {[
        'Select which habits count toward the challenge',
        'Complete all linked habits each day',
        'Keep your streak alive — consecutive days only',
        'Earn a reward when you finish the full duration',
      ].map((s, i) => (
        <View key={i} style={styles.howItem}>
          <Text style={styles.howBullet}>→</Text>
          <Text style={styles.howItemText}>{s}</Text>
        </View>
      ))}
    </View>
  </View>
);

const RemindersContent: React.FC = () => (
  <View>
    <Text style={styles.bigEmoji}>🔔</Text>
    <Text style={styles.heading}>Reminders That{'\n'}Actually Help</Text>
    <Text style={styles.body}>
      Most reminder apps blast you with the same alert every day. HabitFlow lets you set a specific time for each habit — so the right reminder arrives at the right moment.
    </Text>
    <View style={styles.reminderExamples}>
      {[
        { time: '7:00 AM', habit: '🏃 Morning exercise', color: '#6C63FF' },
        { time: '12:30 PM', habit: '💧 Drink water (glass 4)', color: '#00B4D8' },
        { time: '9:00 PM', habit: '✍️ Journal', color: '#FF6584' },
      ].map((r) => (
        <View key={r.habit} style={[styles.reminderCard, { borderLeftColor: r.color }]}>
          <Text style={[styles.reminderTime, { color: r.color }]}>{r.time}</Text>
          <Text style={styles.reminderHabit}>{r.habit}</Text>
        </View>
      ))}
    </View>
    <View style={styles.reminderNote}>
      <Text style={styles.reminderNoteText}>
        You can set individual reminders for each habit from the Stats tab after setup, or skip them for now and add them later.
      </Text>
    </View>
  </View>
);

const PickHabitsContent: React.FC<{
  selected: Set<number>;
  onToggle: (i: number) => void;
}> = ({ selected, onToggle }) => (
  <View>
    <Text style={styles.heading}>Pick your first{'\n'}habits</Text>
    <Text style={[styles.body, { marginBottom: 16 }]}>
      Choose up to 5 to start with. These will automatically be linked to your 3-Day Kickstart Challenge.
    </Text>
    {PRESET_HABITS.map((h, i) => (
      <Pressable
        key={i}
        style={[styles.presetRow, selected.has(i) && styles.presetRowSelected]}
        onPress={() => onToggle(i)}
      >
        <View style={[styles.presetEmoji, { backgroundColor: h.color + '33' }]}>
          <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.presetName}>{h.name}</Text>
          <Text style={styles.presetType}>{h.type === 'volume' ? `${h.targetCount}× per day` : 'Once daily'}</Text>
        </View>
        <View style={[styles.presetCheck, selected.has(i) && { backgroundColor: h.color, borderColor: h.color }]}>
          {selected.has(i) && <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>}
        </View>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 0 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 4, paddingHorizontal: 20 },
  dotsCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { backgroundColor: '#6C63FF', width: 22 },
  dotDone: { backgroundColor: 'rgba(108,99,255,0.5)' },
  skipBtn: { position: 'absolute', right: 20, padding: 8 },
  skipBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24 },
  bottomBar: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  primaryBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bigEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 14, marginTop: 12 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12, lineHeight: 36 },
  body: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  // Feature cards
  cardGrid: { gap: 10, marginBottom: 8 },
  featureCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1 },
  featureCardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  featureCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  featureCardBody: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19 },
  // Challenges step
  challengeOptions: { gap: 0, marginBottom: 16 },
  challengeOption: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14 },
  challengeOptionBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 8 },
  challengeOptionEmoji: { fontSize: 16 },
  challengeOptionLabel: { fontSize: 14, fontWeight: '700' },
  challengeOptionDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 18 },
  challengeArrow: { alignItems: 'center', paddingVertical: 4 },
  challengeArrowText: { color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: '700' },
  howRow: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 8 },
  howLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  howItem: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  howBullet: { color: '#6C63FF', fontSize: 13, fontWeight: '700', marginTop: 1 },
  howItemText: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19, flex: 1 },
  // Reminders step
  reminderExamples: { gap: 10, marginBottom: 16 },
  reminderCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 14 },
  reminderTime: { fontSize: 14, fontWeight: '700', minWidth: 70 },
  reminderHabit: { color: '#fff', fontSize: 14, flex: 1 },
  reminderNote: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 8 },
  reminderNoteText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  // Pick habits step
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  presetRowSelected: { borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.12)' },
  presetEmoji: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  presetName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  presetType: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  presetCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
