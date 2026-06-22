# HabitFlow

A habit tracker built with Expo and React Native. Runs on iOS, Android, and web (via react-native-web). Data is cached locally with AsyncStorage but **Supabase is the source of truth** — every account syncs across devices via email/password auth, and an AI coach (Claude, via Supabase Edge Functions) generates nudges and weekly/monthly reports from your real habit data.

Built with Claude Code.

## Features

### Authentication
- Email/password sign-up and sign-in via Supabase Auth
- Forgot-password flow with email reset link (web only today — see [Known limitations](#known-limitations))
- Two-step sign-out confirmation, inactivity auto-logout (configurable timeout)

### Habit tracking
- Create **daily** habits (done/not done) or **volume** habits (track a count toward a target)
- Assign each habit a name, emoji, and color
- One-tap logging from the Today screen; volume habits support incremental count tapping
- Streaks and best-streak tracking per habit
- A bell-tone chime plays on habit completion (an ascending arpeggio), and a fuller chord swell when every habit for the day is done — same tones on web (synthesized live) and native (pre-rendered WAV)

### Challenges
- **Kickstart challenge** — built-in 3-day challenge across all (or selected) habits
- **Custom challenges** — user-defined name, duration, and habit selection
- Completion reward modal with celebration overlay, haptics, and a bell-tone fanfare chime on finish

### AI coaching
- **In-app nudges** — a short, data-driven motivational message (cites a real streak/completion % and gives one concrete tip), shown on the Today screen. Auto-generates once per day; manual refresh always available.
- **Weekly/monthly reports** — on-demand AI summaries of your consistency, shown on the Stats screen.
- **Push nudges** — the same coaching, delivered as a push notification on a daily schedule, for users who aren't in the app.

### Reminders
- Per-habit local reminders with configurable time
- Global "Daily reminders" toggle in Stats screen (controls local reminders + push-coach registration together)

### History
- Monthly calendar view with day-by-day completion summaries
- Simulated future days shown with an amber `SIM` badge (dev only)

### Stats
- 7-day horizontal bar chart (+ up to 3 simulated future days in amber)
- Habit streak leaderboard
- AI reports section (weekly/monthly)

### Profile
- Avatar upload, display name, inactivity-timeout picker, password change

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
| Backend | Supabase (Postgres + Auth + Storage), Row Level Security on every table |
| AI | Anthropic Claude, called from two Supabase Edge Functions (Deno) |
| State | React Context, AsyncStorage cache + Supabase sync |
| Web | react-native-web |
| Graphics | react-native-svg (progress rings, bar charts) |
| Notifications | expo-notifications (local) + Expo push service (remote) |
| Secure storage | expo-secure-store (native session tokens) |
| Haptics | expo-haptics |
| Sound | Web Audio API (web) + expo-audio (native), playing pre-rendered chime WAVs |

## Prerequisites

- **Node.js** — this project uses nvm; the pinned version lives under `~/.nvm/versions/node/v24.16.0/bin`. If your shell doesn't already have Node on `PATH`, prefix every command below with:
  ```bash
  export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
  ```
- **A Supabase account** (free tier is fine) — supabase.com
- **An Anthropic API key** (for AI coaching) — console.anthropic.com
- **Expo Go app** on your phone, if you want to run on a physical device — see [SDK pinning](#sdk-pinning--read-this-first) below before installing it.
- **Supabase CLI** (optional, only needed to deploy Edge Functions / manage secrets) — installed on demand via `npx supabase`, no global install required.

## SDK pinning — read this first

This project is locked to **Expo SDK 54** (`expo@~54.0.35`, `react-native@0.81.5`, `react@19.1.0`). **Do not upgrade these** — if your Expo Go app on-device is on a different SDK version than this project, the dev server connection will fail outright. Check what SDK your installed Expo Go client supports before scanning any QR code, and install the matching Expo Go version if needed.

## Setup

### 1. Clone and install

```bash
git clone <this-repo-url>
cd habit-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New Project.
2. Once it's provisioned, go to **Settings → API** and copy:
   - **Project URL**
   - **anon / publishable key**

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the two values from step 2:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

`.env` is git-ignored — never commit real credentials. Only put values here that the **client app** needs; anything server-only (the Anthropic key, service-role key) belongs in Supabase Edge Function secrets (step 5), not in this file.

### 4. Set up the database schema

Open your project's SQL editor (`https://supabase.com/dashboard/project/<your-project-ref>/sql`) and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql) once. This creates all 7 tables (`habits`, `habit_logs`, `user_challenges`, `custom_challenges`, `user_settings`, `ai_nudges`, `ai_reports`), enables Row Level Security with `auth.uid() = user_id` policies on each, and sets up the `avatars` Storage bucket with upload policies and a 5MB/image-only limit.

The script is idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before each `CREATE POLICY`) — safe to re-run if you change something later.

### 5. Deploy the AI Edge Functions

Two Supabase Edge Functions power the AI features: `ai-coach` (in-app nudges + reports, called from the client) and `push-coach` (scheduled push notifications, called only by a cron job).

Link the Supabase CLI to your project (no global install needed):

```bash
npx supabase login                                   # opens a browser to authenticate
npx supabase link --project-ref <your-project-ref>
```

Deploy both functions:

```bash
npx supabase functions deploy ai-coach
npx supabase functions deploy push-coach
```

Set the required secret:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform — you don't need to set those yourself.

If you'll ever run this app as a deployed **web** build (not just Expo Go/native), also set the origin(s) allowed to call `ai-coach` from a browser (native requests aren't affected by this check):

```bash
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:8081,https://your-deployed-domain.com"
```

### 6. (Optional) Schedule the push-coach cron job

`push-coach` only runs when triggered — it's not invoked by the client. To send daily coaching pushes automatically, run this once in the SQL editor (pick your desired **local** send time and convert to UTC):

```sql
select cron.schedule(
  'daily-coach-push',
  '0 22 * * *',  -- UTC; example: 22:00 UTC == 3pm PT (adjust to your timezone/DST)
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.functions.supabase.co/push-coach',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your-service-role-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Get the service-role key from **Settings → API** (treat it like a root password — it bypasses Row Level Security entirely; never put it in client code or `.env`). To change the schedule later, use `cron.alter_job(job_id := ..., schedule := '...')` rather than re-running `cron.schedule` with the same job name.

## Running the app

### Type-check first

```bash
npm run typecheck
```

### Start the dev server (Expo Go / physical device)

```bash
npm start
```

This starts Metro and prints a QR code in the terminal. Scan it with the **Camera app** (iOS) or the **Expo Go app** (Android) on a device on the same Wi-Fi network. The Expo Go client on your device must be on **SDK 54** to connect — see [SDK pinning](#sdk-pinning--read-this-first).

If your phone can't reach the dev machine over LAN (e.g. different subnets, corporate Wi-Fi), press `s` in the terminal to switch connection mode, or run:

```bash
npx expo start --tunnel
```

### iOS Simulator

```bash
npm run ios
```

Requires Xcode installed with at least one iOS Simulator runtime.

### Android Emulator

```bash
npm run android
```

Requires Android Studio with an emulator (AVD) created and running, or a device connected with USB debugging enabled.

### Web

```bash
npm run web
```

Opens in your default browser at `http://localhost:8081`. Note: native-only features (local push notifications, secure-store session persistence) silently no-op on web — see `src/utils/notifications.ts` and `src/lib/supabase.ts`.

## Troubleshooting

### "Unsupported param type for method... Found ReadonlyArray" / red error screen on launch

This means `node_modules` has a duplicate, mismatched copy of `react-native` (commonly introduced by `npm audit fix` pulling in a transitive bump, or a partial/corrupted install). Fix with a full clean reinstall:

```bash
rm -rf node_modules
npm ci
```

Then verify nothing's duplicated and types still check:

```bash
npm ls react-native       # every entry should say "deduped" against the same version
npm run typecheck
```

If the dev server was already running, stop it, clear Metro's cache, and restart:

```bash
npx expo start --clear
```

If the device still shows the old error after that, fully close the Expo Go app (swipe it away — don't just background it) and relaunch; Expo Go caches the previous bundle independently of the Metro server cache.

### `npm audit fix` breaks the app

**Don't run `npm audit fix --force`** — this project is intentionally pinned to Expo SDK 54 (see above), and `--force` will happily upgrade `react-native`/Expo packages past that pin, breaking the Expo Go connection. Plain `npm audit fix` (no `--force`) is usually safe, but double-check `git diff package-lock.json` afterward for any `react-native` or `@react-native/*` version bumps before committing — revert with `git checkout -- package.json package-lock.json && npm ci` if you see any.

### "Supabase credentials missing" error on startup

`src/lib/supabase.ts` throws immediately if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` aren't set — copy `.env.example` to `.env` and fill in real values (step 3 above), then restart the dev server (env vars are only read at bundler startup).

### AI nudges/reports fail with "please wait" or never appear

`ai-coach` enforces a 60-second cooldown per user across nudges and reports to control Claude API costs — this is expected if you just generated one. If nothing ever generates, check that `ANTHROPIC_API_KEY` is set as an Edge Function secret (step 5), not in `.env`.

### No chime sound when completing a habit (native)

After pulling changes that add or update a native module (e.g. `expo-audio`), a Metro reload alone isn't enough — **fully close and reopen the Expo Go app** so it re-registers the native module, then reload the project. If you need to retune the chimes themselves, edit the note tables in `scripts/generate-chime-sounds.mjs` and re-run `node scripts/generate-chime-sounds.mjs` to regenerate `assets/sounds/*.wav`.

## Known limitations

- **Password reset deep link is web-only.** The "forgot password" email link works when the app is opened as a web build; native (iOS/Android) needs a deep-link `scheme` configured in `app.json` plus a matching redirect URL in Supabase Auth settings — not wired up yet.
- **Push notifications require an EAS project.** `getExpoPushToken()` needs `expo.extra.eas.projectId` in `app.json` (set once via `eas init`); without it, push registration silently no-ops and only local reminders work.

## Project structure

```
App.tsx                       Entry point, provider tree, navigation, AuthGate
index.ts                      Expo entry registration
src/
  context/
    AuthContext.tsx           Supabase session, signIn/signUp/signOut, password recovery
    HabitsContext.tsx         Single source of truth for habit data; AsyncStorage cache + debounced Supabase sync
    UserProfileContext.tsx    Display name, avatar, inactivity timeout
    ProfileModalContext.tsx   Owns the profile modal, exposes openProfile()
  screens/
    AuthScreen.tsx            Sign-in/sign-up + forgot-password
    ResetPasswordScreen.tsx   Shown when a password-recovery session is active
    TodayScreen.tsx           Daily habit list, AI nudge (CoachCard), challenge filter, celebration overlay
    HabitsScreen.tsx          Habit management, challenge cards, FAB, modals
    HistoryScreen.tsx         Monthly calendar view
    StatsScreen.tsx           Bar chart, AI reports, streak list, notifications toggle
    ProfileScreen.tsx         Avatar, display name, password change, sign-out
    OnboardingScreen.tsx      4-step first-launch flow
    DevScreen.tsx             Dev-only simulation and reset tools
  components/
    AddHabitModal.tsx
    CelebrationOverlay.tsx
    ChallengeRewardModal.tsx
    CoachCard.tsx              AI nudge card (auto-generates once/day, manual refresh)
    CreateChallengeModal.tsx
    HabitCard.tsx
    ProfileAvatarButton.tsx
    ProgressRing.tsx
    ReminderModal.tsx
    ReportsSection.tsx         AI weekly/monthly reports
    ScreenHeader.tsx           Shared header used by Habits/History/Stats
    SelectHabitsModal.tsx
  hooks/
    useInactivityTimer.ts     Auto-logout after configurable idle time
  lib/
    supabase.ts               Supabase client (secure-store on native, in-memory on web)
    db.ts                     All Supabase table reads/writes
    ai.ts                     Invokes the ai-coach Edge Function
  utils/
    date.ts                   UTC-safe date helpers (today, addDays, daysBetween)
    notifications.ts          expo-notifications wrapper (no-op on web)
    haptics.ts                expo-haptics wrapper (no-op on web)
    sound.ts                  Completion chimes — Web Audio synth on web, expo-audio WAV playback on native
    responsive.ts             Max-width layout helpers for web
  types.ts                    Shared TypeScript types
supabase/
  schema.sql                  Tables, RLS policies, Storage bucket — run once in the SQL editor
  functions/
    ai-coach/index.ts         Client-invoked: generates nudges/reports via Claude
    push-coach/index.ts       Cron-invoked: sends scheduled push notifications via Claude + Expo push API
assets/
  sounds/                     Pre-rendered chime WAVs for native playback (generated, see scripts/ below)
scripts/
  inspect-dom.mjs             Playwright helper for inspecting the web build's DOM
  test-flow.mjs               Playwright end-to-end smoke test against a local dev server
  generate-chime-sounds.mjs   Regenerates assets/sounds/*.wav from the same bell-synthesis params as sound.ts
```

## Data model

Local cache shape (`AppData` in AsyncStorage — mirrored to/from Supabase):

```ts
type AppData = {
  habits: Habit[];              // id, name, type, targetCount, emoji, color, streak, bestStreak, reminder
  logs: HabitLog[];             // id (`${habitId}_${date}`), habitId, date (YYYY-MM-DD), count
  challenge: Challenge | null;  // built-in kickstart challenge
  customChallenges: CustomChallenge[];
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
};
```

Supabase mirrors this across 7 tables (`habits`, `habit_logs`, `user_challenges`, `custom_challenges`, `user_settings`, `ai_nudges`, `ai_reports`) — see `supabase/schema.sql` for exact columns and `src/lib/db.ts` for the sync logic.

## Date arithmetic note

All date math uses `addDays(dateStr, n)` from `src/utils/date.ts` (UTC-safe). Never combine `new Date(dateStr + 'T00:00:00')` + `.setDate()` + `.toISOString()` — that pattern causes a one-day shift in UTC+ timezones.

## License

Apache 2.0 — see [LICENSE](LICENSE).
