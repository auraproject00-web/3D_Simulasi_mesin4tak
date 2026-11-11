// Tangkapan layar untuk cek visual.
//   node tools/shoot.cjs <url> <out.png> [--w 1440] [--h 900] [--wait 3] [--js "..."] [--full]
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = { w: 1440, h: 900, wait: 3, js: [], full: false, dpr: 1 };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--w') opt.w = +args[++i]; else if (a === '--h') opt.h = +args[++i]; else if (a === '--wait') opt.wait = +args[++i];
  else if (a === '--js') opt.js.push(args[++i]); else if (a === '--full') opt.full = true; else if (a === '--dpr') opt.dpr = +args[++i];
  else if (a === '--dark') opt.dark = true; else pos.push(a);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: opt.dpr, colorScheme: opt.dark ? 'dark' : 'light' });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => logs.push('requestfailed: ' + r.url()));
  await p.goto(pos[0], { waitUntil: 'load' });
  await p.waitForFunction(() => window.__mesin !== undefined, null, { timeout: 60000 }).catch(() => logs.push('timeout waiting __mesin'));
  await p.waitForTimeout(opt.wait * 1000);
  for (const js of opt.js) { await p.evaluate(js).catch((e) => logs.push('js error: ' + e.message)); await p.waitForTimeout(1500); }
  const ft = await p.evaluate(() => new Promise((r) => { const t0 = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(((performance.now() - t0) / 2).toFixed(0)))); })).catch(() => '?');
  logs.push('frame ms ' + ft);
  await p.screenshot({ path: pos[1], fullPage: opt.full, timeout: 170000 });
  console.log(logs.slice(0, 20).join('\n') || 'no console errors');
  await b.close();
})();
