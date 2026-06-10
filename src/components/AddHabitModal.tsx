import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { HabitReminder, HabitType } from '../types';
import type { NewHabitInput } from '../context/HabitsContext';
import { tapLight } from '../utils/haptics';
import { fmt12h } from '../utils/notifications';

const EMOJIS = ['💧','🏃','📚','🧘','💪','🥗','😴','✍️','🎯','🎸','🌿','☀️','🧠','❤️','🦷','🚶','🍎','🧹'];
const COLORS = ['#6C63FF','#FF6584','#43D9B8','#FFB347','#5B8DEF','#FF8C42','#A8E6CF','#FF6B6B','#C77DFF','#00B4D8'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: NewHabitInput) => void;
};

export const AddHabitModal: React.FC<Props> = ({ visible, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('daily');
  const [targetCount, setTargetCount] = useState(1);
  const [emoji, setEmoji] = useState('🎯');
  const [color, setColor] = useState('#6C63FF');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(8);
  const [reminderMinute, setReminderMinute] = useState(0);

  const reset = () => {
    setName('');
    setType('daily');
    setTargetCount(1);
    setEmoji('🎯');
    setColor('#6C63FF');
    setReminderEnabled(false);
    setReminderHour(8);
    setReminderMinute(0);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const reminder: HabitReminder | null = reminderEnabled
      ? { enabled: true, hour: reminderHour, minute: reminderMinute }
      : null;
    onAdd({ name: name.trim(), type, targetCount, emoji, color, reminder });
    reset();
    onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  const adjustHour = (delta: number) => setReminderHour((h) => (h + 24 + delta) % 24);
  const adjustMinute = (delta: number) => setReminderMinute((m) => (m + 60 + delta) % 60);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>New Habit</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Drink water"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoFocus
            />

            {/* Type */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {(['daily', 'volume'] as HabitType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                  onPress={() => { tapLight(); setType(t); if (t === 'daily') setTargetCount(1); }}
                >
                  <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                    {t === 'daily' ? '✓  Once daily' : '🔢  Volume'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Target count */}
            {type === 'volume' && (
              <>
                <Text style={styles.label}>Target count per day</Text>
                <View style={styles.counterRow}>
                  <Pressable style={styles.counterBtn} onPress={() => { tapLight(); setTargetCount((v) => Math.max(1, v - 1)); }}>
                    <Text style={styles.counterBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.counterVal}>{targetCount}</Text>
                  <Pressable style={styles.counterBtn} onPress={() => { tapLight(); setTargetCount((v) => Math.min(100, v + 1)); }}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Emoji */}
            <Text style={styles.label}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <Pressable key={e} style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]} onPress={() => { tapLight(); setEmoji(e); }}>
                  <Text style={styles.emojiBtnText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            {/* Color */}
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable key={c} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]} onPress={() => { tapLight(); setColor(c); }} />
              ))}
            </View>

            {/* Reminder */}
            <View style={styles.reminderHeader}>
              <View>
                <Text style={styles.label}>Daily Reminder</Text>
                <Text style={styles.reminderSub}>
                  {reminderEnabled ? `Reminds you at ${fmt12h(reminderHour, reminderMinute)}` : 'No reminder set'}
                </Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(v) => { tapLight(); setReminderEnabled(v); }}
                trackColor={{ false: '#333', true: '#6C63FF' }}
                thumbColor="#fff"
              />
            </View>

            {reminderEnabled && (
              <View style={styles.timePicker}>
                {/* Hour */}
                <View style={styles.timeUnit}>
                  <Pressable style={styles.timeArrow} onPress={() => adjustHour(1)}>
                    <Text style={styles.timeArrowText}>▲</Text>
                  </Pressable>
                  <Text style={styles.timeValue}>{String(reminderHour).padStart(2, '0')}</Text>
                  <Pressable style={styles.timeArrow} onPress={() => adjustHour(-1)}>
                    <Text style={styles.timeArrowText}>▼</Text>
                  </Pressable>
                </View>
                <Text style={styles.timeSep}>:</Text>
                {/* Minute */}
                <View style={styles.timeUnit}>
                  <Pressable style={styles.timeArrow} onPress={() => adjustMinute(5)}>
                    <Text style={styles.timeArrowText}>▲</Text>
                  </Pressable>
                  <Text style={styles.timeValue}>{String(reminderMinute).padStart(2, '0')}</Text>
                  <Pressable style={styles.timeArrow} onPress={() => adjustMinute(-5)}>
                    <Text style={styles.timeArrowText}>▼</Text>
                  </Pressable>
                </View>
                <View style={styles.ampmCol}>
                  <Text style={styles.ampmText}>{reminderHour >= 12 ? 'PM' : 'AM'}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.addBtn, !name.trim() && styles.addBtnDisabled]}
              onPress={handleAdd}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>Add Habit</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: '#1A1726',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  typeBtnActive: { backgroundColor: '#6C63FF22', borderColor: '#6C63FF' },
  typeBtnText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13 },
  typeBtnTextActive: { color: '#6C63FF' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
  counterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { color: '#fff', fontSize: 20, fontWeight: '300' },
  counterVal: { color: '#fff', fontSize: 22, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  emojiBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiBtnActive: { borderColor: '#6C63FF', backgroundColor: '#6C63FF22' },
  emojiBtnText: { fontSize: 20 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  reminderSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeArrow: { padding: 8 },
  timeArrowText: { color: '#6C63FF', fontSize: 16 },
  timeValue: { color: '#fff', fontSize: 36, fontWeight: '700', minWidth: 54, textAlign: 'center' },
  timeSep: { color: '#fff', fontSize: 36, fontWeight: '300', paddingBottom: 4 },
  ampmCol: { marginLeft: 8 },
  ampmText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  addBtn: { backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
