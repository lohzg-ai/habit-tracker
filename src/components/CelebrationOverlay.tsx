import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
};

export const CelebrationOverlay: React.FC<Props> = ({ visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.5);
      translateY.setValue(40);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      // auto-fade out
      const t = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      }, 2400);
      return () => clearTimeout(t);
    }
  }, [visible, opacity, scale, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity }]}
    >
      <Animated.View style={[styles.pill, { transform: [{ scale }, { translateY }] }]}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.text}>All done today!</Text>
      </Animated.View>
      <Particles />
    </Animated.View>
  );
};

const PARTICLE_COUNT = 12;

const Particles: React.FC = () => {
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      xy: new Animated.ValueXY({ x: 0, y: 0 }),
      op: new Animated.Value(1),
    })),
  ).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const dist = 60 + Math.random() * 60;
      anim.xy.setValue({ x: 0, y: 0 });
      anim.op.setValue(1);
      Animated.parallel([
        Animated.timing(anim.xy, {
          toValue: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
          duration: 700 + Math.random() * 200,
          useNativeDriver: true,
        }),
        Animated.timing(anim.op, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });
  }, [anims]);

  const colors = ['#6C63FF', '#FFB347', '#43D9B8', '#FF6584'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: colors[i % colors.length],
              opacity: anim.op,
              transform: [
                { translateX: anim.xy.x },
                { translateY: anim.xy.y },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 27, 46, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  emoji: { fontSize: 24 },
  text: { color: '#fff', fontSize: 18, fontWeight: '700' },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: 'center',
    top: '50%',
    left: '50%',
  },
});
