import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__fails = [];
  window.addEventListener('error', (e) => window.__fails.push('error: ' + (e.message || e.type) + ' @' + (e.filename || '')));
  window.addEventListener('unhandledrejection', (e) => window.__fails.push('unhandledrejection: ' + String(e.reason).slice(0, 200)));
});
page.on('console', m => {
  const t = m.text();
  if (!/HOOK onArchiveFileLoaded/.test(t)) console.log('[c]', m.type(), t.slice(0, 150));
});
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 250)));
page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(0, 90), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8932/?watch=1', { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,100)));
await new Promise(r => setTimeout(r, 10000));
const dump = await page.evaluate(() => ({
  fails: window.__fails,
  status: Module && Module.setStatus ? undefined : 'noModule',
  engineLoaded: Module._isEngineLoaded,
  mainCalled: Module._isMainCalled,
  syncInProgress: Module._syncInProgress,
  syncNeeded: Module._syncNeeded,
}));
console.log('DUMP:', JSON.stringify(dump, null, 1));
await browser.close();
console.log('DONE');
