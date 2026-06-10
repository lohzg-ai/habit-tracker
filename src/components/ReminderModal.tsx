import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Habit } from '../types';
import { useHabits } from '../context/HabitsContext';
import { fmt12h } from '../utils/notifications';
import { tapLight, celebrate } from '../utils/haptics';

type Props = { habit: Habit | null; onClose: () => void };

export const ReminderModal: React.FC<Props> = ({ habit, onClose }) => {
  const { updateHabitReminder } = useHabits();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (habit) {
      setEnabled(habit.reminder?.enabled ?? false);
      setHour(habit.reminder?.hour ?? 8);
      setMinute(habit.reminder?.minute ?? 0);
    }
  }, [habit?.id]);

  const save = async () => {
    if (!habit) return;
    celebrate();
    await updateHabitReminder(habit.id, enabled ? { enabled: true, hour, minute } : null);
    onClose();
  };

  const adjHour = (d: 1 | -1) => {
    tapLight();
    setHour((h) => (h + d + 24) % 24);
  };

  const adjMinute = (d: 1 | -1) => {
    tapLight();
    setMinute((m) => { const n = m + d * 5; return n < 0 ? 55 : n >= 60 ? 0 : n; });
  };

  const toggleAmPm = () => setHour((h) => (h + 12) % 24);

  if (!habit) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={[styles.habitEmoji, { backgroundColor: habit.color + '33' }]}>
            <Text style={{ fontSize: 18 }}>{habit.emoji}</Text>
          </View>
          <View>
            <Text style={styles.title}>Daily Reminder</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{habit.name}</Text>
          </View>
        </View>

        {/* Toggle */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => { tapLight(); setEnabled((v) => !v); }}
        >
          <View>
            <Text style={styles.toggleLabel}>Remind me daily</Text>
            <Text style={styles.toggleMeta}>
              {enabled ? `At ${fmt12h(hour, minute)} every day` : 'No reminder set'}
            </Text>
          </View>
          <View style={[styles.toggle, enabled && styles.toggleOn]}>
            <View style={[styles.toggleThumb, enabled && styles.toggleThumbOn]} />
          </View>
        </Pressable>

        {/* Time picker */}
        {enabled && (
          <View style={styles.pickerWrapper}>
            <View style={styles.picker}>
              {/* Hour */}
              <View style={styles.timeCol}>
                <Pressable onPress={() => adjHour(1)} style={styles.arrowBtn} hitSlop={8}>
                  <Text style={styles.arrow}>▲</Text>
                </Pressable>
                <Text style={styles.timeNum}>{String(hour % 12 || 12).padStart(2, '0')}</Text>
                <Pressable onPress={() => adjHour(-1)} style={styles.arrowBtn} hitSlop={8}>
                  <Text style={styles.arrow}>▼</Text>
                </Pressable>
              </View>

              <Text style={styles.colon}>:</Text>

              {/* Minute */}
              <View style={styles.timeCol}>
                <Pressable onPress={() => adjMinute(1)} style={styles.arrowBtn} hitSlop={8}>
                  <Text style={styles.arrow}>▲</Text>
                </Pressable>
                <Text style={styles.timeNum}>{String(minute).padStart(2, '0')}</Text>
                <Pressable onPress={() => adjMinute(-1)} style={styles.arrowBtn} hitSlop={8}>
                  <Text style={styles.arrow}>▼</Text>
                </Pressable>
              </View>

              {/* AM/PM */}
              <Pressable onPress={toggleAmPm} style={styles.ampmBtn}>
                <Text style={[styles.ampm, hour < 12 ? styles.ampmActive : styles.ampmInactive]}>AM</Text>
                <Text style={[styles.ampm, hour >= 12 ? styles.ampmActive : styles.ampmInactive]}>PM</Text>
              </Pressable>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Save Reminder</Text>
        </TouchableOpacity>
        {enabled && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={async () => {
              await updateHabitReminder(habit.id, null);
              onClose();
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.clearBtnText}>Remove reminder</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 20 }} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1A1726', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  habitEmoji: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 1 },
  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 16 },
  toggleLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggleMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', padding: 2 },
  toggleOn: { backgroundColor: '#6C63FF' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  // Time picker
  pickerWrapper: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeCol: { alignItems: 'center', gap: 6, minWidth: 52 },
  arrowBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  arrow: { color: '#6C63FF', fontSize: 16, fontWeight: '700' },
  timeNum: { color: '#fff', fontSize: 36, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  colon: { color: '#fff', fontSize: 36, fontWeight: '700', marginBottom: 4 },
  ampmBtn: { marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, gap: 8 },
  ampm: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  ampmActive: { color: '#6C63FF' },
  ampmInactive: { color: 'rgba(255,255,255,0.25)' },
  // Buttons
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clearBtn: { paddingVertical: 10, alignItems: 'center' },
  clearBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
});
