import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,200)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 5000));
const s = await page.evaluate(() => {
  const M = window.Module || {};
  return {
    calledRun: M.calledRun,
    runDependencies: Object.keys(M).filter(k => /depend|runtime|main/i.test(k)).slice(0, 15),
    has_callMain: typeof M.callMain,
    ccall: typeof M.ccall,
    preRun: Array.isArray(M.preRun) ? M.preRun.length : typeof M.preRun,
    postRun: Array.isArray(M.postRun) ? M.postRun.length : typeof M.postRun,
    noInitialRun: M.noInitialRun,
    wasmReady: !!M.wasmReady,
    keys: Object.keys(M).slice(0, 40),
  };
});
console.log(JSON.stringify(s, null, 1));
await browser.close();
console.log('DONE');
