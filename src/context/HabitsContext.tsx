import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  AppData,
  CompletedChallengeInfo,
  CustomChallenge,
  Habit,
  HabitLog,
  HabitReminder,
  HabitType,
} from '../types';
import { loadData, saveData, clearData } from '../storage';
import { today, daysBetween, daysAgo, addDays } from '../utils/date';
import { tapMedium, celebrate, bigCelebrate } from '../utils/haptics';
import { playHabitComplete, playAllDone } from '../utils/sound';
import {
  scheduleHabitReminder,
  cancelHabitReminder,
  requestPermissions,
} from '../utils/notifications';

export type NewHabitInput = {
  name: string;
  type: HabitType;
  targetCount: number;
  emoji: string;
  color: string;
  reminder: HabitReminder | null;
};

// Returns habits scoped to a challenge's habitIds (empty = all)
export const resolveHabitsForChallenge = (habitIds: string[], allHabits: Habit[]): Habit[] => {
  if (!habitIds || habitIds.length === 0) return allHabits;
  return allHabits.filter((h) => habitIds.includes(h.id));
};

type HabitsContextType = {
  data: AppData;
  loading: boolean;
  getTodayCount: (habitId: string) => number;
  isHabitDoneToday: (habitId: string) => boolean;
  allDoneToday: boolean;
  showAllDoneBanner: boolean;
  challengeDay: number | null;
  challengeActive: boolean;
  challengeJustCompleted: CompletedChallengeInfo | null;
  logHabit: (habitId: string) => Promise<void>;
  addHabit: (input: NewHabitInput) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  updateHabitReminder: (habitId: string, reminder: HabitReminder | null) => Promise<void>;
  completeOnboarding: (habits: NewHabitInput[]) => Promise<void>;
  dismissChallengeReward: () => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  createCustomChallenge: (input: { name: string; description: string; durationDays: number; habitIds: string[] }) => Promise<void>;
  deleteCustomChallenge: (id: string) => Promise<void>;
  updateChallengeHabits: (type: 'main' | string, habitIds: string[]) => Promise<void>;
  // Dev helpers
  devSimulateChallengeDay: (day: 1 | 2 | 3) => Promise<void>;
  devCompleteFullChallenge: (type: 'main' | string) => Promise<void>;
  devSimulateNextNDays: (n: number) => Promise<void>;
  devForceTriggerReward: () => void;
  devResetAll: () => Promise<void>;
  devResetOnboarding: () => Promise<void>;
  devCompleteAllHabitsToday: (filterHabitIds?: string[]) => Promise<void>;
};

const HabitsContext = createContext<HabitsContextType | null>(null);

export const useHabits = () => {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within HabitsProvider');
  return ctx;
};

