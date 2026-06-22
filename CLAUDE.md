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
| Type-check | `npm run typecheck` (alias for `tsc --noEmit`) |

No tests or linter configured. Always run `npm run typecheck` after changes.

**Never run `npm audit fix --force`** — this project is pinned to Expo SDK 54 (see above) and `--force` will upgrade `react-native`/Expo packages past that pin, breaking the Expo Go connection. Plain `npm audit fix` (no `--force`) has previously pulled in a duplicate, mismatched `react-native` as a transitive bump too — always check `git diff package-lock.json` for `react-native`/`@react-native/*` version changes afterward, and revert (`git checkout -- package.json package-lock.json && npm ci`) if any appear. Symptom of this happening: a red error screen on launch reading `Unsupported param type for method... Found ReadonlyArray` in `DebuggingOverlayNativeComponent.js`.

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
- **Password recovery:** `resetPassword(email)` calls `supabase.auth.resetPasswordForEmail` (web: `redirectTo` is `window.location.origin`; native has no redirect configured — see note below). When the user follows that email link, Supabase fires a `PASSWORD_RECOVERY` auth event with a *valid* session attached — `passwordRecovery` flips to `true` and `App.tsx`'s `AuthGate` renders `ResetPasswordScreen` instead of the normal app, **even though `session` is truthy**, so the user can't land directly in the account without setting a new password first. `updatePassword(newPassword)` clears the flag on success; `cancelPasswordRecovery()` signs out instead.
- **Known limitation:** the reset-link redirect is wired for the web build only. Native (iOS/Android) needs a deep-link `scheme` in `app.json` plus matching Supabase Auth redirect-URL config to complete the loop on-device — not set up yet.

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

Seven tables: `habits`, `habit_logs`, `user_challenges` (PK: `user_id`), `custom_challenges`, `user_settings` (PK: `user_id`), `ai_nudges`, `ai_reports`. All have RLS — `auth.uid() = user_id`. Schema is in `supabase/schema.sql`; run it once in the Supabase SQL editor to create tables and policies.

`db.upsertAll` uses explicit `onConflict` per table. `db.pushAll` is a full wipe + re-insert used only during onboarding and dev reset. Dev-mode Supabase errors are logged via `dblog` (`console.warn` in `__DEV__`).

