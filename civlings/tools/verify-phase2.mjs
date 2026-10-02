// Headless verification for Civlings Phase 2: fixed isometric camera,
// 10x10 Genesis City grid, and click-to-move with BFS pathfinding.
//
// Expects `python3 -m http.server` running in civlings/web on :8611.
// The click position for the target cell is computed with the exact inverse
// of the game's own pick math (main/iso.lua) — if the logged GOTO cell is
// not the target, the pick math is wrong and this test says so.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGE_URL = 'http://127.0.0.1:8611/?mock=1';
const SHOT_GRID = '/home/hatch/workspace/scratch-defold/civlings/screenshots/02_grid.png';
const SHOT_MOVED = '/home/hatch/workspace/scratch-defold/civlings/screenshots/03_moved.png';
const LOG = '/home/hatch/workspace/scratch-defold/civlings/logs/verify-phase2.log';
fs.mkdirSync('/home/hatch/workspace/scratch-defold/civlings/screenshots', { recursive: true });
fs.mkdirSync('/home/hatch/workspace/scratch-defold/civlings/logs', { recursive: true });

// iso constants — mirror of main/iso.lua
const CAM = [19.62, 19.62, 19.62], F = [-0.57735, -0.57735, -0.57735];
const R = [0.70711, 0, -0.70711], U = [-0.40825, 0.81650, -0.40825];
const ZOOM = 28.0, TILE = 2.0;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function cellScreenPoint(c, r, winW, winH) {
  const wx = (c - 4.5) * TILE, wz = (r - 4.5) * TILE;
  const rel = [wx - CAM[0], 0 - CAM[1], wz - CAM[2]];
  const vx = dot(rel, R), vy = dot(rel, U);
  const halfW = (winW / ZOOM) * 0.5, halfH = (winH / ZOOM) * 0.5;
  const ndcX = vx / halfW, ndcY = vy / halfH;
  return { x: (ndcX + 1) / 2 * winW, yFromBottom: (ndcY + 1) / 2 * winH };
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage',
         '--use-gl=angle', '--use-angle=swiftshader-webgl',
         '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 760 });
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

const results = [];
await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
results.push(['grid spawned (100 tiles)', await waitFor(/CIVLINGS GRID READY: 100 tiles/, 'GRID READY', 90000)]);
results.push(['civling spawned at (4,4)', saw(/CIVLING READY at \(4,4\)/)]);
await new Promise((r) => setTimeout(r, 1500)); // let clouds drift, settle frame
await page.screenshot({ path: SHOT_GRID });
results.push(['screenshot 02_grid', fs.existsSync(SHOT_GRID)]);

// click cell (8,7): compute its point inside the game frame, then click there
const frameEl = await page.$('#game-frame');
const box = await frameEl.boundingBox();
const winW = Math.round(box.width), winH = Math.round(box.height);
const TARGET = { c: 8, r: 7 };
const pt = cellScreenPoint(TARGET.c, TARGET.r, winW, winH);
await page.mouse.move(box.x + pt.x, box.y + (winH - pt.yFromBottom));
await page.mouse.down(); await page.mouse.up();
results.push([`click targets cell (${TARGET.c},${TARGET.r})`,
  await waitFor(new RegExp(`CIVLING GOTO \\(${TARGET.c},${TARGET.r}\\)`), 'GOTO target cell', 15000)]);
results.push(['civling arrived at target',
  await waitFor(new RegExp(`CIVLING ARRIVED \\(${TARGET.c},${TARGET.r}\\)`), 'ARRIVED', 30000)]);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: SHOT_MOVED });
results.push(['screenshot 03_moved', fs.existsSync(SHOT_MOVED)]);

await browser.close();
fs.writeFileSync(LOG, texts.join('\n') + '\n');
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
