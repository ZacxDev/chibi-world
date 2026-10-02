import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const cons = [];
page.on('console', m => cons.push(m.text()));
page.on('pageerror', e => cons.push('[pageerror] ' + String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8611/?mock=1', { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, 12000));
const frame = page.frames().find(f => f.url().includes('game/index.html'));
console.log('frames:', page.frames().map(f => f.url()).join(' | '));
if (frame) {
  const probe = await frame.evaluate(() => ({
    hasCivlingsGame: typeof window.CivlingsGame,
    outerCivlingsGame: typeof window.CivlingsGame,
  })).catch(e => 'eval-fail: ' + e.message);
  console.log('game frame probe:', JSON.stringify(probe));
  const drainBefore = await frame.evaluate(() => window.CivlingsGame ? 'inbox-capable' : 'missing').catch(e => 'fail');
  console.log('capable:', drainBefore);
}
const logText = await page.$eval('#log', el => el.textContent).catch(() => '(no log)');
console.log('wrapper #log:', logText);
console.log('--- lua console lines:');
cons.filter(t => /CIVLINGS|BRIDGE|Error|error/i.test(t)).forEach(t => console.log('  ', t.slice(0, 160)));
await browser.close();
