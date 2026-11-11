// Beberapa tangkapan layar dalam satu sesi browser.
//   node tools/tour.cjs <url> <outdir> <w> <h> '<json [[name, js, waitSec], ...]>' [--dark]
const { chromium } = require('playwright');
const [url, outdir, w, h, stepsJson, dark] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  const logs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_TUNNEL')) logs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__mesin !== undefined, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  for (const [name, js, wait] of JSON.parse(stepsJson)) {
    if (js) await p.evaluate(js).catch((e) => logs.push(name + ' js error: ' + e.message));
    await p.waitForTimeout((wait ?? 2) * 1000);
    const info = await p.evaluate(() => { const s = __mesin.sim.state; return `rpm ${s.rpm.toFixed(0)} gear ${s.gear} clutch ${s.clutchState} head ${s.headC.toFixed(0)} out ${s.out.toFixed(0)}`; });
    await p.screenshot({ path: `${outdir}/${name}.png`, timeout: 170000, fullPage: name.endsWith('full') });
    console.log(name, '|', info);
  }
  console.log(logs.slice(0, 20).join('\n') || 'no console errors');
  await b.close();
})();
