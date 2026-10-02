import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = '/home/hatch/workspace/scratch-defold/screenshots';
const LOG_FILE = '/home/hatch/workspace/scratch-defold/logs/web-console.log';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const ARGSET = process.argv[2] || 'swift';
const ARGSETS = {
  swift: ['--no-sandbox', '--disable-dev-shm-usage',
          '--use-gl=angle', '--use-angle=swiftshader-webgl',
          '--enable-unsafe-swiftshader'],
  plain: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  headful: ['--no-sandbox', '--disable-dev-shm-usage'],
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ARGSETS[ARGSET] || ARGSETS.swift,
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });

const messages = [];
page.on('console', (m) => {
  const t = m.text();
  messages.push(`[${m.type()}] ${t}`);
  if (/CHIBI|READY|WORLD|Error|ERROR/i.test(t)) console.log('[console]', t.slice(0, 200));
});
page.on('pageerror', (e) => { const t = String(e); messages.push('[pageerror] ' + t); console.log('[pageerror]', t.slice(0, 300)); });
page.on('requestfailed', (r) => { const t = 'HTTP FAIL ' + r.url(); messages.push(t); console.log(t); });

// WebGL2 probe first (fresh page, data URL)
const probe = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2');
  const gl1 = c.getContext('webgl') || c.getContext('experimental-webgl');
  return {
    webgl2: !!gl2,
    webgl1: !!gl1,
    renderer: gl2 ? (gl2.getParameter(gl2.RENDERER) + ' | ' + gl2.getParameter(gl2.VERSION)) : null,
  };
});
console.log('WEBGL probe:', JSON.stringify(probe));

async function snap(name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}` });
  console.log('shot', name);
}

async function waitForWorld(timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = messages.some((m) => m.includes('CHIBI WORLD READY'));
    if (ok) { console.log('WORLD READY after', Date.now() - t0, 'ms'); return true; }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function readyToRun() {
  await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 })
    .catch((e) => console.log('goto:', String(e).slice(0, 150)));
  const ok = await waitForWorld(30000);
  console.log(ok ? 'READY ok' : 'READY TIMEOUT (falling back to pixel check)');
  // anchor canvas focus centrally
  await page.mouse.move(480, 300);
  await page.mouse.click(480, 300).catch(() => {});
  return ok;
}

const ok = await readyToRun();
await new Promise((r) => setTimeout(r, 800));
await snap('01_spawn.png');

// screenshot-check helpers (read PNG bytes for rough average color)
function pngStats(file) {
  const buf = fs.readFileSync(file);
  return { size: buf.length, head: buf.subarray(0, 8).toString('hex') };
}

// 02: hold W (move forward/up) for text-time; screenshot mid-stride
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 1000));
await snap('02_walk.png');
await new Promise((r) => setTimeout(r, 1200));
await page.keyboard.up('KeyW');
await snap('03_house.png');

// jump once for fun (visible in screenshot phase? quick)
await page.keyboard.press('Space');
await new Promise((r) => setTimeout(r, 350));
// 04: strafe right (D) for a different angle
await page.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 1600));
await snap('04_orbit.png');
await page.keyboard.up('KeyD');

console.log('PNG stats:', JSON.stringify({
  spawn: pngStats(`${SHOT_DIR}/01_spawn.png`),
  walk: pngStats(`${SHOT_DIR}/02_walk.png`),
  house: pngStats(`${SHOT_DIR}/03_house.png`),
  orbit: pngStats(`${SHOT_DIR}/04_orbit.png`),
}));

fs.writeFileSync(LOG_FILE, messages.join('\n'));
console.log('TOTAL console messages:', messages.length);
await browser.close();
console.log('DRIVER DONE');
