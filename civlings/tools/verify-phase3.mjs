// Headless verification for Civlings Phase 3: Jev task system + generated
// prop textures (mock mode, zero Buzz at risk).
//
// Flow: boot -> HUD stats -> click tile (8,7) -> Harvest Jev assigned there
// -> yield +17 credited (12 x 1.25 affinity x 1.1 proficiency) -> generate
// "neon lamp" -> scaffold -> texture applied, 10 mock Buzz debited.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGE_URL = 'http://127.0.0.1:8611/?mock=1';
const SHOT_PROP = '/home/hatch/workspace/scratch-defold/civlings/screenshots/04_prop.png';
const SHOT_HUD = '/home/hatch/workspace/scratch-defold/civlings/screenshots/05_hud.png';
const LOG = '/home/hatch/workspace/scratch-defold/civlings/logs/verify-phase3.log';
fs.mkdirSync('/home/hatch/workspace/scratch-defold/civlings/logs', { recursive: true });

// iso constants — mirror of main/iso.lua
const CAM = [19.62, 19.62, 19.62];
const R = [0.70711, 0, -0.70711], U = [-0.40825, 0.81650, -0.40825];
const ZOOM = 28.0, TILE = 2.0;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function cellScreenPoint(c, r, winW, winH) {
  const wx = (c - 4.5) * TILE, wz = (r - 4.5) * TILE;
  const rel = [wx - CAM[0], 0 - CAM[1], wz - CAM[2]];
  const halfW = (winW / ZOOM) * 0.5, halfH = (winH / ZOOM) * 0.5;
  return { x: (dot(rel, R) / halfW + 1) / 2 * winW,
           yFromBottom: (dot(rel, U) / halfH + 1) / 2 * winH };
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         '--use-gl=angle', '--use-angle=swiftshader-webgl',
         '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1200 });
const texts = [];
page.on('console', (m) => { texts.push(m.text()); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e)); });
const saw = (re) => texts.some((t) => re.test(t));
async function waitFor(re, label, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (saw(re)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log('TIMEOUT: ' + label);
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
results.push(['boot: grid + civling', await (async () => {
  const g = await waitFor(/CIVLINGS GRID READY: 100 tiles/, 'GRID', 90000);
  return g && saw(/CIVLING READY at \(4,4\)/);
})()]);

await sleep(800);
const stats = await page.$eval('#civ-stats', (el) => el.textContent);
results.push([`HUD stats (${stats.trim()})`, /STA 7 · PRO 6 · AFF 8 \(ruins\)/.test(stats)]);

// click tile (8,7) in the game frame
const frameEl = await page.$('#game-frame');
const box = await frameEl.boundingBox();
const pt = cellScreenPoint(8, 7, Math.round(box.width), Math.round(box.height));
// move + down + hold + up: back-to-back down/up can be coalesced by the
// engine's per-frame input sampling before it ever sees the press.
await page.mouse.move(box.x + pt.x, box.y + (Math.round(box.height) - pt.yFromBottom));
await page.mouse.down();
await sleep(150);
await page.mouse.up();
results.push(['tile click -> GOTO (8,7)', await waitFor(/CIVLING GOTO \(8,7\)/, 'GOTO', 15000)]);
const sel = await page.$eval('#sel-cell', (el) => el.textContent);
results.push([`HUD target (${sel.trim()})`, sel.includes('(8,7)')]);

// assign the Harvest Jev at the selected tile
await page.click('button.task[data-task="harvest"]');
results.push(['jev yield +17 (formula 12 x 1.25 x 1.1)',
  await waitFor(/JEV YIELD \+17 \(harvest\)/, 'YIELD', 40000)]);
await sleep(400);
const earned = await page.$eval('#civ-earned b', (el) => el.textContent);
results.push([`HUD earned (${earned})`, earned.includes('17')]);
const bal1 = await page.$eval('#balance b', (el) => el.textContent);
results.push([`balance after yield (${bal1})`, bal1.includes('7,767')]);

// generate a prop from the prompt
await page.click('#gen-btn');
results.push(['prop scaffold', await waitFor(/PROP SCAFFOLD \(8,7\)/, 'SCAFFOLD', 15000)]);
results.push(['prop textured', await waitFor(/PROP TEXTURED \(8,7\) 128x128/, 'TEXTURED', 15000)]);
await sleep(900);
const bal2 = await page.$eval('#balance b', (el) => el.textContent);
results.push([`balance after gen -10 (${bal2})`, bal2.includes('7,757')]);

await page.screenshot({ path: SHOT_HUD });
const frameBox = await frameEl.boundingBox();
await page.screenshot({ path: SHOT_PROP, clip: {
  x: Math.round(frameBox.x), y: Math.round(frameBox.y),
  width: Math.round(frameBox.width), height: Math.round(frameBox.height) } });
results.push(['screenshots written', fs.existsSync(SHOT_PROP) && fs.existsSync(SHOT_HUD)]);

await browser.close();
fs.writeFileSync(LOG, texts.join('\n') + '\n');
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
