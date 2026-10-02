import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = process.argv[2] || '/home/hatch/workspace/tools/chrome-linux64/chrome';
const URL = process.argv[3] || 'http://127.0.0.1:8943/';
const SHOT_DIR = '/home/hatch/workspace/scratch-defold/screenshots';
const LOG_FILE = '/home/hatch/workspace/scratch-defold/logs/web-console.log';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });

const messages = [];
page.on('console', (m) => {
  const t = m.text();
  messages.push(`[${m.type()}] ${t}`);
  if (/CHIBI|READY|Error|ERROR|FAIL/i.test(t)) console.log('[console]', t.slice(0, 200));
});
page.on('pageerror', (e) => { const t = String(e); messages.push('[pageerror] ' + t); console.log('[pageerror]', t.slice(0, 300)); });
page.on('requestfailed', (r) => { const t = 'HTTP FAIL ' + r.url(); messages.push(t); console.log(t); });

const probe = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2');
  return {
    webgl2: !!gl2,
    renderer: gl2 ? (gl2.getParameter(gl2.RENDERER) + ' | ' + gl2.getParameter(gl2.VERSION)) : null,
  };
});
console.log('WEBGL probe:', JSON.stringify(probe));

async function snap(name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}` });
  console.log('shot', name);
}

await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  .catch((e) => console.log('goto:', String(e).slice(0, 150)));

// wait for world-ready marker (up to 45s)
let ready = false;
for (let t = 0; t < 45000; t += 250) {
  if (messages.some((m) => m.includes('CHIBI WORLD READY'))) { ready = true; console.log('READY after', t, 'ms'); break; }
  await new Promise((r) => setTimeout(r, 250));
}
console.log(ready ? 'READY ok' : 'READY TIMEOUT');

await page.mouse.move(480, 300);
await page.mouse.click(480, 300).catch(() => {});
await new Promise((r) => setTimeout(r, 900));
await snap('01_spawn.png');

// hold W ~1s, screenshot mid-stride
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 1000));
await snap('02_walk.png');
await new Promise((r) => setTimeout(r, 1300));
await page.keyboard.up('KeyW');
await snap('03_house.png');

// strafe right for a different angle
await page.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 1600));
await snap('04_orbit.png');
await page.keyboard.up('KeyD');

// back up toward house for a closer look
await page.keyboard.down('KeyS');
await new Promise((r) => setTimeout(r, 900));
await snap('05_back.png');
await page.keyboard.up('KeyS');

fs.writeFileSync(LOG_FILE, messages.join('\n'));
console.log('TOTAL console messages:', messages.length);
await browser.close();
console.log('DRIVER DONE');
