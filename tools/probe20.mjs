import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.argv[2], headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,150)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
await page.goto(process.argv[3], { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 9000));
const shot = await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/min-fullchrome.png' });
console.log('shot saved, bytes:', shot.length);
await browser.close();
console.log('DONE');
