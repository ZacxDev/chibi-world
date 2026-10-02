// REAL-BUZZ live test (SDK live host, real Civitai backend, real dev token).
// Exactly ONE generation. Verifies: live estimate -> confirm -> workflow ->
// real CDN texture in the game + account Balance delta. Screenshots ->
// app civlings/review/live/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://localhost:5186/';
const OUT = '/home/hatch/workspace/goals/build-and-publish-apps-that-make-money-24-7/app/civlings/review/live';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         '--use-gl=angle', '--use-angle=swiftshader-webgl',
         '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1250 });
const texts = [];
page.on('console', (m) => { texts.push(m.text()); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e)); });
const saw = (re) => texts.some((t) => re.test(t));
const waitFor = async (re, label, timeoutMs = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (saw(re)) return true; await sleep(500); }
  console.log('TIMEOUT: ' + label); return false;
};
const bodyText = () => page.evaluate(() => document.body.innerText);
const waitBody = async (re, label, timeoutMs = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (re.test(await bodyText())) return true; await sleep(500); }
  console.log('TIMEOUT: ' + label); return false;
};
const clickBtn = (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(l));
  b?.click(); return !!b;
}, label);
const balance = async () => {
  const t = await bodyText();
  const m = t.match(/Buzz:\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};

await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
console.log('boot:', await waitFor(/CIVLINGS GRID READY/, 'GRID', 180000));
await sleep(4000); // let balance + viewer settle
const balBefore = await balance();
console.log('BALANCE BEFORE:', balBefore);
await page.screenshot({ path: `${OUT}/L0-live-boot.png` });

// price it (one generation only from here on)
console.log('generate click:', await clickBtn('Generate prop'));
const priced = await waitBody(/Confirm — generate for/, 'priced', 120000);
const pricedText = (await bodyText()).match(/Confirm — generate for [^\n]*/)?.[0] ?? '(not found)';
console.log('PRICED:', priced, '|', pricedText);
await page.screenshot({ path: `${OUT}/L1-priced.png` });
if (!priced) {
  console.log('BODY:', (await bodyText()).slice(0, 800));
  await browser.close();
  process.exit(2);
}

console.log('confirm click:', await clickBtn('Confirm — generate for'));
const textured = await waitFor(/PROP TEXTURED/, 'PROP TEXTURED', 300000);
console.log('TEXTURED (real CDN pixels in game):', textured);
await waitBody(/prop (textured|placed)/, 'prop log', 30000).catch(() => {});
await sleep(2500);
const balAfter = await balance();
console.log('BALANCE AFTER:', balAfter);
if (balBefore != null && balAfter != null) console.log('DELTA:', balBefore - balAfter);
await page.screenshot({ path: `${OUT}/L2-live-prop.png` });
console.log('FINAL LOG LINE:', ((await bodyText()).match(/[^\n]*prop[^\n]*/gi) || []).slice(-2).join(' | '));
await browser.close();
