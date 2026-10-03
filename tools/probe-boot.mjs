import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
page.on('console', (m) => { console.log('[console]', m.text().slice(0, 180)); });
page.on('pageerror', (e) => { console.log('[pageerror]', String(e).slice(0, 200)); });
page.on('requestfailed', (r) => { console.log('[reqfail]', r.url().slice(-60), r.failure()?.errorText ?? ''); });
await page.goto(process.argv[2] || 'http://127.0.0.1:8611/', { waitUntil: 'load', timeout: 30000 });
await sleep(25000);
await browser.close();
