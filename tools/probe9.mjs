import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--disable-features=WebGPU'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
    if (type === 'webgpu') return null;
    return orig.call(this, type, ...rest);
  };
  try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch (e) {}
});
let ready = false;
page.on('console', (m) => { const t = m.text(); if (/CHIBI|INFO|ERROR|Defold|warn/i.test(t)) console.log('[c]', m.type(), t.slice(0, 170)); if (t.includes('CHIBI WORLD READY')) ready = true; });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0, 100)));
for (let i = 0; i < 15 && !ready; i++) await new Promise((r) => setTimeout(r, 1000));
console.log(ready ? 'ENGINE_READY' : 'ENGINE_NOT_READY after 15s');
const s = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c.getContext('webgl2');
  const b = new Uint8Array(4);
  gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
  return { center: Array.from(b), wh: [c.width, c.height],
           wgSupport: Module.hasWebGPUSupport(), wglSupport: Module.hasWebGLSupport() };
});
console.log('center:', JSON.stringify(s));
await page.screenshot({ path: '/home/hatch/workspace/scratch-defold/screenshots/probe9.png' });
await browser.close();
console.log('DONE');
