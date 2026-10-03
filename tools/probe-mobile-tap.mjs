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
await page.goto('http://127.0.0.1:8611/', { waitUntil: 'load', timeout: 30000 });
await sleep(12000);
const frame = page.frames().find((f) => f.url().includes('/game/'));
const canvas = await frame.$('canvas');
await canvas.tap(); // taps the element centre, correctly translated to main-page coords
await sleep(3000);
console.log(texts.filter((t) => /INPUTDBG|GOTO/.test(t)).slice(0, 4).join('\n') || '(no input logged)');
await browser.close();
