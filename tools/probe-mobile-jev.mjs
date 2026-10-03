import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
});
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 160)); });
await page.goto('http://127.0.0.1:8611/', { waitUntil: 'load', timeout: 30000 });
await sleep(12000);
const frame = page.frames().find((f) => f.url().includes('/game/'));
const canvas = await frame.$('canvas');
// 1) tap a tile (canvas centre) so a target is set
await canvas.tap();
await sleep(2500);
console.log('tile tap:', texts.filter((t) => /GOTO/.test(t)).slice(-1).join('') || '(none)');
// 2) tap the Harvest HUD button (canvas fractions x=159/960, y from bottom 50/540)
const bb = await canvas.boundingBox();
await page.touchscreen.tap(bb.x + (159 / 960) * bb.width, bb.y + (1 - 50 / 540) * bb.height);
await sleep(4000);
console.log('button tap:', texts.filter((t) => /JEV ASSIGNED|JEV YIELD|pageerror/.test(t)).slice(-2).join(' ; ') || '(none)');
await browser.close();
