import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__ctxEvents = [];
  window.addEventListener('webglcontextcreationerror', (e) => {
    window.__ctxEvents.push('creationerror: ' + e.statusMessage);
    console.error('CTXERR inline:', e.statusMessage);
  }, true);
  window.addEventListener('webglcontextlost', (e) => {
    window.__ctxEvents.push('contextlost');
    console.error('CTXLOST inline');
  }, true);
});
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,170)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
await page.goto('http://127.0.0.1:8932/?ctx=1'.replace('8932','8932'), { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,100)));
await new Promise(r => setTimeout(r, 10000));
const ev = await page.evaluate(() => window.__ctxEvents);
console.log('CTX EVENTS:', JSON.stringify(ev));
await browser.close();
console.log('DONE');
