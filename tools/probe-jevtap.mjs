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
console.log('iframe box:', JSON.stringify(box));
// tile (8,7) via the same projection the suites use
const CAM = [19.62, 19.62, 19.62];
const R = [0.70711, 0, -0.70711], U = [-0.40825, 0.81650, -0.40825];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wx = (8 - 4.5) * 2, wz = (7 - 4.5) * 2;
const rel = [wx - CAM[0], 0 - CAM[1], wz - CAM[2]];
const W = Math.round(box.width), H = Math.round(box.height);
const px = (dot(rel, R) / ((W / 28) * 0.5) + 1) / 2 * W;
const pyb = (dot(rel, U) / ((H / 28) * 0.5) + 1) / 2 * H;
await page.mouse.move(box.x + px, box.y + (H - pyb));
await page.mouse.down(); await sleep(150); await page.mouse.up();
await sleep(1500);
console.log('after tile tap:', texts.filter((t) => /GOTO|BUSY|HUD/.test(t)).slice(-3).join(' ; '));
// harvest button
await page.mouse.move(box.x + (159 / 960) * box.width, box.y + (1 - 50 / 540) * box.height);
await page.mouse.down(); await sleep(150); await page.mouse.up();
await sleep(4000);
console.log('after button tap:'); console.log(texts.slice(-14).join('\n'));
await browser.close();
