import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8932/', { waitUntil: 'load' });
const r = await page.evaluate(() => new Promise((resolve) => {
  const out = { idb: typeof indexedDB !== 'undefined' };
  let done = false;
  const finish = (v) => { if (!done) { done = true; out.result = v; resolve(out); } };
  setTimeout(() => finish('TIMEOUT-2s'), 2000);
  try {
    const req = indexedDB.open('probe-db', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('s'); out.created = true; };
    req.onsuccess = () => { try { const tx = req.result.transaction('s','readwrite'); tx.objectStore('s').put('x','k'); tx.oncomplete = () => finish('write-ok'); tx.onerror = () => finish('tx-err'); } catch(e) { finish('tx-throw:'+e.message); } };
    req.onerror = () => finish('open-err');
  } catch (e) { finish('throw:' + e.message); }
}));
console.log('IDB probe:', JSON.stringify(r));
await browser.close();
console.log('DONE');
