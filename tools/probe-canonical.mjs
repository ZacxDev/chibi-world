import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
         '--proxy-server=http://127.0.0.1:18080', '--ignore-certificate-errors'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 140)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 160)); });
page.on('requestfailed', (r) => { texts.push('[reqfail] ' + r.url().slice(-60) + ' ' + (r.failure()?.errorText ?? '')); });
await page.goto('http://127.0.0.1:8616/wrap-canonical.html', { waitUntil: 'load', timeout: 60000 }).catch((e) => texts.push('[goto] ' + e.message));
await sleep(22000);
console.log('FRAMES:', page.frames().map((f) => f.url()).join(' | '));
console.log('GRID READY:', texts.some((t) => /CIVLINGS GRID READY/.test(t)), '| FROM LUA events:', texts.filter((t) => /FROM LUA/.test(t)).length);
console.log(texts.slice(0, 10).join('\n'));
await page.screenshot({ path: '/tmp/canonical-shot.png' });
await browser.close();
