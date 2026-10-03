import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1250 });
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 140)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 160)); });
await page.goto('http://localhost:5186/?consent=granted', { waitUntil: 'load', timeout: 30000 });
await sleep(30000);
console.log(texts.filter((t) => /HUD|GRID READY|pageerror|CIVLING READY/.test(t)).slice(0, 6).join('\n'));
await page.screenshot({ path: '/tmp/hud-shot.png' });
await browser.close();
