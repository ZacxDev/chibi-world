import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.argv[2];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0,150)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,300)));
await page.setViewport({ width: 960, height: 540 });
await page.goto(URL, { waitUntil: 'load', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0,100)));
await new Promise((r) => setTimeout(r, 12000));
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/min-patched.png' });
await browser.close();
console.log('DONE');
