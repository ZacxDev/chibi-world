import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { if (/HOOK/.test(m.text())) console.log('[hook]', m.text()); });
page.on('workercreated', w => console.log('WORKER CREATED:', w.url()));
page.on('workerdestroyed', w => console.log('WORKER DESTROYED:', w.url()));
page.on('targetcreated', t => console.log('TARGET:', t.type(), t.url().slice(0,80)));
await page.goto('http://127.0.0.1:8932/?nocache=5', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 6000));
const targets = await browser.targets();
console.log('ALL TARGETS:');
for (const t of targets) console.log(' -', t.type(), t.url().slice(0, 90));
await browser.close();
console.log('DONE');
