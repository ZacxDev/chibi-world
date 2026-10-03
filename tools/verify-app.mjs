// Headless verification for the Civlings Civitai App (dev:harness, SDK mock
// host — synthetic replies, no real Buzz, no network generation).
//
// Flow: app mounts in mock host -> game boots inside the app iframe -> HUD
// stats -> click tile (8,7) -> Harvest Jev (+17 session score) -> Generate
// (estimate -> priced confirm -> submit -> poll, all mocked) -> generated
// texture lands on the prop card in-game. Screenshots go to review/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGE_URL = 'http://localhost:5186/';
const OUT = '/home/hatch/workspace/goals/build-and-publish-apps-that-make-money-24-7/app/civlings/review';
fs.mkdirSync(OUT, { recursive: true });

// iso constants — mirror of the game's main/iso.lua
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
await page.setViewport({ width: 1100, height: 1250 });
const texts = [];
page.on('console', (m) => { texts.push(m.text()); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e)); });
const saw = (re) => texts.some((t) => re.test(t));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(re, label, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (saw(re)) return true;
    await sleep(250);
  }
  console.log('TIMEOUT: ' + label);
  return false;
}
const results = [];
const check = (name, ok) => results.push([name, !!ok]);

await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });

// the game boots inside the app iframe
check('game booted (grid + civling)',
  await waitFor(/CIVLINGS GRID READY: 100 tiles/, 'GRID', 120000) && saw(/CIVLING READY at \(4,4\)/));
await sleep(1200);

// SDK-driven header: viewer + real host balance
const bodyText = () => page.evaluate(() => document.body.innerText);
let text = await bodyText();
check('viewer in header (/mock|viewer|signed in/i)', /signed in as/i.test(text));
const balMatch = text.match(/Buzz:\s*([\d,]+)/);
check(`balance in header (${balMatch ? balMatch[1] : 'none'})`, !!balMatch);
const statsOk = /STA 7 · PRO 6 · AFF 8 \(ruins\)/.test(text);
check('HUD civling stats', statsOk);

// click tile (8,7) in the game iframe
const frameEl = await page.$('iframe[title="Civlings game"]');
const box = await frameEl.boundingBox();
const pt = cellScreenPoint(8, 7, Math.round(box.width), Math.round(box.height));
await page.mouse.move(box.x + pt.x, box.y + (Math.round(box.height) - pt.yFromBottom));
await page.mouse.down();
await sleep(150); // hold so the engine samples the press (frame-paced input)
await page.mouse.up();
check('tile click -> GOTO (8,7)', await waitFor(/CIVLING GOTO \(8,7\)/, 'GOTO', 15000));

// harvest at the selected tile — the Jev buttons live in the game now:
// tap the Harvest button in the in-game HUD bar. Coordinates come from
// the game canvas rect itself; the canvas letterboxes inside its
// iframe, so iframe fractions miss.
const gf = page.frames().find((f) => f.url().includes('/game/index.html'));
const cr = await gf.evaluate(() => {
  const c = document.getElementById('canvas');
  const b = c.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
const gfb = await (await gf.frameElement()).boundingBox();
await page.mouse.move(gfb.x + cr.x + (159 / 960) * cr.w, gfb.y + cr.y + (1 - 50 / 540) * cr.h);
await page.mouse.down();
await sleep(150);
await page.mouse.up();
check('jev yield +17 (formula)', await waitFor(/JEV YIELD \+17 \(harvest\)/, 'YIELD', 40000));
await sleep(400);
text = await bodyText();
check('session earned = 17', /Session earned:\s*17/.test(text));

// live money path against the mock host: estimate -> priced confirm
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Generate prop');
  b?.click();
});
const confirmOk = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const t = await bodyText();
    if (/Confirm — generate for/.test(t)) return true;
    await sleep(300);
  }
  return false;
})();
text = await bodyText();
const costMatch = text.match(/Confirm — generate for\s*(.+)/);
check(`estimate priced (${costMatch ? costMatch[1].trim() : 'none'})`, confirmOk);

// confirm -> submit -> poll (mock) -> texture into the game
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Confirm — generate for'));
  b?.click();
});
// The SDK mock host returns a deliberately fake image URL (404 on the real
// CDN), so pixel delivery cannot complete in this sandbox; assert instead
// that the workflow itself succeeded and delivery was attempted. The
// success markers are log-side now: 'saved to the shared city' after the
// publish+append (in a real browser PROP TEXTURED follows; proven with a
// real data: URL in verify-phase4).
const stageOk = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    if (saw(/PROP TEXTURED \(8,7\) 128x128/)) return 'textured';
    const t = await bodyText();
    if (/saved to the shared city/.test(t)) return 'workflow-succeeded+shared';
    await sleep(300);
  }
  return null;
})();
check(`workflow succeeded + texture attempted (${stageOk ?? 'none'})`, !!stageOk);
await sleep(800);
text = await bodyText();
const bal2 = text.match(/Buzz:\s*([\d,]+)/);
console.log('balance after generate:', bal2 ? bal2[1] : 'n/a',
            '(was', balMatch ? balMatch[1] : 'n/a' + ')');

await page.screenshot({ path: `${OUT}/01-app-city.png` });
const frame2 = await page.$('iframe[title="Civlings game"]');
const box2 = await frame2.boundingBox();
await page.screenshot({ path: `${OUT}/02-app-game.png`, clip: {
  x: Math.round(box2.x), y: Math.round(box2.y),
  width: Math.round(box2.width), height: Math.round(box2.height) } });
check('review screenshots', fs.existsSync(`${OUT}/01-app-city.png`));

fs.writeFileSync(`${OUT}/verify-app-console.log`, texts.join('\n') + '\n');
await browser.close();
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
