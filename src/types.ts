export type HabitType = 'daily' | 'volume';

export type HabitReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export type Habit = {
  id: string;
  name: string;
  type: HabitType;
  targetCount: number;
  emoji: string;
  color: string;
  streak: number;
  bestStreak: number;
  createdAt: string;
  reminder: HabitReminder | null;
};

export type HabitLog = {
  id: string;
  habitId: string;
  date: string;
  count: number;
};

export type Challenge = {
  startDate: string;
  durationDays: number;
  rewarded: boolean;
  habitIds: string[]; // empty [] = all habits (backward compat)
};

export type CustomChallenge = {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  startDate: string;
  rewarded: boolean;
  habitIds: string[]; // empty [] = all habits
};

export type AppData = {
  habits: Habit[];
  logs: HabitLog[];
  challenge: Challenge | null;
  customChallenges: CustomChallenge[];
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
};

export type CompletedChallengeInfo = {
  name: string;
  days: number;
  type: 'main' | 'custom';
  customId?: string;
};
