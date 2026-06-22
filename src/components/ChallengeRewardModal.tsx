import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { bigCelebrate } from '../utils/haptics';
import { playChallengeComplete } from '../utils/sound';

type Props = {
  visible: boolean;
  challengeName: string;
  challengeDays: number;
  onDismiss: () => void;
};

export const ChallengeRewardModal: React.FC<Props> = ({ visible, challengeName, challengeDays, onDismiss }) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;
  const star3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);
      star1.setValue(0);
      star2.setValue(0);
      star3.setValue(0);
      playChallengeComplete();
      bigCelebrate();
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        Animated.stagger(150, [
          Animated.spring(star1, { toValue: 1, useNativeDriver: true }),
          Animated.spring(star2, { toValue: 1, useNativeDriver: true }),
          Animated.spring(star3, { toValue: 1, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [visible, scaleAnim, opacityAnim, star1, star2, star3]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <BurstRing />
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.heading}>Challenge Complete!</Text>
          <Text style={styles.subheading}>{challengeName}</Text>

          <View style={styles.starsRow}>
            {[star1, star2, star3].map((anim, i) => (
              <Animated.Text key={i} style={[styles.star, { transform: [{ scale: anim }], opacity: anim }]}>⭐</Animated.Text>
            ))}
          </View>

          <View style={styles.statsRow}>
            <StatChip icon="🔥" label={`${challengeDays} Days`} sub="In a row" />
            <StatChip icon="💎" label="Habit" sub="Master" />
            <StatChip icon="✨" label="New" sub="Level" />
          </View>

          <Text style={styles.message}>
            {challengeDays} days of pure commitment. That discipline compounds — keep going.
          </Text>

          <TouchableOpacity style={styles.ctaBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Keep the streak going →</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const StatChip: React.FC<{ icon: string; label: string; sub: string }> = ({ icon, label, sub }) => (
  <View style={styles.statChip}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statSub}>{sub}</Text>
  </View>
);

const BURST_COUNT = 14;
const BurstRing: React.FC = () => {
  const anims = useRef(Array.from({ length: BURST_COUNT }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const loop = () => {
      anims.forEach((a) => a.setValue(0));
      Animated.stagger(25, anims.map((a) =>
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 500, delay: 400, useNativeDriver: true }),
        ]),
      )).start();
    };
    loop();
    const t = setInterval(loop, 1800);
    return () => clearInterval(t);
  }, [anims]);
  const colors = ['#6C63FF', '#FFB347', '#FF6584', '#43D9B8', '#5B8DEF', '#C77DFF'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((anim, i) => {
        const angle = (i / BURST_COUNT) * Math.PI * 2;
        const dist = 120 + (i % 3) * 22;
        return (
          <Animated.View key={i} style={[styles.burst, {
            backgroundColor: colors[i % colors.length],
            opacity: anim,
            transform: [
              { translateX: anim.interpolate({ inputRange: [0,1], outputRange: [0, Math.cos(angle)*dist] }) },
              { translateY: anim.interpolate({ inputRange: [0,1], outputRange: [0, Math.sin(angle)*dist] }) },
              { scale: anim },
            ],
          }]} />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1A1726', borderRadius: 28, padding: 28, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#6C63FF55', shadowColor: '#6C63FF', shadowOffset: { width:0,height:0 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 20, overflow: 'hidden' },
  burst: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: '50%', left: '50%' },
  trophy: { fontSize: 60, marginBottom: 12 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subheading: { color: '#6C63FF', fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 20, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  star: { fontSize: 34 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statChip: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(108,99,255,0.15)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)' },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  message: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 4 },
  ctaBtn: { backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
