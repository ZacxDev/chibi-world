import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
const texts = [];
page.on('console', (m) => { texts.push('[c] ' + m.text().slice(0, 160)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 200)); });
page.on('requestfailed', (r) => { texts.push('[reqfail] ' + r.url().slice(-70) + ' ' + (r.failure()?.errorText ?? '')); });
page.on('response', (r) => { if (r.status() >= 400) texts.push('[http ' + r.status() + '] ' + r.url().slice(-70)); });
await page.goto('http://localhost:5186/?consent=granted', { waitUntil: 'load', timeout: 30000 });
await sleep(30000);
console.log('FRAMES:', page.frames().map((f) => f.url()).join(' | '));
console.log('LINES:', texts.length);
console.log(texts.slice(0, 25).join('\n'));
await browser.close();
