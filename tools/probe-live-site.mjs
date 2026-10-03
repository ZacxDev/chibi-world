import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
         '--proxy-server=http://127.0.0.1:18080', '--ignore-certificate-errors'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1000 });
const texts = [];
page.on('console', (m) => { texts.push('[' + (m.location()?.url ?? '').slice(-30) + '] ' + m.text().slice(0, 160)); });
page.on('pageerror', (e) => { texts.push('[pageerror] ' + String(e).slice(0, 200)); });
page.on('requestfailed', (r) => { texts.push('[reqfail] ' + r.url().slice(-70) + ' ' + (r.failure()?.errorText ?? '')); });
page.on('response', (r) => { if (r.status() >= 400) texts.push('[http ' + r.status() + '] ' + r.url().slice(-70)); });
await page.goto(process.argv[2] || 'https://civlings.civit.ai/', { waitUntil: 'load', timeout: 60000 }).catch((e) => texts.push('[goto] ' + e.message));
await sleep(20000);
console.log('FRAMES:', page.frames().map((f) => f.url()).join(' | '));
console.log(texts.slice(0, 30).join('\n'));
await page.screenshot({ path: '/tmp/livesite-shot.png' });
await browser.close();
