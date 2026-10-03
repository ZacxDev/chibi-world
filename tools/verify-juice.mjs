// Juice verification (SDK mock host): prop card + vote + remove-mine, the
// in-game progress bar, HUD WORKING %, and per-task pantomime frames.
// World seeded via ?seedplayer/?seedshared/?seedimages (see verify-phase4).
// Screenshots -> app civlings/review/juice/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://localhost:5186/';
const OUT = '/home/hatch/workspace/goals/build-and-publish-apps-that-make-money-24-7/app/civlings/review/juice';
fs.mkdirSync(OUT, { recursive: true });
const PNG64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGO8YxPFgA0wYRUdtBIAJcUBgikMJy4AAAAASUVORK5CYII=';

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok) => { results.push([name, !!ok]); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };

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
const waitFor = async (re, label, timeoutMs = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (saw(re)) return true; await sleep(250); }
  console.log('TIMEOUT: ' + label); return false;
};
const waitBody = async (re, label, timeoutMs = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (re.test(await bodyText())) return true; await sleep(250); }
  console.log('TIMEOUT: ' + label); return false;
};
const bodyText = () => page.evaluate(() => document.body.innerText);
const clickBtn = (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(l));
  b?.click(); return !!b;
}, label);
const clickCell = async (c, r) => {
  const el = await page.$('iframe[title="Civlings game"]');
  const box = await el.boundingBox();
  const pt = cellScreenPoint(c, r, Math.round(box.width), Math.round(box.height));
  await page.mouse.move(box.x + pt.x, box.y + (Math.round(box.height) - pt.yFromBottom));
  await page.mouse.down();
  await sleep(150);
  await page.mouse.up();
};

// mock viewer id is 2: the (7,7) prop is "mine", (2,2) belongs to viewer 999.
const playerSeed = { 'player:v1': { c: 4, r: 4, stamina: 100, earnedTotal: 0, tasksDone: 0, propsPlaced: 1 } };
const sharedSeed = [
  { value: { title: 'Prop: seeded lantern', body: 'seeded lantern',
             data: { kind: 'prop', c: 2, r: 2, imageId: 424242 } }, authorUserId: 999 },
  { value: { title: 'Prop: my old sign', body: 'my old sign',
             data: { kind: 'prop', c: 7, r: 7, imageId: 424242 } }, authorUserId: 2 },
];
const imageSeed = [{ imageId: 424242, status: 'visible', nsfwLevel: 1, contentRating: 'g', url: PNG64, width: 8, height: 8 }];
const q = '?consent=granted'
  + '&seedplayer=' + encodeURIComponent(JSON.stringify(playerSeed))
  + '&seedshared=' + encodeURIComponent(JSON.stringify(sharedSeed))
  + '&seedimages=' + encodeURIComponent(JSON.stringify(imageSeed));
await page.goto(BASE + q, { waitUntil: 'load', timeout: 30000 });

check('boot', await waitFor(/CIVLINGS GRID READY/, 'GRID', 120000));
check('seeded city loaded (2 props)', await waitBody(/Shared city props: 2/, 'city count', 60000));
await sleep(1500);

// 1) prop card for someone else's prop + vote
await clickCell(2, 2);
check('prop card shows seeded lantern', await waitBody(/seeded lantern/, 'card'));
check('vote button offered (not mine)', await waitBody(/♥ Vote/, 'vote btn'));
await page.screenshot({ path: `${OUT}/J1-prop-card.png` });
await clickBtn('♥ Vote');
check('vote lands (♥ Voted state)', await waitBody(/♥ Voted/, 'voted'));
check('vote count incremented', /♥\s*1/.test(await bodyText()));
await page.screenshot({ path: `${OUT}/J2-voted.png` });

// 2) remove my own prop
await clickCell(7, 7);
check('own prop card shows Remove mine', await waitBody(/Remove mine/, 'remove btn'));
await clickBtn('Remove mine');
check('prop removed in game', await waitFor(/PROP REMOVED \(7,7\)/, 'removed'));
check('city count drops to 1', await waitBody(/Shared city props: 1/, 'count 1'));
await page.screenshot({ path: `${OUT}/J3-removed.png` });

// 3) per-task animations + progress bar + HUD %
await clickCell(2, 2);
await clickBtn('Craft');
check('HUD shows WORKING · craft · %', await waitBody(/WORKING · craft · [3-9]\d%/, 'craft pct', 45000));
await page.screenshot({ path: `${OUT}/J4-craft-progress.png` });
check('craft completes', await waitFor(/JEV YIELD \+28 \(craft\)/, 'craft yield', 30000));
await waitFor(/JEV STATE IDLE/, 'cooldown done', 20000);
await clickBtn('Harvest');
check('HUD shows WORKING · harvest · %', await waitBody(/WORKING · harvest · [4-9]\d%/, 'harvest pct', 45000));
await page.screenshot({ path: `${OUT}/J5-harvest-progress.png` });
check('harvest completes', await waitFor(/JEV YIELD \+17 \(harvest\)/, 'harvest yield', 30000));

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log(failed.length === 0 ? 'ALL GREEN' : `FAILURES: ${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
