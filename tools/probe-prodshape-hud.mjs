import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 120)); });
await page.goto('http://127.0.0.1:8700/wrap-csp.html', { waitUntil: 'load', timeout: 30000 });
await sleep(20000);
const appFrame = page.frames().find((f) => f.url().includes('8699'));
console.log('app frame:', appFrame ? appFrame.url() : 'NOT FOUND');
if (appFrame) {
  const hud = await appFrame.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  console.log('HUD:', hud);
}
console.log('GRID READY:', texts.some((t) => /CIVLINGS GRID READY/.test(t)));
await browser.close();
