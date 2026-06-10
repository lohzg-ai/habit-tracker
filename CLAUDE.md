# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**HabitFlow** — Expo + React Native habit tracker. Runs on iOS, Android, and web (via react-native-web). Persists data locally via AsyncStorage. No backend.

**SDK pinning:** Locked to **Expo SDK 54** (`expo@~54.0.35`, `react-native@0.81.5`, `react@19.1.0`). Do not upgrade — the device running Expo Go only supports SDK 54 (client version 1017756). Upgrading to SDK 55+ will break the Expo Go connection.

## Commands

Node is installed via nvm and is not in the default shell PATH. Prefix all node/npm/npx commands with:
```
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```

| Task | Command |
|------|---------|
| Start dev server | `npm start` |
| iOS simulator | `npm run ios` |
| Android emulator | `npm run android` |
| Web (Chrome) | `npm run web` |
| Type-check | `npx tsc --noEmit` |

No tests or linter configured. Always run `npx tsc --noEmit` after changes.

## Architecture

### Entry point & navigation

`App.tsx` wraps everything in `ErrorBoundary → SafeAreaProvider → NavigationContainer → HabitsProvider`. The `Root` component checks `data.onboardingComplete` — if false it renders `OnboardingScreen`, otherwise it renders the bottom tab navigator (`MainTabs`). The `Dev` tab is only mounted in `__DEV__` mode.

### State & persistence

All app state lives in `src/context/HabitsContext.tsx` (`HabitsProvider` + `useHabits` hook). It is the single source of truth — every screen reads from `data: AppData` and calls context mutations. State is persisted to AsyncStorage on every mutation via an internal `persist()` helper.

**`AppData` shape** (defined in `src/types.ts`):
```ts
{ habits: Habit[], logs: HabitLog[], challenge: Challenge | null,
  customChallenges: CustomChallenge[], onboardingComplete: boolean, notificationsEnabled: boolean }
```

- `Habit` — has `type: 'daily' | 'volume'`, `targetCount`, `streak`, `bestStreak`, `createdAt`, optional `reminder`
- `HabitLog` — `{ id, habitId, date: 'YYYY-MM-DD', count }`. Dev-simulated logs have ids prefixed `dev_`
- `Challenge` (kickstart) — fixed 3-day; `habitIds: []` means all habits (backward compat)
- `CustomChallenge` — user-defined name/duration/habitIds

### Date arithmetic — critical rule

**Never use `new Date(dateStr + 'T00:00:00')` + `.setDate()` + `.toISOString()` for date arithmetic.** This creates a local-time Date but `.toISOString()` returns UTC, causing a one-day shift in UTC+ timezones. Always use `addDays(dateStr, n)` from `src/utils/date.ts`, which uses `Date.UTC()` internally.

Key date utils (`src/utils/date.ts`):
- `today()` — current date as `YYYY-MM-DD`
- `addDays(dateStr, n)` — UTC-safe date offset, handles negative n
- `daysAgo(n)` — shorthand for `addDays(today(), -n)` (uses Date object, safe for display)
- `daysBetween(a, b)` — signed day count between two date strings

### Challenge logic

`resolveHabitsForChallenge(habitIds, allHabits)` — exported from HabitsContext. Empty `habitIds []` resolves to all habits (backward compat pattern used everywhere).

Challenge completion is checked in `checkAllChallenges()` inside HabitsContext after every `logHabit` call. It sets `challengeJustCompleted` which triggers the reward modal.

### Screens

| Screen | Key behaviour |
|--------|--------------|
| `TodayScreen` | FlatList of habits; horizontal filter bar for challenge views; `CelebrationOverlay` + `ChallengeRewardModal` |
| `HabitsScreen` | FlatList with challenge cards at top, habit rows below; FAB opens `AddHabitModal`; `SelectHabitsModal` for editing challenge habit links |
| `HistoryScreen` | Month calendar of `DaySummary` rows; forward nav unlocks when future simulated logs exist; simulated days show amber `SIM` badge |
| `StatsScreen` | Horizontal full-bar chart (7 days + up to 3 future simulated days shown in amber); habit streaks list; notifications toggle |
| `OnboardingScreen` | 4-step flow; single shared `ScrollView` with button pinned outside scroll at bottom |
| `DevScreen` | Only visible in `__DEV__`; simulate days, complete challenges, reset data |

### Simulated data (DevScreen)

DevScreen functions write logs with ids prefixed `dev_`. HistoryScreen and StatsScreen detect these to render `SIM` badges and amber styling. `devSimulateNextNDays(n)` writes logs for today+1 through today+n for all habits. `devCompleteFullChallenge` rebases challenge start so today = final day and fills all days.

### Utilities

- `src/utils/responsive.ts` — `webOuter` / `webInner` style objects constrain layout to `maxWidth: 520` on web
- `src/utils/sound.ts` — Web Audio API synth chime, no audio files
- `src/utils/haptics.ts` — wraps `expo-haptics`; no-ops on web
- `src/utils/notifications.ts` — wraps `expo-notifications`; skipped on web

### Styling conventions

- Background: `#0D0B1A`, card: `#1E1B2E`, header gradient: `#1A1726`
- Brand purple: `#6C63FF`, teal complete: `#43D9B8`, amber sim/future: `#FFB347`, purple sim: `#C77DFF`
- All styles are `StyleSheet.create` at the bottom of each file — no shared style file
- Use `SafeAreaView` with `edges={['top']}` for screen headers; navigation handles bottom safe area
- `FlatList` screens use `ListFooterComponent={<View style={{ height: 100 }} />}` for tab bar clearance
