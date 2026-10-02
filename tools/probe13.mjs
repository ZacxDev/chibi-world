import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { if (/HOOK _callMain|Running/.test(m.text())) console.log('[c]', m.text().slice(0,90)); });
const client = await page.target().createCDPSession();
await client.send('Debugger.enable');
let pausedCount = 0;
client.on('Debugger.paused', async (ev) => {
  pausedCount++;
  console.log('PAUSED #' + pausedCount, 'reason:', ev.reason);
  for (const f of ev.callFrames.slice(0, 10)) {
    console.log('  fn:', f.functionName || '(anon)', '@', f.url.split('/').pop(), ':', f.location.lineNumber);
  }
  await client.send('Debugger.resume').catch(()=>{});
});
await page.goto('http://127.0.0.1:8932/?nocache=9', { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,120)));
await new Promise(r => setTimeout(r, 5000));
console.log('--- pausing main thread to sample stack ---');
await client.send('Debugger.pause');
await new Promise(r => setTimeout(r, 1500));
console.log('total pauses:', pausedCount);
await browser.close();
console.log('DONE');
