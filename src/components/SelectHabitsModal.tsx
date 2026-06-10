import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHabits } from '../context/HabitsContext';
import { tapLight } from '../utils/haptics';

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  initialSelected: string[]; // habit IDs
  minSelected?: number;
  onConfirm: (habitIds: string[]) => void;
  onClose: () => void;
};

export const SelectHabitsModal: React.FC<Props> = ({
  visible,
  title = 'Select Habits',
  subtitle,
  initialSelected,
  minSelected = 1,
  onConfirm,
  onClose,
}) => {
  const { data } = useHabits();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  useEffect(() => {
    if (visible) setSelected(new Set(initialSelected));
  }, [visible, initialSelected]);

  const toggle = (id: string) => {
    tapLight();
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) {
        if (s.size > minSelected) s.delete(id);
      } else {
        s.add(id);
      }
      return s;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {data.habits.length === 0 ? (
            <Text style={styles.empty}>No habits yet. Add habits from the Habits tab first.</Text>
          ) : (
            data.habits.map((habit) => {
              const isSelected = selected.has(habit.id);
              return (
                <Pressable
                  key={habit.id}
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => toggle(habit.id)}
                >
                  <View style={[styles.emoji, { backgroundColor: habit.color + '33' }]}>
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
            })
          )}
          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerCount}>{selected.size} habit{selected.size !== 1 ? 's' : ''} selected</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, selected.size < minSelected && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={selected.size < minSelected}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1A1726', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  list: { marginTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'transparent',
  },
  rowSelected: { borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.1)' },
  emoji: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  habitName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  habitMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 20, fontSize: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  footerCount: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  confirmBtn: { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
