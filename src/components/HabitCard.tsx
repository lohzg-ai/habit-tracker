import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Habit } from '../types';
import { useHabits } from '../context/HabitsContext';
import { ReminderModal } from './ReminderModal';
import { fmt12h } from '../utils/notifications';

type Props = { habit: Habit };

export const HabitCard: React.FC<Props> = ({ habit }) => {
  const { logHabit, getTodayCount, isHabitDoneToday } = useHabits();
  const count = getTodayCount(habit.id);
  const done = isHabitDoneToday(habit.id);
  const [reminderOpen, setReminderOpen] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const prevDone = useRef(done);

  useEffect(() => {
    if (!prevDone.current && done) {
      ringAnim.setValue(0);
      ringOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(ringAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    prevDone.current = done;
  }, [done, ringAnim, ringOpacity, scaleAnim]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    logHabit(habit.id);
  };

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const progress = habit.type === 'volume' ? Math.min(count / habit.targetCount, 1) : done ? 1 : 0;
  const hasReminder = habit.reminder?.enabled;

  return (
    <>
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.card,
            done && styles.cardDone,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Burst ring overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.burstRing,
              {
                borderColor: habit.color,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />

          <View style={styles.leftSection}>
            <View style={[styles.emojiCircle, { backgroundColor: habit.color + '33' }]}>
              <Text style={styles.emoji}>{habit.emoji}</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, done && styles.nameDone]} numberOfLines={1}>
                {habit.name}
              </Text>
              <View style={styles.metaRow}>
                {habit.streak > 0 && (
                  <Text style={styles.streak}>🔥 {habit.streak}d</Text>
                )}
                {hasReminder && (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); setReminderOpen(true); }}
                    style={[styles.reminderPill, { borderColor: habit.color + '66' }]}
                    hitSlop={6}
                  >
                    <Text style={[styles.reminderText, { color: habit.color }]}>
                      🔔 {fmt12h(habit.reminder!.hour, habit.reminder!.minute)}
                    </Text>
                  </Pressable>
                )}
                {!hasReminder && (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); setReminderOpen(true); }}
                    style={styles.setReminderBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.setReminderText}>+ reminder</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          <View style={styles.rightSection}>
            {habit.type === 'volume' ? (
              <VolumeIndicator count={count} target={habit.targetCount} color={habit.color} done={done} />
            ) : (
              <DailyCheckmark done={done} color={habit.color} />
            )}
          </View>
        </Animated.View>
      </Pressable>

      <ReminderModal
        habit={reminderOpen ? habit : null}
        onClose={() => setReminderOpen(false)}
      />
    </>
  );
};

const DailyCheckmark: React.FC<{ done: boolean; color: string }> = ({ done, color }) => (
  <View style={[styles.checkmark, done && { backgroundColor: color, borderColor: color }]}>
    {done && <Text style={styles.checkmarkText}>✓</Text>}
  </View>
);

const VolumeIndicator: React.FC<{ count: number; target: number; color: string; done: boolean }> = ({
  count, target, color, done,
}) => (
  <View style={styles.volumeWrapper}>
    <Text style={[styles.volumeCount, done && { color }]}>
      {count}<Text style={styles.volumeTarget}>/{target}</Text>
    </Text>
    <View style={styles.volBar}>
      <View
        style={[
          styles.volFill,
          { width: `${Math.min((count / target) * 100, 100)}%`, backgroundColor: done ? color : color + 'BB' },
        ]}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1B2E',
    borderRadius: 16, padding: 14, marginHorizontal: 16, marginVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardDone: { borderColor: 'rgba(108,99,255,0.3)' },
  burstRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16, borderWidth: 2, pointerEvents: 'none',
  },
  leftSection: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  nameDone: { opacity: 0.6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  streak: { color: '#FFB347', fontSize: 11 },
  reminderPill: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reminderText: { fontSize: 11, fontWeight: '600' },
  setReminderBtn: { paddingVertical: 1 },
  setReminderText: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  rightSection: { marginLeft: 12 },
  checkmark: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  volumeWrapper: { alignItems: 'flex-end', minWidth: 60 },
  volumeCount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  volumeTarget: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '400' },
  volBar: { width: 56, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  volFill: { height: '100%', borderRadius: 2 },
});
