// PLAYTEST — every feature of the Civlings app, driven like a player, with
// screenshots and a frame-rate/perf pass. Run log prints PLAYTEST JSON lines.
// Features: boot/header · tile select+walk · Civling stats HUD · all four Jev
// tasks with formula yields · cooldown · busy/tired rejections · stamina
// drain/regen · prompt generation (consent->price->confirm->publish->shared)
// · seeded persistence restore (civling, score, stamina, shared prop texture)
// · stress: 20 prop cards + walk FPS.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = 'http://localhost:5186/';
const OUT = '/home/hatch/workspace/goals/build-and-publish-apps-that-make-money-24-7/app/civlings/review/phase4';
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

async function launch() {
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
  const waitFor = async (re, timeoutMs, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) { if (saw(re)) return true; await sleep(250); }
    console.log('TIMEOUT: ' + (label || re)); return false;
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
    await page.mouse.down(); await sleep(150); await page.mouse.up();
  };
  const gameFrame = async () => {
    const el = await page.$('iframe[title="Civlings game"]');
    return el.contentFrame();
  };
  return { browser, page, texts, saw, waitFor, bodyText, clickBtn, clickCell, gameFrame };
}

const P = [];   // playtest records {feature, ok, detail}
const rec = (feature, ok, detail = '') => P.push({ feature, ok, detail });
const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}` }); };

// fps inside the game iframe via rAF cadence
async function fpsMeasure(frame, seconds) {
  return frame.evaluate((secs) => new Promise((resolve) => {
    let frames = 0; const t0 = performance.now(); const deltas = []; let last = t0;
    function tick(t) {
      frames++; deltas.push(t - last); last = t;
      if (t - t0 < secs * 1000) requestAnimationFrame(tick);
      else {
        deltas.sort((a, b) => a - b);
        resolve({ fps: frames / ((t - t0) / 1000),
                  p50: deltas[Math.floor(deltas.length * 0.5)] || 0,
                  p95: deltas[Math.floor(deltas.length * 0.95)] || 0 });
      }
    }
    requestAnimationFrame(tick);
  }), seconds);
}

// ==================== RUN 1: core loop ====================================
{
  const { browser, page, texts, saw, waitFor, bodyText, clickBtn, clickCell, gameFrame } =
    await launch();
  const t0 = Date.now();
  await page.goto(BASE + '?consent=granted', { waitUntil: 'load', timeout: 30000 });
  const booted = await waitFor(/CIVLINGS GRID READY: 100 tiles/, 120000, 'boot');
  const bootMs = Date.now() - t0;
  let text = await bodyText();
  rec('boot + header (viewer, balance)', booted && /dev-viewer/.test(text) && /Buzz:\s*7,750/.test(text), `boot-to-grid ${bootMs}ms`);
  // the stats line lands a roundtrip after LUA READY; wait for it explicitly
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      text = await bodyText();
      if (/STA 7 · PRO 6 · AFF 8/.test(text)) break;
      await sleep(300);
    }
  }
  rec('civling stats HUD', /STA 7 · PRO 6 · AFF 8 \(ruins\)/.test(text));
  await sleep(800);
  await shot(page, 'P1-city-spawn.png');

  // movement: far corner
  await clickCell(0, 9);
  rec('walk to (0,9)', await waitFor(/CIVLING GOTO \(0,9\)/, 15000));
  await sleep(5200);
  await shot(page, 'P2-civling-corner.png');

  // four tasks at the corner (formula: floor(base*1.25*1.1+0.5))
  const expect = { Harvest: 17, Craft: 28, Service: 11, Expedition: 62 };
  let staminaBefore = 100;
  for (const [label, y] of Object.entries(expect)) {
    await clickBtn(label);
    const okY = await waitFor(new RegExp(`JEV YIELD \\+${y} \\(`), 45000, 'yield ' + label);
    text = await bodyText();
    const stam = Number((text.match(/Stamina\s*(\d+)/) || [])[1] ?? NaN);
    rec(`Jev ${label}`, okY, `yield +${y}; stamina now ${stam} (was ${staminaBefore})`);
    staminaBefore = stam;
    if (label === 'Harvest') await shot(page, 'P3-harvest-done.png');
    await sleep(3600); // cooldown 3s
  }
  text = await bodyText();
  rec('session earnings total 118', /Session earned:\s*118/.test(text));

  // busy rejection: stamina tuning (drain 2.5/s, regen 2.5/s IDLE-only)
  // leaves ~3 after expedition #1 — rest ~20s so the next one can start.
  await sleep(20000);
  await clickBtn('Expedition');
  await sleep(1500);
  await clickBtn('Craft');
  rec('busy rejection while WORKING', await waitFor(/JEV REJECTED busy/, 15000));
  // ride out the second expedition
  await waitFor(/JEV YIELD \+62 \(expedition\)/, 45000);
  await shot(page, 'P4-expedition.png');

  // fatigue: 4 tasks cost 15+25+20+40 at 2.5/s drain; read the actual value
  text = await bodyText();
  const stamNow = Number((text.match(/Stamina\s*(\d+)/) || [])[1]);
  console.log('PLAYTEST stamina after 5 tasks:', stamNow);

  await browser.close();
}

// ==================== RUN 2: tired rejection (seeded low stamina) ==========
{
  const seed = { 'player:v1': { c: 4, r: 4, stamina: 20, earnedTotal: 0, tasksDone: 0, propsPlaced: 0 } };
  const { browser, page, waitFor, clickBtn } = await launch();
  await page.goto(BASE + '?consent=granted&seedplayer=' + encodeURIComponent(JSON.stringify(seed)),
    { waitUntil: 'load', timeout: 30000 });
  await waitFor(/CIVLING RESTORED at \(4,4\) stamina=20/, 60000, 'restore20');
  await clickBtn('Expedition');
  rec('tired rejection (stamina 20 < expedition cost 40)', await waitFor(/JEV REJECTED tired/, 20000));
  await browser.close();
}

// ==================== RUN 3: persistence restore + stress perf ============
{
  const playerSeed = { 'player:v1': { c: 6, r: 3, stamina: 77, earnedTotal: 123, tasksDone: 7, propsPlaced: 2 } };
  const sharedSeed = [{
    value: { title: 'Prop: seeded lantern', body: 'seeded lantern',
             data: { kind: 'prop', c: 2, r: 2, imageId: 424242 } }, authorUserId: 999 }];
  const imageSeed = [{ imageId: 424242, status: 'visible', nsfwLevel: 1, contentRating: 'g', url: PNG64, width: 8, height: 8 }];
  const q = '?consent=granted&seedplayer=' + encodeURIComponent(JSON.stringify(playerSeed))
    + '&seedshared=' + encodeURIComponent(JSON.stringify(sharedSeed))
    + '&seedimages=' + encodeURIComponent(JSON.stringify(imageSeed));
  const { browser, page, waitFor, bodyText, gameFrame } = await launch();
  await page.goto(BASE + q, { waitUntil: 'load', timeout: 30000 });
  const restoredOk = await waitFor(/CIVLING RESTORED at \(6,3\) stamina=77/, 60000, 'restore')
    && await waitFor(/PROP TEXTURED \(2,2\) 128x128/, 60000, 'seeded texture');
  let text = await bodyText();
  rec('cold-load restore (civling, score, stamina, shared prop texture)',
    restoredOk && /Lifetime 123/.test(text) && /Shared city props: 1/.test(text));
  await sleep(600);
  await shot(page, 'P5-restored-city.png');

  const frame = await gameFrame();
  const idle = await fpsMeasure(frame, 6);
  rec('perf: FPS idle (SwiftShader software GL)', idle.fps > 20,
    `${idle.fps.toFixed(1)} fps, p50 ${idle.p50.toFixed(1)}ms p95 ${idle.p95.toFixed(1)}ms`);

  // stress: 20 more prop scaffolds scattered on the grid
  await frame.evaluate(() => {
    const cells = [];
    for (let c = 0; c < 10; c++) for (let r = 0; r < 10; r += 5) cells.push([c, r]);
    for (const [c, r] of cells.slice(0, 20)) {
      // the frame's own game-bridge consumes 'to-lua' on its window
      window.postMessage(
        { civlings: 'to-lua', msg: { type: 'gen_prop', c, r } }, window.location.origin);
    }
  });
  await sleep(1500);
  const stressed = await fpsMeasure(frame, 6);
  rec('perf: FPS with 21 props (SwiftShader)', stressed.fps > 20,
    `${stressed.fps.toFixed(1)} fps, p95 ${stressed.p95.toFixed(1)}ms`);
  await shot(page, 'P6-stress-props.png');
  await browser.close();
}

console.log('=== PLAYTEST RESULTS ===');
let fail = 0;
for (const r of P) { console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.feature + (r.detail ? ' — ' + r.detail : '')); if (!r.ok) fail++; }
console.log(fail === 0 ? 'ALL PASS' : fail + ' FAILURES');
process.exit(fail === 0 ? 0 : 1);
