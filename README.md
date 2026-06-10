# HabitFlow

A habit tracker built with Expo and React Native. Runs on iOS, Android, and web (via react-native-web). All data is persisted locally — no backend or account required.

Built with Claude Code.

## Features

### Habit tracking
- Create **daily** habits (done/not done) or **volume** habits (track a count toward a target)
- Assign each habit a name, emoji, and color
- One-tap logging from the Today screen; volume habits support incremental count tapping
- Streaks and best-streak tracking per habit

### Challenges
- **Kickstart challenge** — built-in 3-day challenge across all (or selected) habits
- **Custom challenges** — user-defined name, duration, and habit selection
- Completion reward modal with celebration overlay and synth chime on finish

### Reminders
- Per-habit push notification reminders with configurable time
- Global notifications toggle in Stats screen

### History
- Monthly calendar view with day-by-day completion summaries
- Simulated future days shown with an amber `SIM` badge (dev only)

### Stats
- 7-day horizontal bar chart (+ up to 3 simulated future days in amber)
- Habit streak leaderboard

### Onboarding
- 4-step guided onboarding on first launch

### Dev tools (debug builds only)
- Simulate N days of logs
- Fast-complete challenges
- Reset all data

## Tech stack

| | |
|---|---|
| Framework | Expo SDK 54 |
| UI | React Native 0.81.5 + React 19 |
| Navigation | React Navigation v7 (bottom tabs + native stack) |
| State | React Context + AsyncStorage |
| Web | react-native-web |
| Graphics | react-native-svg (progress rings, bar charts) |
| Notifications | expo-notifications |
| Haptics | expo-haptics |

## Getting started

Node must be available. If using nvm:

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```

Install dependencies:

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server (scan QR with Expo Go) |
| `npm run ios` | Open in iOS Simulator |
| `npm run android` | Open in Android Emulator |
| `npm run web` | Open in browser |
| `npx tsc --noEmit` | Type-check |

> **SDK pinning:** Locked to Expo SDK 54. Do not upgrade — the target device running Expo Go only supports SDK 54 (client 1017756). Upgrading will break the Expo Go connection.

## Project structure

```
App.tsx                  Entry point, navigation, providers
src/
  context/
    HabitsContext.tsx    Single source of truth; all mutations + AsyncStorage persistence
  screens/
    TodayScreen.tsx      Daily habit list, challenge filter, celebration overlay
    HabitsScreen.tsx     Habit management, challenge cards, FAB, modals
    HistoryScreen.tsx    Monthly calendar view
    StatsScreen.tsx      Bar chart, streak list, notifications toggle
    OnboardingScreen.tsx 4-step first-launch flow
    DevScreen.tsx        Dev-only simulation and reset tools
  components/
    AddHabitModal.tsx
    CelebrationOverlay.tsx
    ChallengeRewardModal.tsx
    CreateChallengeModal.tsx
    HabitCard.tsx
    ProgressRing.tsx
    ReminderModal.tsx
    SelectHabitsModal.tsx
  utils/
    date.ts              UTC-safe date helpers (today, addDays, daysBetween)
    notifications.ts     expo-notifications wrapper (no-op on web)
    haptics.ts           expo-haptics wrapper (no-op on web)
    sound.ts             Web Audio API synth chime
    responsive.ts        Max-width layout helpers for web
  types.ts               Shared TypeScript types
  storage.ts             AsyncStorage read/write helpers
```

## Data model

All state is stored in `AppData` in AsyncStorage:

```ts
type AppData = {
  habits: Habit[];              // id, name, type, targetCount, emoji, color, streak, bestStreak, reminder
  logs: HabitLog[];             // id, habitId, date (YYYY-MM-DD), count
  challenge: Challenge | null;  // built-in kickstart challenge
  customChallenges: CustomChallenge[];
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
};
```

## Date arithmetic note

All date math uses `addDays(dateStr, n)` from `src/utils/date.ts` (UTC-safe). Never combine `new Date(dateStr + 'T00:00:00')` + `.setDate()` + `.toISOString()` — that pattern causes a one-day shift in UTC+ timezones.
