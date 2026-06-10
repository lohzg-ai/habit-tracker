import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHabits } from '../context/HabitsContext';
import { tapLight, celebrate } from '../utils/haptics';

type Props = { visible: boolean; onClose: () => void };

const DURATIONS = [3, 5, 7, 14, 21, 30];

type Step = 'details' | 'habits';

export const CreateChallengeModal: React.FC<Props> = ({ visible, onClose }) => {
  const { createCustomChallenge, data } = useHabits();
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(7);
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(new Set());

  const reset = () => {
    setStep('details');
    setName('');
    setDescription('');
    setDuration(7);
    setSelectedHabits(new Set());
  };

  const handleClose = () => { reset(); onClose(); };

  const handleNext = async () => {
    if (!name.trim()) return;
    if (data.habits.length === 0) {
      // No habits yet — create challenge directly with empty habitIds (= all habits)
      await createCustomChallenge({ name: name.trim(), description: description.trim(), durationDays: duration, habitIds: [] });
      celebrate();
      reset();
      onClose();
      return;
    }
    // Pre-select all habits when entering step 2
    setSelectedHabits(new Set(data.habits.map((h) => h.id)));
    setStep('habits');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const habitIds = Array.from(selectedHabits);
    await createCustomChallenge({
      name: name.trim(),
      description: description.trim(),
      durationDays: duration,
      habitIds,
    });
    celebrate();
    reset();
    onClose();
  };

  const toggleHabit = (id: string) => {
    tapLight();
    setSelectedHabits((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        if (s.size > 1) s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrapper}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, step === 'details' && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step === 'habits' && styles.stepDotActive]} />
          </View>

          {step === 'details' ? (
            <>
              <Text style={styles.title}>New Challenge</Text>

              <Text style={styles.label}>Challenge name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 7-Day Consistency"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
                maxLength={40}
                autoFocus
              />

              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="What's the goal of this challenge?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={description}
                onChangeText={setDescription}
                maxLength={120}
                multiline
              />

              <Text style={styles.label}>Duration</Text>
              <View style={styles.durRow}>
                {DURATIONS.map((d) => (
                  <Pressable
                    key={d}
                    style={[styles.durBtn, duration === d && styles.durBtnActive]}
                    onPress={() => { tapLight(); setDuration(d); }}
                  >
                    <Text style={[styles.durBtnText, duration === d && styles.durBtnTextActive]}>
                      {d}d
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.durNote}>
                Complete linked habits every day for {duration} consecutive days.
              </Text>

              <TouchableOpacity
                style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.createBtnText}>
                  {data.habits.length > 0 ? 'Next: Select Habits →' : 'Start Challenge 🏁'}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Link Habits</Text>
              <Text style={styles.subtitle}>
                Choose which habits count toward "{name}". You need to complete all selected habits each day.
              </Text>

              <ScrollView style={styles.habitsList} showsVerticalScrollIndicator={false}>
                {data.habits.map((habit) => {
                  const isSelected = selectedHabits.has(habit.id);
                  return (
                    <Pressable
                      key={habit.id}
                      style={[styles.habitRow, isSelected && styles.habitRowSelected]}
                      onPress={() => toggleHabit(habit.id)}
                    >
                      <View style={[styles.habitEmoji, { backgroundColor: habit.color + '33' }]}>
                        <Text style={{ fontSize: 18 }}>{habit.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <Text style={styles.habitMeta}>
                          {habit.type === 'volume' ? `${habit.targetCount}× per day` : 'Once daily'}
                        </Text>
                      </View>
                      <View style={[styles.check, isSelected && { backgroundColor: habit.color, borderColor: habit.color }]}>
                        {isSelected && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })}
                <View style={{ height: 16 }} />
              </ScrollView>

              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('details')} activeOpacity={0.75}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtnSmall, selectedHabits.size === 0 && styles.createBtnDisabled]}
                  onPress={handleCreate}
                  activeOpacity={0.85}
                  disabled={selectedHabits.size === 0}
                >
                  <Text style={styles.createBtnText}>Start Challenge 🏁</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: { backgroundColor: '#1A1726', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 0 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepDotActive: { backgroundColor: '#6C63FF', width: 20 },
  stepLine: { width: 24, height: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  inputMulti: { height: 72, textAlignVertical: 'top' },
  durRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  durBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'transparent' },
  durBtnActive: { backgroundColor: '#6C63FF22', borderColor: '#6C63FF' },
  durBtnText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 14 },
  durBtnTextActive: { color: '#6C63FF' },
  durNote: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20 },
  createBtn: { backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnSmall: { flex: 1, backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Habit selection
  habitsList: { maxHeight: 300 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  habitRowSelected: { borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.1)' },
  habitEmoji: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  habitName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  habitMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' },
  backBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
});
