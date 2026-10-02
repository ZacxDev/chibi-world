import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.type(), m.text().slice(0,160)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,250)));
page.on('workercreated', async w => {
  console.log('WORKER:', w.url());
});
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8941/', { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
// wait up to 30s for MINPROJ
let ok = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
}
const s = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { wh: [c.width, c.height], isolated: window.crossOriginIsolated, sab: typeof SharedArrayBuffer };
});
console.log('STATE:', JSON.stringify(s));
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/min-coep.png' });
await browser.close();
console.log('DONE');
