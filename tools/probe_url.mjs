import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.argv[2];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
let saw = [];
page.on('console', (m) => { saw.push(m.type() + ':' + m.text().slice(0, 140)); });
page.on('pageerror', (e) => saw.push('PAGEERROR:' + String(e).slice(0, 200)));
await page.setViewport({ width: 960, height: 540 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0, 100)));
await new Promise((r) => setTimeout(r, 9000));
console.log(saw.join('\n'));
await browser.close();
