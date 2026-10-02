import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const SETS = {
  disablegpu: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  bare: ['--no-sandbox', '--disable-dev-shm-usage'],
  angle: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader','--disable-features=WebGPU'],
};
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: SETS[process.argv[2]] });
const page = await browser.newPage();
let ready = false;
page.on('console', (m) => { const t = m.text(); if (/CHIBI|INFO:ENGINE|ERROR|Defold Engine/i.test(t)) console.log('[c]', m.type(), t.slice(0, 160)); if (t.includes('CHIBI WORLD READY')) ready = true; });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8931/', { waitUntil: 'networkidle2', timeout: 45000 }).catch((e) => console.log('goto:', String(e).slice(0, 100)));
for (let i = 0; i < 12 && !ready; i++) await new Promise((r) => setTimeout(r, 1000));
console.log(ready ? 'ENGINE_READY' : 'ENGINE_NOT_READY after 12s');
const s = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c.getContext('webgl2');
  let px = null;
  if (gl) { const b = new Uint8Array(4); gl.readPixels(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); px = Array.from(b); }
  return { px, wh: [c.width, c.height] };
});
console.log('center pixel:', JSON.stringify(s));
await browser.close();
