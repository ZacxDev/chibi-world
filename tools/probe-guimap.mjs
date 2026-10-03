import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1250 });
const texts = [];
page.on('console', (m) => { texts.push(m.text().slice(0, 130)); });
await page.goto('http://localhost:5186/?consent=granted', { waitUntil: 'load', timeout: 30000 });
await sleep(14000);
const el = await page.$('iframe[title="Civlings game"]');
const box = await el.boundingBox();
const spots = [
  ['A center', 0.5, 0.5], ['B bottom-mid', 0.5, 0.93], ['C harvest-ctr', 159 / 960, 1 - 50 / 540],
  ['D left-mid', 0.25, 0.5], ['E right-mid', 0.75, 0.5],
];
for (const [name, fx, fy] of spots) {
  const before = texts.length;
  await page.mouse.move(box.x + fx * box.width, box.y + fy * box.height);
  await sleep(600);
  const lines = texts.slice(before).filter((t) => /HUD INPUT/.test(t));
  console.log(name, 'css(' + fx.toFixed(3) + ',' + fy.toFixed(3) + ') ->', lines.length ? lines[lines.length - 1] : '(no event)');
}
await browser.close();
