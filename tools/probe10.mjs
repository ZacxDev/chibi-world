import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const FLAGS = [
  ['--no-sandbox','--disable-dev-shm-usage'],
  ['--no-sandbox','--disable-dev-shm-usage','--run-all-compositor-stages-before-draw','--disable-threaded-animation','--disable-threaded-scrolling'],
];
for (let i = 0; i < FLAGS.length; i++) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: FLAGS[i] });
  const page = await browser.newPage();
  page.on('console', m => { if (/MINPROJ|BOOT|CHIBI/.test(m.text())) console.log('FLAGSET', i, 'CONSOLE:', m.text().slice(0,80)); });
  await page.goto('http://127.0.0.1:8932/', { waitUntil: 'load', timeout: 30000 });
  const raf = await page.evaluate(() => new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    function step() { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(step); else res({ frames: n }); }
    requestAnimationFrame(step);
    setTimeout(() => res({ frames: n, timeoutFallback: true }), 3000);
  }));
  console.log('FLAGSET', i, 'rAF frames in 1.5s:', JSON.stringify(raf));
  await new Promise(r => setTimeout(r, 6000));
  const canvasPx = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'no-gl';
    const b = new Uint8Array(4);
    gl.readPixels(100, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return Array.from(b);
  });
  console.log('FLAGSET', i, 'canvas pixel:', JSON.stringify(canvasPx));
  await browser.close();
}
console.log('DONE');