`supabase.ts` uses `expo-secure-store` as the auth token storage adapter on native; falls back to in-memory on web. It **throws immediately** (not just a dev warning) if `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing — fail fast rather than running with broken queries.

The `avatars` Storage bucket (`supabase/schema.sql`) restricts uploads to `image/jpeg`/`image/png`/`image/webp` and a 5MB `file_size_limit` — enforced server-side by Supabase Storage, not just the client-side image picker in `UserProfileContext.tsx`.

### AI coaching & reports (`supabase/functions/ai-coach`, `supabase/functions/push-coach`, `src/lib/ai.ts`)

Three features, two Edge Functions:
- **In-app nudges** (`ai_nudges` table, `source='app'`) — a short motivational message citing real habit numbers (one habit doing well, one slipping, one concrete tip). Surfaced via `CoachCard` on `TodayScreen`. **Auto-generates once per calendar day** — `CoachCard` checks the latest nudge's date on mount; if it's not from today, it silently calls `ai.generateNudge()` in the background (no tap required), guarded by an AsyncStorage flag (`@habitflow_coach_auto_${userId}_${date}`) so it only attempts once per user per day even across remounts. The manual "Refresh" button always works on top of this.
- **Reports** (`ai_reports` table) — weekly/monthly consistency summaries. One row per `(user_id, period_type, period_start)`; regenerating overwrites (`upsert`). Surfaced via `ReportsSection` on `StatsScreen`. Manual-only (user picks "Weekly"/"Monthly").
- **Push nudges** (`ai_nudges` table, `source='push'`) — same coaching logic, delivered as a remote push notification via Expo's push service, for users who aren't in the app. Triggered by a Supabase `pg_cron` schedule, not by the client.

`supabase/functions/ai-coach/index.ts` is a Deno Edge Function (excluded from the app's `tsconfig.json` — different runtime, uses `npm:` specifiers). It authenticates with the caller's forwarded JWT (so all queries respect RLS), pulls `habits` + `habit_logs`, computes per-habit completion % over a rolling window, and calls Claude (`claude-sonnet-4-6` via the Anthropic SDK) to generate the text, then persists it.

- **Rate limit:** enforces a 60-second cooldown per user across both `nudge` and `report` actions (checks the most recent `ai_nudges`/`ai_reports` row for that user before calling Claude) — each call is a billed Claude request, so this caps cost-exhaustion from a scripted client.
- **CORS:** `Access-Control-Allow-Origin` is only echoed back for origins listed in the `ALLOWED_ORIGINS` secret (comma-separated); unset means no browser origin is allowed (native requests don't send an `Origin` header, so they're unaffected). Set this if/when a web build is deployed.
- **Error responses:** the catch-all handler returns a generic `"Something went wrong"` to the client — never `err.message` — to avoid leaking internal details (DB errors, Anthropic SDK errors). Full error detail still goes to `console.error` server-side.

`supabase/functions/push-coach/index.ts` is a separate Deno Edge Function for the scheduled batch job. It is **not** callable with the public anon key — it requires the Authorization header to exactly equal `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (checked explicitly, since the anon key would otherwise also pass the platform's default JWT verification). It uses the service-role client to query every `user_settings` row with `notifications_enabled = true` and a non-null `push_token`, generates a short title/body per user via Claude, sends them to Expo's push API (`https://exp.host/--/api/v2/push/send`, batched in chunks of 100), and logs each as an `ai_nudges` row. See the comment block at the top of the file for the `cron.schedule` + `net.http_post` SQL to wire up the trigger (run once in the SQL editor; the cron expression is in UTC — convert your desired local send time). Like `ai-coach`, its catch-all handler returns a generic error message to the caller (the caller here is only `pg_cron`, but full error detail still stays in `console.error` rather than the response). To change the schedule later, use `cron.alter_job(job_id := ..., schedule := '...')` rather than re-running `cron.schedule` with the same job name.

`src/lib/ai.ts` exposes `fetchLatestNudge`/`fetchReports` (plain `SELECT`s, no Claude call — cheap, used on screen mount) and `generateNudge`/`generateReport` (invoke `ai-coach` via `supabase.functions.invoke`, which costs a Claude call).

**Push token lifecycle:** `getExpoPushToken()` (`src/utils/notifications.ts`) requires `expo.extra.eas.projectId` in `app.json` (set once via `eas init`) — without it, push registration silently no-ops (logs a dev warning) and only the in-app/local-reminder features work. The existing "Daily reminders" toggle on `StatsScreen` (and the equivalent step in `OnboardingScreen`) is the single on/off switch for both local reminders and push coaching: enabling it requests permissions, calls `scheduleReminders()`, *and* registers+saves the Expo push token (`db.updatePushToken`) to `user_settings.push_token`; disabling it calls `cancelAllReminders()` and clears the stored token (so `push-coach` skips that user).

`src/utils/notifications.ts` actually has **two independent local-notification systems** — don't conflate them:
- `scheduleReminders()` / `cancelAllReminders()` — three fixed, untitled generic reminders (8am/2pm/8pm) controlled by the single "Daily reminders" toggle above.
- `scheduleHabitReminder(habit)` / `cancelHabitReminder(habitId)` — a separate per-habit reminder at a user-chosen time (`habit.reminder.{hour,minute}`, set via `ReminderModal`), identified by `habit_${habitId}` so each habit's notification can be updated/cancelled independently. Called from `HabitsContext.tsx` whenever a habit's reminder is created or edited — unaffected by the global toggle.

**Deploy/config (not run by the app build):**
```
supabase functions deploy ai-coach
supabase functions deploy push-coach
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
The Anthropic key lives only as a Supabase Edge Function secret — never in `.env` or client code. The cron schedule for `push-coach` is set up via SQL (see file header), not via `supabase secrets`/CLI.

### User profile (`src/context/UserProfileContext.tsx`)

Fetches `display_name`, `avatar_url`, `inactivity_timeout_mins` from `user_settings` on mount. `updateProfile` is optimistic (local state first, then `db.updateProfile`). `pickAndUploadAvatar` uses `expo-image-picker` → uploads blob to the `avatars` Storage bucket → saves public URL.

### Inactivity timer (`src/hooks/useInactivityTimer.ts`)

Returns `panHandlers` (spread on the root `View` in `AuthenticatedApp`). Uses `PanResponder` with `onStartShouldSetPanResponderCapture: () => false` so touches pass through to children. Polls every 30 s; calls `signOut()` when `Date.now() - lastActivityAt >= timeoutMs`. Re-validates on `AppState` foreground. Timeout is read from `profile.inactivityTimeoutMins` (null = never).

### Completion chimes (`src/utils/sound.ts`)

Bell-tone chimes for habit completion, "all habits done today," and challenge completion. Two implementations, selected by `Platform.OS`:
- **Web:** synthesized live via the Web Audio API (`bell()` — two sine partials per note: a fundamental + an inharmonic partial at ratio 2.756, fast linear attack, exponential decay).
- **Native:** plays pre-rendered WAV files from `assets/sounds/` via `expo-audio`'s `createAudioPlayer` (lazily created module-scoped players, `seekTo(0)` before each `play()` to allow replay). These WAVs are generated by `scripts/generate-chime-sounds.mjs` from the **same** note/gain/decay parameters as the web `bell()` calls, so the two platforms sound the same. Re-run that script after changing either implementation's note tables to keep them in sync.

`playHabitComplete()` and `playAllDone()` are called from `HabitsContext.tsx` on log-completion; `playChallengeComplete()` is called from `ChallengeRewardModal.tsx` alongside `bigCelebrate()` haptics.

Adding/upgrading `expo-audio` (or any native module) requires a full Expo Go app relaunch on-device, not just a JS reload — the native module registration only happens at app launch.

### Profile modal (`src/context/ProfileModalContext.tsx`)

Owns the `<Modal>` containing `ProfileScreen`. Any component can call `useProfileModal().openProfile()` to open it. `ScreenHeader` and the `TodayScreen` gradient header both call this hook. Placed inside `HabitsProvider` so `ProfileScreen` can access all contexts.

### Shared header (`src/components/ScreenHeader.tsx`)

Used by Habits, History, and Stats screens. Renders `SafeAreaView edges={['top']}` internally — screens must **not** add their own top SafeAreaView when using this component. Accepts `title`, optional `subtitle`, and optional `children` (rendered below the title row, used by HistoryScreen for the month navigator + stats chips).

### Screens

| Screen | Key behaviour |
|--------|--------------|
| `AuthScreen` | Email/password sign-in and sign-up tabs, plus a "Forgot password?" mode; "Check your email" confirmation states for both sign-up and password reset |
| `ResetPasswordScreen` | Shown instead of the normal app/auth flow whenever `AuthContext.passwordRecovery` is true (i.e. the user followed a reset-password email link) — new password + confirm, then `updatePassword()` clears the flag and drops them into the app |
| `TodayScreen` | Gradient header with `ProgressRing` + profile avatar; `CoachCard` (AI nudge); FlatList of habits; challenge filter bar; `CelebrationOverlay` + `ChallengeRewardModal` |
| `HabitsScreen` | FlatList with challenge cards at top, habit rows below; FAB opens `AddHabitModal`; `SelectHabitsModal` for editing challenge habit links |
| `HistoryScreen` | Month view of `DaySummary` rows (weekday + day + month abbreviation); forward nav unlocks when future simulated logs exist; SIM badge in amber |
| `StatsScreen` | 7-day bar chart (+ up to 3 future simulated days in amber); `ReportsSection` (AI weekly/monthly reports); streak list; notifications toggle |
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
