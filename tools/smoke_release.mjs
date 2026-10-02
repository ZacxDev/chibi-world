import puppeteer from 'puppeteer-core';

const CHROME = '/home/hatch/workspace/tools/chrome-linux64/chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8944/';
const OUT = process.argv[3] || '/home/hatch/workspace/scratch-defold/screenshots/06_release.png';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto:', String(e).slice(0, 120)));
await new Promise((r) => setTimeout(r, 9000));
await page.mouse.click(480, 300).catch(() => {});
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 1200));
await page.keyboard.up('KeyW');
await page.screenshot({ path: OUT });
console.log('shot', OUT);
await browser.close();
console.log('RELEASE SMOKE DONE');
