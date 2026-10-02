import puppeteer from 'puppeteer-core';
const CHROME = '/home/hatch/workspace/.clickthrough/chrome-headless-shell-linux64/chrome-headless-shell';
const SETS = {
  a: ['--no-sandbox', '--disable-features=WebGPU,WebGPUService'],
  b: ['--no-sandbox', '--disable-features=WebGPU', '--enable-features=Vulkan'],
  c: ['--no-sandbox', '--disable-webgpu'],
  d: ['--no-sandbox', '--use-cmd-decoder=passthrough'],
};
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: SETS[process.argv[2]] });
const page = await browser.newPage();
await page.goto('about:blank');
const r = await page.evaluate(() => {
  const c = document.createElement('canvas');
  let wg = null, err = null;
  try { wg = !!c.getContext('webgpu'); } catch (e) { err = e.message; }
  const gpuNav = 'gpu' in navigator;
  let ad = null;
  return { webgpuCtx: wg, err, gpuInNavigator: gpuNav };
});
console.log(process.argv[2], JSON.stringify(r));
await browser.close();
