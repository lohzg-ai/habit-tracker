import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { ai } from '../lib/ai';
import { today } from '../utils/date';
import type { AiNudge } from '../types';

const autoAttemptKey = (userId: string) => `@habitflow_coach_auto_${userId}_${today()}`;

export const CoachCard: React.FC = () => {
  const { user } = useAuth();
  const [nudge, setNudge] = useState<AiNudge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // On mount: show the latest cached nudge immediately, then silently regenerate
  // in the background (once per day) so the user always has fresh coaching without tapping anything.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const latest = await ai.fetchLatestNudge(user.id);
      if (cancelled) return;
      setNudge(latest);
      setLoadedOnce(true);

      const isStale = !latest || latest.createdAt.slice(0, 10) !== today();
      if (!isStale) return;

      const attemptKey = autoAttemptKey(user.id);
      const alreadyAttempted = await AsyncStorage.getItem(attemptKey);
      if (alreadyAttempted || cancelled) return;
      await AsyncStorage.setItem(attemptKey, '1');

      setLoading(true);
      const { nudge: fresh } = await ai.generateNudge();
      if (!cancelled) {
        if (fresh) setNudge(fresh);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const { nudge: fresh, error: err } = await ai.generateNudge();
    if (fresh) setNudge(fresh);
    if (err) setError(err);
    setLoading(false);
  };

  if (!loadedOnce) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>✨ Coach</Text>
        <Pressable onPress={handleRefresh} disabled={loading} hitSlop={10} style={styles.refreshBtn}>
          {loading ? (
            <ActivityIndicator size="small" color="#6C63FF" />
          ) : (
            <Text style={styles.refreshText}>{nudge ? 'Refresh' : 'Get insight'}</Text>
          )}
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : nudge ? (
        <Text style={styles.message}>{nudge.message}</Text>
      ) : loading ? (
        <Text style={styles.placeholder}>Putting together today's insight…</Text>
      ) : (
        <Text style={styles.placeholder}>Tap "Get insight" for a personalized nudge based on your habit data.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#1E1B2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(108,99,255,0.15)' },
  refreshText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  message: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  placeholder: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  errorText: { color: '#FF6B6B', fontSize: 12 },
});
