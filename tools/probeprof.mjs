import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[c]', m.type(), m.text().slice(0,150)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,250)));
const client = await page.target().createCDPSession();
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 1000 });
await client.send('Profiler.start');
await page.setViewport({ width: 960, height: 540 });
await page.goto('http://127.0.0.1:8932/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 6000));
const { profile } = await client.send('Profiler.stop');
const counts = new Map();
for (const n of profile.nodes) {
  const f = (n.callFrame.functionName || '(anon)') + ' @' + n.callFrame.url.split('/').pop();
  counts.set(f, (counts.get(f) || 0) + (n.hitCount || 0));
}
const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
console.log('TOP PROFILED FRAMES:');
for (const [f, c] of top) console.log(' ', c, f);
await browser.close();
console.log('DONE');
