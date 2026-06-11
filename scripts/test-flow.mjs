import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:8081';
const SUPABASE_URL = 'https://bfrhmdaxxcezudnazlrg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_92fNUGC1CK31itgxoZxwyw_RmdXHqxv';
const TEST_EMAIL = `test_${Date.now()}@habitflow-test.com`;
const TEST_PASSWORD = 'TestPass123!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function log(step, msg) { console.log(`\n[${step}] ${msg}`); }
async function shot(page, name) {
  await page.screenshot({ path: `/tmp/habitflow_${name}.png` });
  console.log(`  📸 /tmp/habitflow_${name}.png`);
}

// RN Web Pressable = plain div with cursor:pointer, no role attribute.
// Click the div whose exact text content matches `label`.
async function tap(page, label) {
  // Find div elements with exact text match, prefer the one lower on screen (submit > tab)
  const divs = page.locator('div').filter({ hasText: new RegExp(`^${label}$`) });
  const count = await divs.count();
  if (count === 0) throw new Error(`No element with text "${label}" found`);
  // If multiple matches (e.g. tab + submit button), click the last (lowest) one
  await divs.last().click();
}

const browser = await chromium.launch({ headless: false, slowMo: 100 });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

try {
  // ── 1. Load app ──────────────────────────────────────────────────────────
  log('1', `Loading ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=HabitFlow', { timeout: 30000 });
  await shot(page, '01_auth_screen');
  log('1', '✅ Auth screen loaded');

  // ── 2. Switch to sign-up tab ─────────────────────────────────────────────
  log('2', 'Clicking Create account tab');
  // Tab is the first div with this text; submit button doesn't exist yet on sign-in mode
  await page.locator('div').filter({ hasText: /^Create account$/ }).first().click();
  await page.waitForTimeout(500);
  await shot(page, '02_signup_tab');

  // ── 3. Fill form ─────────────────────────────────────────────────────────
  log('3', `Email: ${TEST_EMAIL}`);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(TEST_EMAIL);
  await inputs.nth(1).fill(TEST_PASSWORD);
  await shot(page, '03_form_filled');

  // ── 4. Submit sign-up ────────────────────────────────────────────────────
  log('4', 'Submitting sign-up form');
  // Now both the tab AND the submit button say "Create account" — submit is last/lowest
  await tap(page, 'Create account');
  await page.waitForTimeout(4000);
  await shot(page, '04_after_signup');

  // ── 5. Handle email confirmation gate ────────────────────────────────────
  const bodyText = await page.locator('body').innerText();

  if (/check your email/i.test(bodyText)) {
    log('5', '📬 Email confirmation required by Supabase');
    log('5', '   → To skip this in dev: Supabase Dashboard → Authentication → Providers');
    log('5', '     → Email → disable "Confirm email" → Save');
    log('5', '   → Then the app will log users in immediately after sign-up.');
    await shot(page, '05_confirm_email_screen');

    // Show the confirm screen clearly
    log('5', '   Attempting sign-in with new credentials anyway...');
    await page.locator('div').filter({ hasText: /^Back to sign in$/ }).first().click();
    await page.waitForTimeout(400);
    const inputs2 = page.locator('input');
    await inputs2.nth(0).fill(TEST_EMAIL);
    await inputs2.nth(1).fill(TEST_PASSWORD);
    await tap(page, 'Sign in');
    await page.waitForTimeout(3000);
    await shot(page, '06_signin_unconfirmed');
    const afterText = await page.locator('body').innerText();
    if (/email not confirmed/i.test(afterText) || /sign in|create account/i.test(afterText)) {
      log('5', '   ⚠️  Sign-in blocked (email not confirmed). This is expected.');
      log('5', '   Once you disable "Confirm email" in Supabase, sign-up goes straight in.');
    }
    // Jump to DB verification regardless
  } else if (/today|habits/i.test(bodyText)) {
    log('5', '✅ Logged in directly — no email confirmation needed');
  } else {
    log('5', `  Screen text snippet: "${bodyText.slice(0, 120)}"`);
  }

  // ── 6. Verify Supabase tables are reachable ──────────────────────────────
  log('6', 'Querying Supabase tables...');

  const tables = ['habits', 'habit_logs', 'user_challenges', 'custom_challenges', 'user_settings'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(5);
    if (error) {
      log('6', `  ❌ ${table}: ${error.message}`);
    } else {
      log('6', `  ✅ ${table}: accessible (${data.length} row(s))`);
      if (data.length > 0) {
        data.forEach(row => console.log(`       ${JSON.stringify(row).slice(0, 100)}`));
      }
    }
  }

  log('DONE', '🎉 Test complete — see screenshots at /tmp/habitflow_*.png');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  await shot(page, 'XX_error').catch(() => {});
} finally {
  await page.waitForTimeout(3000);
  await browser.close();
}
