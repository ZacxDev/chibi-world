import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.argv[2] || 'https://defold.com/sample-third-person-playground/';
const SHOT = process.argv[3] || '/home/hatch/workspace/scratch-defold/screenshots/official-sample.png';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,140)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(0,100), r.failure()?.errorText));
await page.setViewport({ width: 960, height: 540 });
await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 15000));
await page.screenshot({ path: SHOT });
console.log('shot:', SHOT);
await browser.close();
console.log('DONE');
