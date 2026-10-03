import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1250 });
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 140)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 180)); });
await page.goto('http://localhost:5186/?consent=granted', { waitUntil: 'load', timeout: 30000 });
await sleep(14000);
const el = await page.$('iframe[title="Civlings game"]');
const box = await el.boundingBox();
// find the game frame (nested inside the app frame)
const gameFrame = page.frames().find((f) => f.url().includes('/game/index.html'));
console.log('game frame:', gameFrame ? gameFrame.url() : 'NONE');
const rects = await gameFrame.evaluate(() => {
  const c = document.getElementById('canvas');
  const r = c.getBoundingClientRect();
  return { canvas: { x: r.x, y: r.y, w: r.width, h: r.height }, win: { w: window.innerWidth, h: window.innerHeight } };
});
console.log('iframe box:', JSON.stringify(box));
console.log('in-frame rects:', JSON.stringify(rects));
const frameEl = await gameFrame.frameElement();
const fbox = await frameEl.boundingBox();
console.log('game frame element box (main-page coords):', JSON.stringify(fbox));
// tap tile (8,7) via canvas-true coords: iso projection in canvas fractions
const CAM = [19.62, 19.62, 19.62];
const R = [0.70711, 0, -0.70711], U = [-0.40825, 0.81650, -0.40825];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wx = (8 - 4.5) * 2, wz = (7 - 4.5) * 2;
const rel = [wx - CAM[0], 0 - CAM[1], wz - CAM[2]];
const W = rects.canvas.w, H = rects.canvas.h;
const px = (dot(rel, R) / ((W / 28) * 0.5) + 1) / 2;
const pyb = (dot(rel, U) / ((H / 28) * 0.5) + 1) / 2;
await page.mouse.move(fbox.x + rects.canvas.x + px * W, fbox.y + rects.canvas.y + (1 - pyb) * H);
await page.mouse.down(); await sleep(150); await page.mouse.up();
await sleep(1500);
console.log('after tile tap:', texts.filter((t) => /GOTO|BUSY|HUD|pageerror/.test(t)).slice(-3).join(' ; '));
// harvest button, canvas-true coords
const bx = fbox.x + rects.canvas.x + (159 / 960) * W;
const by = fbox.y + rects.canvas.y + (1 - 50 / 540) * H;
console.log('button tap point (main-page):', bx.toFixed(1), by.toFixed(1), 'vs iframe-fraction point:', (box.x + (159 / 960) * box.width).toFixed(1), (box.y + (1 - 50 / 540) * box.height).toFixed(1));
await page.mouse.move(bx, by);
await page.mouse.down(); await sleep(150); await page.mouse.up();
await sleep(5000);
console.log('after button tap:');
console.log(texts.filter((t) => /HUD JEV|JEV ASSIGNED|JEV YIELD|BUSY|pageerror/.test(t)).slice(-6).join('\n'));
await browser.close();
