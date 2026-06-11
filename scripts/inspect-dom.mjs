import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForSelector('text=HabitFlow', { timeout: 20000 });

// Dump interactive elements
const els = await page.evaluate(() => {
  return [...document.querySelectorAll('[role="button"], button, input, [tabindex]')]
    .map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      text: el.textContent?.trim().slice(0, 60),
      class: el.className?.slice(0, 80),
      rect: JSON.stringify(el.getBoundingClientRect()),
    }));
});
console.log('Interactive elements:\n', JSON.stringify(els, null, 2));
await browser.close();
