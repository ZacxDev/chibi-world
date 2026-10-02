import puppeteer from 'puppeteer-core';
const CHROME = '/opt/meta-chromium/chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests','--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8932'] });
const page = await browser.newPage();
let ready = false;
page.on('console', (m) => { const t = m.text(); if (/MINPROJ|CHIBI|INFO|ERROR/i.test(t)) console.log('[c]', m.type(), t.slice(0,170)); if (/BOOT OK/.test(t)) ready = true; });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,200)));
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8932/', { waitUntil: 'load', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0,100)));
for (let i = 0; i < 20 && !ready; i++) await new Promise((r) => setTimeout(r, 1000));
console.log(ready ? 'MINPROJ_READY' : 'MINPROJ_NOT_READY');
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/min-chromium.png' });
await browser.close();
console.log('DONE');
