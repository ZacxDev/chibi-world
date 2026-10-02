import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__rc = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__rc++; return orig(cb); };
  window.__readyLogs = [];
});
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,160)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 6000));
const s = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  let attrs = null, ctxType = null;
  try {
    const gl = c.getContext('webgl2');
    ctxType = gl ? 'webgl2-exists' : 'null';
    if (gl) attrs = gl.getContextAttributes();
  } catch (e) { ctxType = 'err:' + e.message; }
  return {
    rafCount: window.__rc,
    hidden: document.hidden,
    vis: document.visibilityState,
    hasFocus: document.hasFocus(),
    canvasWH: [c.width, c.height],
    ctxType, attrs,
    workerErr: null,
  };
});
console.log('STATE:', JSON.stringify(s));
// keep page alive + visible & take screenshot
await page.bringToFront();
await page.focus('canvas').catch(() => {});
await page.mouse.move(480, 270);
await page.mouse.click(480, 270);
await new Promise(r => setTimeout(r, 3000));
const s2 = await page.evaluate(() => ({ rafCount: window.__rc, hidden: document.hidden, hasFocus: document.hasFocus() }));
console.log('STATE2:', JSON.stringify(s2));
await browser.close();
console.log('PROBE3 DONE');
