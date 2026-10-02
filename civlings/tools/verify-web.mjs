// Headless verification for the Civlings Phase 1 wrapper + bridge.
// Serves nothing itself — expects `python3 -m http.server` already running
// in civlings/web (see VERIFY below). Captures console output from both the
// wrapper page and the game iframe, drives the bridge Ping, screenshots.
//
// VERIFY: (cd civlings/web && python3 -m http.server 8611 &) && node civlings/tools/verify-web.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGE_URL = 'http://127.0.0.1:8611/?mock=1';
const SHOT = '/home/hatch/workspace/scratch-defold/civlings/screenshots/01_bridge.png';
const LOG = '/home/hatch/workspace/scratch-defold/civlings/logs/verify-web.log';
fs.mkdirSync(new URL('.', `file://${SHOT}`).pathname, { recursive: true });
fs.mkdirSync(new URL('.', `file://${LOG}`).pathname, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         '--use-gl=angle', '--use-angle=swiftshader-webgl',
         '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 760 });

const texts = [];
page.on('console', (m) => { texts.push(m.text()); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e)); });

function saw(re) { return texts.some((t) => re.test(t)); }
async function waitFor(re, label, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (saw(re)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log('TIMEOUT waiting for: ' + label);
  return false;
}

const results = [];
await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });

results.push(['game boots (CIVLINGS READY)', await waitFor(/CIVLINGS READY/, 'CIVLINGS READY', 90000)]);
results.push(['bridge viewer delivered to Lua', await waitFor(/BRIDGE VIEWER: mock-player/, 'BRIDGE VIEWER', 20000)]);
results.push(['bridge balance delivered to Lua (7750)', await waitFor(/BRIDGE BUZZ BALANCE: 7750/, 'BRIDGE BUZZ BALANCE', 20000)]);

const viewerText = await page.$eval('#viewer', (el) => el.textContent).catch(() => '');
const balanceText = await page.$eval('#balance', (el) => el.textContent).catch(() => '');
results.push(['wrapper header shows mock viewer', /mock-player/.test(viewerText)]);
results.push(['wrapper header shows 7,750 Buzz', /7,750 Buzz/.test(balanceText)]);

await page.click('#ping-btn');
results.push(['bridge ping reached Lua', await waitFor(/BRIDGE PING RECEIVED/, 'BRIDGE PING RECEIVED', 15000)]);
await new Promise((r) => setTimeout(r, 800));
const logText = await page.$eval('#log', (el) => el.textContent).catch(() => '');
results.push(['wrapper received pong', /round-trip OK/.test(logText)]);

await page.screenshot({ path: SHOT });
await browser.close();

fs.writeFileSync(LOG, texts.join('\n') + '\n');
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
