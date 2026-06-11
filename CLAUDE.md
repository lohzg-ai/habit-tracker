# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**HabitFlow** — Expo + React Native habit tracker. Runs on iOS, Android, and web (via react-native-web). Data persists locally via AsyncStorage (cache) and remotely via Supabase (source of truth). Authentication is email/password via Supabase Auth.

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

### Provider tree (App.tsx)

```
ErrorBoundary
└── SafeAreaProvider
    └── NavigationContainer
        └── AuthProvider          ← Supabase session, signIn/signUp/signOut
            └── AuthGate
                ├── (no session) → AuthScreen
                └── (session)
                    └── UserProfileProvider(key=userId)   ← display name, avatar, inactivity timeout
                        └── HabitsProvider(key=userId)    ← all habit/log/challenge state + Supabase sync
                            └── ProfileModalProvider      ← owns the profile modal, exposes openProfile()
                                └── AuthenticatedApp      ← inactivity timer + MainTabs
```

`key={user.id}` on `UserProfileProvider` and `HabitsProvider` forces a full remount on account switch, preventing data bleed between users.

### Authentication (`src/context/AuthContext.tsx`)

- Reads session from Supabase on mount; re-validates on `AppState` foreground event
- `signOut()` clears AsyncStorage (`clearData()`) then calls `supabase.auth.signOut()`
- Credentials in `.env` — never committed; see `.env.example` for required keys

### State & persistence (`src/context/HabitsContext.tsx`)

All habit data lives here. Every mutation goes through `persist(newData)`:
1. `setData` → instant React re-render
2. `saveData` → AsyncStorage write (fast local cache)
3. `scheduleSync` → 300 ms debounced `db.upsertAll()` fire-and-forget to Supabase

**Init sequence:** On mount, if `onboardingComplete` is true locally, AsyncStorage data is shown immediately and Supabase pulls in the background (cache-first). If false, Supabase is awaited first (handles new-device sign-in before local data exists).

**Explicit deletes** (`deleteHabit`, `deleteCustomChallenge`) await `db.deleteHabitAndLogs` / `db.deleteCustomChallenge` after persisting locally — awaited so a sign-out/sign-in cycle doesn't resurface the deleted record.

**`AppData` shape** (`src/types.ts`):
```ts
{ habits: Habit[], logs: HabitLog[], challenge: Challenge | null,
  customChallenges: CustomChallenge[], onboardingComplete: boolean, notificationsEnabled: boolean }
```
- `HabitLog.id` format: `${habitId}_${date}` for real logs, `dev_${habitId}_${date}` for simulated
- `Challenge.habitIds: []` means all habits (backward-compat; use `resolveHabitsForChallenge()` everywhere)

### Supabase layer (`src/lib/db.ts`, `src/lib/supabase.ts`)

Five tables: `habits`, `habit_logs`, `user_challenges` (PK: `user_id`), `custom_challenges`, `user_settings` (PK: `user_id`). All have RLS — `auth.uid() = user_id`. Schema is in `supabase/schema.sql`; run it once in the Supabase SQL editor to create tables and policies.

`db.upsertAll` uses explicit `onConflict` per table. `db.pushAll` is a full wipe + re-insert used only during onboarding and dev reset. Dev-mode Supabase errors are logged via `dblog` (`console.warn` in `__DEV__`).

`supabase.ts` uses `expo-secure-store` as the auth token storage adapter on native; falls back to in-memory on web.

### User profile (`src/context/UserProfileContext.tsx`)

Fetches `display_name`, `avatar_url`, `inactivity_timeout_mins` from `user_settings` on mount. `updateProfile` is optimistic (local state first, then `db.updateProfile`). `pickAndUploadAvatar` uses `expo-image-picker` → uploads blob to the `avatars` Storage bucket → saves public URL.

### Inactivity timer (`src/hooks/useInactivityTimer.ts`)

Returns `panHandlers` (spread on the root `View` in `AuthenticatedApp`). Uses `PanResponder` with `onStartShouldSetPanResponderCapture: () => false` so touches pass through to children. Polls every 30 s; calls `signOut()` when `Date.now() - lastActivityAt >= timeoutMs`. Re-validates on `AppState` foreground. Timeout is read from `profile.inactivityTimeoutMins` (null = never).

### Profile modal (`src/context/ProfileModalContext.tsx`)

Owns the `<Modal>` containing `ProfileScreen`. Any component can call `useProfileModal().openProfile()` to open it. `ScreenHeader` and the `TodayScreen` gradient header both call this hook. Placed inside `HabitsProvider` so `ProfileScreen` can access all contexts.

### Shared header (`src/components/ScreenHeader.tsx`)

Used by Habits, History, and Stats screens. Renders `SafeAreaView edges={['top']}` internally — screens must **not** add their own top SafeAreaView when using this component. Accepts `title`, optional `subtitle`, and optional `children` (rendered below the title row, used by HistoryScreen for the month navigator + stats chips).

### Screens

| Screen | Key behaviour |
|--------|--------------|
| `AuthScreen` | Email/password sign-in and sign-up tabs; "Check your email" confirmation state after sign-up |
| `TodayScreen` | Gradient header with `ProgressRing` + profile avatar; FlatList of habits; challenge filter bar; `CelebrationOverlay` + `ChallengeRewardModal` |
| `HabitsScreen` | FlatList with challenge cards at top, habit rows below; FAB opens `AddHabitModal`; `SelectHabitsModal` for editing challenge habit links |
| `HistoryScreen` | Month view of `DaySummary` rows (weekday + day + month abbreviation); forward nav unlocks when future simulated logs exist; SIM badge in amber |
| `StatsScreen` | 7-day bar chart (+ up to 3 future simulated days in amber); streak list; notifications toggle |
| `ProfileScreen` | Avatar upload, display name, inactivity timeout chips, password change, two-step sign-out confirmation (no `Alert.alert` — works on web) |
| `OnboardingScreen` | 4-step flow; centered on web via `webOuter`/`webInner`; calls `completeOnboarding()` which runs `db.pushAll` |
| `DevScreen` | `__DEV__` only; simulate days, complete challenges, reset data |

### Date arithmetic — critical rule

**Never use `new Date(dateStr + 'T00:00:00')` + `.setDate()` + `.toISOString()`** — `.toISOString()` returns UTC, causing a one-day shift in UTC+ timezones. Always use `addDays(dateStr, n)` from `src/utils/date.ts` (uses `Date.UTC()` internally).

Key date utils:
- `today()` → `YYYY-MM-DD`
- `addDays(dateStr, n)` → UTC-safe offset (handles negative n)
- `daysAgo(n)` → shorthand for display use
- `daysBetween(a, b)` → signed day count

### Styling conventions

- Background: `#0D0B1A`, card: `#1E1B2E`, header gradient: `#1A1726`
- Brand purple: `#6C63FF`, teal complete: `#43D9B8`, amber sim/future: `#FFB347`, purple sim: `#C77DFF`
- All styles are `StyleSheet.create` at the bottom of each file — no shared style file
- Web centering: wrap screen content in `<View style={webOuter}><View style={webInner}>` (`src/utils/responsive.ts`) — `webOuter` centres, `webInner` caps at `maxWidth: 520`
- `FlatList` screens use `ListFooterComponent={<View style={{ height: 100 }} />}` for tab bar clearance
- `SafeAreaView` with `edges={['top']}` for screen headers (already handled inside `ScreenHeader`)
