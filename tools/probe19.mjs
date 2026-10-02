import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,150)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
page.on('request', r => { const u = r.url(); if (!/archive\//.test(u)) console.log('[req]', u.slice(0,110)); });
await page.goto('http://127.0.0.1:8932/?req=1', { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,100)));
await new Promise(r => setTimeout(r, 8000));
const st = await page.evaluate(() => {
  const c = document.getElementById('canvas');
  return { canvasW: c && c.width, canvasH: c && c.height,
           ctx2d: !!(c && c.getContext('2d', { willReadFrequently: true })),
           attrs: c && c.getAttributeNames() };
});
console.log('CANVAS:', JSON.stringify(st));
await browser.close();
console.log('DONE');
