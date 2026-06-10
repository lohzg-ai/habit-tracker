import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from './types';

const KEY = '@habitflow_data';

const DEFAULT: AppData = {
  habits: [],
  logs: [],
  challenge: null,
  customChallenges: [],
  onboardingComplete: false,
  notificationsEnabled: false,
};

export const loadData = async (): Promise<AppData> => {
  try {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return DEFAULT;
    const parsed = JSON.parse(json);
    // Normalise: ensure challenge has habitIds (backward compat)
    if (parsed.challenge && !parsed.challenge.habitIds) {
      parsed.challenge.habitIds = [];
    }
    if (Array.isArray(parsed.customChallenges)) {
      parsed.customChallenges = parsed.customChallenges.map((c: any) => ({
        ...c,
        habitIds: c.habitIds ?? [],
      }));
    }
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
};

export const saveData = async (data: AppData): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
};

export const clearData = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEY).catch(() => {});
};