export const HabitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>({
    habits: [],
    logs: [],
    challenge: null,
    customChallenges: [],
    onboardingComplete: false,
    notificationsEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [challengeJustCompleted, setChallengeJustCompleted] =
    useState<CompletedChallengeInfo | null>(null);
  const [showAllDoneBanner, setShowAllDoneBanner] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData().then((d) => { setData(d); setLoading(false); });
  }, []);

  const persist = useCallback(async (newData: AppData) => {
    setData(newData);
    await saveData(newData);
  }, []);

  const getTodayCount = useCallback(
    (habitId: string) => {
      const t = today();
      return data.logs.find((l) => l.habitId === habitId && l.date === t)?.count ?? 0;
    },
    [data.logs],
  );

  const isHabitDoneToday = useCallback(
    (habitId: string) => {
      const habit = data.habits.find((h) => h.id === habitId);
      if (!habit) return false;
      return getTodayCount(habitId) >= habit.targetCount;
    },
    [data.habits, getTodayCount],
  );

  const allDoneToday = data.habits.length > 0 && data.habits.every((h) => isHabitDoneToday(h.id));
  const challengeActive = !!data.challenge && !data.challenge.rewarded;
  const challengeDay = data.challenge
    ? Math.min(daysBetween(data.challenge.startDate, today()) + 1, data.challenge.durationDays)
    : null;

  const checkAllChallenges = useCallback((updatedData: AppData): AppData => {
    const isAllDoneForHabitsOnDate = (habitIds: string[], date: string): boolean => {
      const habits = resolveHabitsForChallenge(habitIds, updatedData.habits);
      return habits.length > 0 && habits.every((habit) => {
        const log = updatedData.logs.find((l) => l.habitId === habit.id && l.date === date);
        return (log?.count ?? 0) >= habit.targetCount;
      });
    };

    // Check main kickstart challenge
    if (updatedData.challenge && !updatedData.challenge.rewarded) {
      const { startDate, durationDays, habitIds } = updatedData.challenge;
      let allComplete = true;
      for (let i = 0; i < durationDays; i++) {
        if (!isAllDoneForHabitsOnDate(habitIds, addDays(startDate, i))) {
          allComplete = false;
          break;
        }
      }
      if (allComplete) {
        setChallengeJustCompleted({ name: '3-Day Kickstart', days: durationDays, type: 'main' });
        return { ...updatedData, challenge: { ...updatedData.challenge, rewarded: true } };
      }
    }

    // Check custom challenges
    for (const cc of updatedData.customChallenges) {
      if (!cc.rewarded) {
        let allComplete = true;
        for (let i = 0; i < cc.durationDays; i++) {
          if (!isAllDoneForHabitsOnDate(cc.habitIds, addDays(cc.startDate, i))) {
            allComplete = false;
            break;
          }
        }
        if (allComplete) {
          setChallengeJustCompleted({ name: cc.name, days: cc.durationDays, type: 'custom', customId: cc.id });
          return {
            ...updatedData,
            customChallenges: updatedData.customChallenges.map((c) =>
              c.id === cc.id ? { ...c, rewarded: true } : c,
            ),
          };
        }
      }
    }
    return updatedData;
  }, []);

  const logHabit = useCallback(async (habitId: string) => {
    const habit = data.habits.find((h) => h.id === habitId);
    if (!habit) return;

    const t = today();
    const existingIdx = data.logs.findIndex((l) => l.habitId === habitId && l.date === t);
    const currentCount = existingIdx >= 0 ? data.logs[existingIdx].count : 0;
    const wasDone = currentCount >= habit.targetCount;

    const newCount = habit.type === 'daily'
      ? (wasDone ? 0 : 1)
      : (wasDone ? 0 : currentCount + 1);

    const newLogs = [...data.logs];
    if (existingIdx >= 0) {
      newLogs[existingIdx] = { ...newLogs[existingIdx], count: newCount };
    } else {
      newLogs.push({ id: `${habitId}_${t}`, habitId, date: t, count: newCount });
    }

    const isNowDone = newCount >= habit.targetCount;
    let newStreak = habit.streak;
    let newBestStreak = habit.bestStreak;

    if (isNowDone && !wasDone) {
      let streak = 1;
      let checkDate = t;
      while (true) {
        checkDate = addDays(checkDate, -1);
        const prevLog = newLogs.find((l) => l.habitId === habitId && l.date === checkDate);
        if (!prevLog || prevLog.count < habit.targetCount) break;
        streak++;
      }
      newStreak = streak;
      newBestStreak = Math.max(streak, habit.bestStreak);
    } else if (!isNowDone && wasDone) {
      newStreak = Math.max(0, habit.streak - 1);
    }

    const newHabits = data.habits.map((h) =>
      h.id === habitId ? { ...h, streak: newStreak, bestStreak: newBestStreak } : h,
    );

    let newData: AppData = { ...data, habits: newHabits, logs: newLogs };
    newData = checkAllChallenges(newData);

    if (isNowDone && !wasDone) {
      const allNowDone = newHabits.every((h) => {
        const log = newLogs.find((l) => l.habitId === h.id && l.date === t);
        return (log?.count ?? 0) >= h.targetCount;
      });
      if (allNowDone) {
        playAllDone();
        bigCelebrate();
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        setShowAllDoneBanner(true);
        bannerTimer.current = setTimeout(() => setShowAllDoneBanner(false), 3500);
      } else {
        playHabitComplete();
        celebrate();
      }
    } else if (!isNowDone && !wasDone && habit.type === 'volume') {
      tapMedium();
    }

    await persist(newData);
  }, [data, persist, checkAllChallenges]);

  const addHabit = useCallback(async (input: NewHabitInput) => {
    const habit: Habit = {
      id: Date.now().toString(),
      name: input.name,
      type: input.type,
      targetCount: input.targetCount,
      emoji: input.emoji,
      color: input.color,
      streak: 0,
      bestStreak: 0,
      createdAt: new Date().toISOString(),
      reminder: input.reminder,
    };
    if (habit.reminder?.enabled) {
      const granted = await requestPermissions();
      if (granted) await scheduleHabitReminder(habit);
    }
    await persist({ ...data, habits: [...data.habits, habit] });
  }, [data, persist]);

  const deleteHabit = useCallback(async (habitId: string) => {
    await cancelHabitReminder(habitId);
    await persist({
      ...data,
      habits: data.habits.filter((h) => h.id !== habitId),
      logs: data.logs.filter((l) => l.habitId !== habitId),
    });
  }, [data, persist]);

  const updateHabitReminder = useCallback(async (habitId: string, reminder: HabitReminder | null) => {
    const habit = data.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const updatedHabit = { ...habit, reminder };
    if (reminder?.enabled) {
      const granted = await requestPermissions();
      if (granted) await scheduleHabitReminder(updatedHabit);
    } else {
      await cancelHabitReminder(habitId);
    }
    await persist({ ...data, habits: data.habits.map((h) => (h.id === habitId ? updatedHabit : h)) });
  }, [data, persist]);

  const completeOnboarding = useCallback(async (habits: NewHabitInput[]) => {
    const newHabits: Habit[] = habits.map((input, i) => ({
      id: `onb_${i}_${Date.now()}`,
      name: input.name,
      type: input.type,
      targetCount: input.targetCount,
      emoji: input.emoji,
      color: input.color,
      streak: 0,
      bestStreak: 0,
      createdAt: new Date().toISOString(),
      reminder: input.reminder ?? null,
    }));
    const habitIds = newHabits.map((h) => h.id);
    await persist({
      ...data,
      habits: newHabits,
      challenge: { startDate: today(), durationDays: 3, rewarded: false, habitIds },
      customChallenges: [],
      onboardingComplete: true,
    });
  }, [data, persist]);

  const dismissChallengeReward = useCallback(async () => {
    setChallengeJustCompleted(null);
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    await persist({ ...data, notificationsEnabled: enabled });
  }, [data, persist]);

  const createCustomChallenge = useCallback(
    async (input: { name: string; description: string; durationDays: number; habitIds: string[] }) => {
      const cc: CustomChallenge = {
        id: Date.now().toString(),
        name: input.name,
        description: input.description,
        durationDays: input.durationDays,
        startDate: today(),
        rewarded: false,
        habitIds: input.habitIds,
      };
      await persist({ ...data, customChallenges: [...data.customChallenges, cc] });
    },
    [data, persist],
  );

  const deleteCustomChallenge = useCallback(async (id: string) => {
    await persist({ ...data, customChallenges: data.customChallenges.filter((c) => c.id !== id) });
  }, [data, persist]);

  const updateChallengeHabits = useCallback(async (type: 'main' | string, habitIds: string[]) => {
    if (type === 'main' && data.challenge) {
      await persist({ ...data, challenge: { ...data.challenge, habitIds } });
    } else {
      await persist({
        ...data,
        customChallenges: data.customChallenges.map((c) =>
          c.id === type ? { ...c, habitIds } : c,
        ),
      });
    }
  }, [data, persist]);

  // Recalculates streak/bestStreak for all habits from log history
  const recalcHabitStreaks = (habits: Habit[], logs: HabitLog[]): Habit[] => {
    return habits.map((habit) => {
      let streak = 0;
      let dateStr = today();
      while (true) {
        const log = logs.find((l) => l.habitId === habit.id && l.date === dateStr);
        if (!log || log.count < habit.targetCount) break;
        streak++;
        dateStr = addDays(dateStr, -1);
      }
      return { ...habit, streak, bestStreak: Math.max(streak, habit.bestStreak) };
    });
  };

  // ── Dev helpers ───────────────────────────────────────────────────────────

  const devCompleteAllHabitsToday = useCallback(async (filterHabitIds?: string[]) => {
    const t = today();
    const habitsToComplete = filterHabitIds
      ? data.habits.filter((h) => filterHabitIds.includes(h.id))
      : data.habits;
    const newLogs = [...data.logs];
    for (const habit of habitsToComplete) {
      const idx = newLogs.findIndex((l) => l.habitId === habit.id && l.date === t);
      if (idx >= 0) {
        newLogs[idx] = { ...newLogs[idx], count: habit.targetCount };
      } else {
        newLogs.push({ id: `dev_${habit.id}_${t}`, habitId: habit.id, date: t, count: habit.targetCount });
      }
    }
    const reCalcHabits = recalcHabitStreaks(data.habits, newLogs);
    let newData: AppData = { ...data, habits: reCalcHabits, logs: newLogs };
    newData = checkAllChallenges(newData);
    if (!filterHabitIds) {
      bigCelebrate();
      setShowAllDoneBanner(true);
      bannerTimer.current = setTimeout(() => setShowAllDoneBanner(false), 3500);
    }
    await persist(newData);
  }, [data, persist, checkAllChallenges]);

  const devSimulateChallengeDay = useCallback(async (day: 1 | 2 | 3) => {
    const startDate = daysAgo(day - 1);
    const newLogs = [...data.logs];
    for (let i = 0; i < day - 1; i++) {
      const date = daysAgo(day - 1 - i);
      const habitsToFill = resolveHabitsForChallenge(data.challenge?.habitIds ?? [], data.habits);
      for (const habit of habitsToFill) {
        const idx = newLogs.findIndex((l) => l.habitId === habit.id && l.date === date);
        if (idx >= 0) {
          newLogs[idx] = { ...newLogs[idx], count: habit.targetCount };
        } else {
          newLogs.push({ id: `dev_${habit.id}_${date}`, habitId: habit.id, date, count: habit.targetCount });
        }
      }
    }
    const newChallenge = {
      startDate,
      durationDays: 3,
      rewarded: false,
      habitIds: data.challenge?.habitIds ?? [],
    };
    // Backdate createdAt so history/stats show data for all simulated days
    const backdatedHabits = data.habits.map((h) => ({
      ...h,
      createdAt: h.createdAt.slice(0, 10) > startDate
        ? startDate + 'T00:00:00.000Z'
        : h.createdAt,
    }));
    const reCalcHabits = recalcHabitStreaks(backdatedHabits, newLogs);
    await persist({ ...data, habits: reCalcHabits, challenge: newChallenge, logs: newLogs });
  }, [data, persist]);

  const devCompleteFullChallenge = useCallback(async (type: 'main' | string) => {
    const challenge = type === 'main'
      ? data.challenge
      : data.customChallenges.find((c) => c.id === type) ?? null;
    if (!challenge || challenge.rewarded) return;

    const { durationDays, habitIds } = challenge;
    // Rebase start date so the last day = today, ensuring all days are in the past/today
    const newStartDate = daysAgo(durationDays - 1);
    const habitsToFill = resolveHabitsForChallenge(habitIds, data.habits);

    const newLogs = [...data.logs];
    for (let i = 0; i < durationDays; i++) {
      const dateStr = addDays(newStartDate, i);
      for (const habit of habitsToFill) {
        const idx = newLogs.findIndex((l) => l.habitId === habit.id && l.date === dateStr);
        if (idx >= 0) {
          newLogs[idx] = { ...newLogs[idx], count: habit.targetCount };
        } else {
          newLogs.push({ id: `dev_${habit.id}_${dateStr}`, habitId: habit.id, date: dateStr, count: habit.targetCount });
        }
      }
    }

    // Backdate createdAt so history/stats screens show data for all simulated days
    const backdatedHabits = data.habits.map((h) => ({
      ...h,
      createdAt: h.createdAt.slice(0, 10) > newStartDate
        ? newStartDate + 'T00:00:00.000Z'
        : h.createdAt,
    }));
    const reCalcHabits = recalcHabitStreaks(backdatedHabits, newLogs);
    let newData: AppData;
    if (type === 'main') {
      newData = { ...data, habits: reCalcHabits, logs: newLogs, challenge: { ...data.challenge!, startDate: newStartDate, rewarded: false } };
    } else {
      newData = {
        ...data, habits: reCalcHabits, logs: newLogs,
        customChallenges: data.customChallenges.map((c) =>
          c.id === type ? { ...c, startDate: newStartDate, rewarded: false } : c,
        ),
      };
    }
    newData = checkAllChallenges(newData);
    await persist(newData);
  }, [data, persist, checkAllChallenges]);

  const devSimulateNextNDays = useCallback(async (n: number) => {
    const t = today();
    const newLogs = [...data.logs];
    for (let i = 1; i <= n; i++) {
      const dateStr = addDays(t, i);
      for (const habit of data.habits) {
        const idx = newLogs.findIndex((l) => l.habitId === habit.id && l.date === dateStr);
        if (idx >= 0) {
          newLogs[idx] = { ...newLogs[idx], count: habit.targetCount };
        } else {
          newLogs.push({ id: `dev_${habit.id}_${dateStr}`, habitId: habit.id, date: dateStr, count: habit.targetCount });
        }
      }
    }
    await persist({ ...data, logs: newLogs });
  }, [data, persist]);

  const devForceTriggerReward = useCallback(() => {
    setChallengeJustCompleted({ name: '3-Day Kickstart', days: 3, type: 'main' });
  }, []);

  const devResetOnboarding = useCallback(async () => {
    await persist({ ...data, onboardingComplete: false });
  }, [data, persist]);

  const devResetAll = useCallback(async () => {
    await clearData();
    setData({ habits: [], logs: [], challenge: null, customChallenges: [], onboardingComplete: false, notificationsEnabled: false });
    setChallengeJustCompleted(null);
  }, []);

  return (
    <HabitsContext.Provider value={{
      data, loading,
      getTodayCount, isHabitDoneToday,
      allDoneToday, showAllDoneBanner,
      challengeDay, challengeActive, challengeJustCompleted,
      logHabit, addHabit, deleteHabit, updateHabitReminder,
      completeOnboarding, dismissChallengeReward, toggleNotifications,
      createCustomChallenge, deleteCustomChallenge, updateChallengeHabits,
      devSimulateChallengeDay, devCompleteFullChallenge, devSimulateNextNDays, devForceTriggerReward, devResetAll, devResetOnboarding, devCompleteAllHabitsToday,
    }}>
      {children}
    </HabitsContext.Provider>
  );
};
