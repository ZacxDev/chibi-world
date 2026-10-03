// Phase 4 verification (persistence core, SDK mock host):
//   A) write path — fresh load: harvest writes lifetime score; a generated
//      prop is published + appended to the shared city.
//   B) read path — cold load WITH SEEDED storage (per-viewer KV + shared
//      city + gated images via ?seedplayer/?seedshared/?seedimages): the
//      civling restores at its saved cell/stamina, the lifetime score shows,
//      and the seeded prop lands its (real data:) texture in the game.
// Screenshots -> review/phase4/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://localhost:5186/';
const OUT = '/home/hatch/workspace/goals/build-and-publish-apps-that-make-money-24-7/app/civlings/review/phase4';
fs.mkdirSync(OUT, { recursive: true });
// 8x8 pink PNG as a stand-in for a gated community image
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

async function openRun(query = '') {
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
  await page.goto(BASE + query, { waitUntil: 'load', timeout: 30000 });
  const saw = (re) => texts.some((t) => re.test(t));
  const waitFor = async (re, label, timeoutMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) { if (saw(re)) return true; await new Promise((r) => setTimeout(r, 250)); }
    console.log('TIMEOUT: ' + label); return false;
  };
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const clickBtn = (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(l));
    b?.click(); return !!b;
  }, label);
  // Jev buttons live in the game HUD now: tap the in-game bar button.
  // Coordinates come from the game canvas rect itself — the canvas
  // letterboxes inside its iframe, so iframe fractions miss.
  const canvasPoint = async (fx, fyTop) => {
    const gf = page.frames().find((f) => f.url().includes('/game/index.html'));
    const r = await gf.evaluate(() => {
      const c = document.getElementById('canvas');
      const b = c.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const fb = await (await gf.frameElement()).boundingBox();
    return { x: fb.x + r.x + fx * r.w, y: fb.y + r.y + fyTop * r.h };
  };
  const clickJev = async (id) => {
    const cx = { harvest: 159, craft: 373, service: 587, expedition: 801 }[id];
    const p = await canvasPoint(cx / 960, 1 - 50 / 540);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await new Promise((r2) => setTimeout(r2, 150));
    await page.mouse.up();
    return true;
  };
  const clickCell = async (c, r) => {
    const el = await page.$('iframe[title="Civlings game"]');
    const box = await el.boundingBox();
    const pt = cellScreenPoint(c, r, Math.round(box.width), Math.round(box.height));
    await page.mouse.move(box.x + pt.x, box.y + (Math.round(box.height) - pt.yFromBottom));
    await page.mouse.down();
    await new Promise((r2) => setTimeout(r2, 150));
    await page.mouse.up();
  };
  return { browser, page, texts, saw, waitFor, bodyText, clickBtn, clickCell, clickJev };
}

const results = [];
const check = (name, ok) => results.push([name, !!ok]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- A) write path -------------------------------------------------
{
  const { browser, page, waitFor, bodyText, clickBtn, clickCell, clickJev } = await openRun('?consent=granted');
  check('A boot', await waitFor(/CIVLINGS GRID READY/, 'A GRID', 120000));
  await sleep(1000);
  await clickCell(8, 7);
  check('A walk', await waitFor(/CIVLING GOTO \(8,7\)/, 'A GOTO', 15000));
  await clickJev('harvest');
  check('A yield +17', await waitFor(/JEV YIELD \+17 \(harvest\)/, 'A YIELD', 40000));
  await sleep(600);
  let text = await bodyText();
  check('A lifetime persisted in HUD (17 / 1 jev)',
    /Lifetime 17/.test(text) && /1 jevs done/.test(text));

  await clickBtn('Generate prop');
  const priced = await (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (/Confirm — generate for/.test(await bodyText())) return true;
      await sleep(300);
    } return false;
  })();
  check('A estimate priced (with LoRA)', priced);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Confirm — generate for'));
    b?.click();
  });
  check(
    'A prop saved to shared city',
    await waitFor(/CIVLINGS GRID READY/, 'noop', 0).then(() =>
      (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 60000) {
          const t = await bodyText();
          if (/Shared city props: 1/.test(t)) return true;
          await sleep(400);
        } return false;
      })()),
  );
  text = await bodyText();
  console.log('A log:', (text.match(/[^\n]*shared city[^\n]*/i) || [])[0] ?? '(no shared-city log line)');
  await page.screenshot({ path: `${OUT}/A-shared-prop.png` });
  await browser.close();
}

// ---------- B) read path (seeded cold load) --------------------------------
{
  const playerSeed = { 'player:v1': { c: 6, r: 3, stamina: 77, earnedTotal: 123, tasksDone: 7, propsPlaced: 2 } };
  const sharedSeed = [{
    value: { title: 'Prop: seeded lantern', body: 'seeded lantern',
             data: { kind: 'prop', c: 2, r: 2, imageId: 424242 } },
    authorUserId: 999,
  }];
  const imageSeed = [{ imageId: 424242, status: 'visible', nsfwLevel: 1, contentRating: 'g', url: PNG64, width: 8, height: 8 }];
  const q = '?consent=granted'
    + '&seedplayer=' + encodeURIComponent(JSON.stringify(playerSeed))
    + '&seedshared=' + encodeURIComponent(JSON.stringify(sharedSeed))
    + '&seedimages=' + encodeURIComponent(JSON.stringify(imageSeed));
  const { browser, page, waitFor, bodyText } = await openRun(q);
  check('B boot', await waitFor(/CIVLINGS GRID READY/, 'B GRID', 120000));
  check('B civling restored at (6,3) stamina 77',
    await waitFor(/CIVLING RESTORED at \(6,3\) stamina=77/, 'B RESTORE', 30000));
  check('B seeded prop textured (2,2)',
    await waitFor(/PROP TEXTURED \(2,2\) 128x128/, 'B TEXTURE', 30000));
  await sleep(600);
  const text = await bodyText();
  check('B lifetime 123 / 7 jevs in HUD', /Lifetime 123/.test(text) && /7 jevs done/.test(text));
  check('B city props = 1', /Shared city props: 1/.test(text));
  check('B stamina shows 77', /Stamina\s*77/.test(text));
  await page.screenshot({ path: `${OUT}/B-restored-city.png` });
  await browser.close();
}

let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log(fail === 0 ? 'ALL GREEN' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
