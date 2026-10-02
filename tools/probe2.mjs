import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,160)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
page.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
for (let i = 1; i <= 4; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const s = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    let px = null, gl = null;
    try {
      gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
      if (gl) {
        const buf = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        px = Array.from(buf);
      }
    } catch (e) { px = 'ERR:' + e.message; }
    return {
      canvasWH: [c.width, c.height],
      pixel: px,
      engineKeys: typeof EngineLoader !== 'undefined',
      moduleMain: typeof window.Module !== 'undefined',
      // does the engine update loop run? sample rAF count over 1s
      rafCount: window.__rc || 0,
      title: document.title,
    };
  });
  console.log('SNAP ' + i, JSON.stringify(s));
}
await browser.close();
console.log('PROBE2 DONE');
