import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0,200)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 12000));
const state = await page.evaluate(() => ({
  readyState: document.readyState,
  canvas: !!document.querySelector('canvas'),
  canvasWH: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })(),
  Module: typeof window.Module !== 'undefined',
  title: document.title,
}));
console.log('STATE:', JSON.stringify(state));
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/probe.png' });
await browser.close();
console.log('PROBE DONE');
