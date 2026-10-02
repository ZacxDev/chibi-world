import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
const client = await page.target().createCDPSession();
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 2000 });
await page.goto('http://127.0.0.1:8932/', { waitUntil: 'load', timeout: 45000 }).catch(e => console.log('goto:', String(e).slice(0,100)));
await new Promise(r => setTimeout(r, 2000));
await client.send('Profiler.start');
await new Promise(r => setTimeout(r, 12000));
const { profile } = await client.send('Profiler.stop');
// compute self-time per function category
const selfTime = new Map();
for (let i = 0; i < profile.nodes.length; i++) {
  const n = profile.nodes[i];
}
// use samples+timeDeltas instead
const samples = profile.samples || [];
const deltas = profile.timeDeltas || [];
const perNode = new Map();
for (let i = 0; i < samples.length; i++) {
  const id = samples[i];
  perNode.set(id, (perNode.get(id) || 0) + (deltas[i] || 0));
}
const nodeInfo = new Map(profile.nodes.map(n => [n.id, n.callFrame]));
const agg = new Map();
for (const [id, t] of perNode) {
  const f = nodeInfo.get(id);
  const key = ((f && f.functionName) || '(idle/anon)') + ' @' + (((f && f.url) || '').split('/').pop());
  agg.set(key, (agg.get(key) || 0) + t);
}
const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('POST-BOOT 12s CPU (micro-secs):');
for (const [k, v] of top) console.log(' ', v, k);
await browser.close();
console.log('DONE');
