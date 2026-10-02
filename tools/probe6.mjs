import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-features=WebGPU'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,180)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,250)));
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 8000));
const s = await page.evaluate(() => {
  const M = window.Module || {};
  return {
    _isEngineLoaded: M._isEngineLoaded,
    _isMainCalled: M._isMainCalled,
    _archiveLoaded: M._archiveLoaded,
    _preLoadDone: M._preLoadDone,
    hasWebGPU: M.hasWebGPUSupport ? M.hasWebGPUSupport() : null,
    hasWebGL: M.hasWebGLSupport ? M.hasWebGLSupport() : null,
    isWASMPthread: M.isWASMPthreadSupported ? M.isWASMPthreadSupported() : null,
    engineVersion: M.engineVersion,
  };
});
console.log('STATES:', JSON.stringify(s, null, 1));
await browser.close();
console.log('DONE');
