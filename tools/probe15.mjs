import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
let ready = false;
page.on('console', (m) => { const t = m.text(); console.log('[' + Math.floor((Date.now()-t0)/1000) + 's]', m.type(), t.slice(0,130)); if (/BOOT OK/.test(t)) ready = true; });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,200)));
const t0 = Date.now();
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8932/?long=1', { waitUntil: 'load', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0,100)));
for (let i = 0; i < 60 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  if (i % 10 === 9) console.log('  ...', i + 1, 's elapsed, ready =', ready);
}
console.log(ready ? 'MINPROJ_READY' : 'MINPROJ_NOT_READY after 60s');
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/min-long.png' });
await browser.close();
console.log('DONE');
