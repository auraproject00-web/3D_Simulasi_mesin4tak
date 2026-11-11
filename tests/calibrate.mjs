import { createBench } from '../src/sim/bench.js';
const line = [];
for (const rpm of [2000, 3000, 4000, 5000, 5500, 6000, 7000, 7500, 8000, 9000]) {
  const b = createBench(); b.setChoke(false); b.setThrottle(1);
  const tq = b.holdSpeed(rpm, 1.2, { warm: 1, fixHeat: true });
  line.push(`${rpm}:${tq.toFixed(2)}Nm/${(tq * rpm * Math.PI / 30 / 1000).toFixed(2)}kW`);
}
console.log('WOT', line.join('  '));
const part = [];
for (const thr of [0, 0.05, 0.1, 0.2, 0.4]) { const b = createBench(); b.setChoke(false); b.setThrottle(thr); part.push(`${thr}@3000:${b.holdSpeed(3000, 1, { warm: 1, fixHeat: true }).toFixed(2)}`); }
console.log('part', part.join('  '));
// idle bebas, netral, hangat
function freeRun(opts) {
  const b = createBench(), st = b.state; b.setChoke(opts.choke); st.headC = 30 + 45 * opts.warm; st.warm = opts.warm;
  b.key(); let caught = -1, rs = [];
  for (let k = 0; k < 60 * opts.sec; k++) {
    if (st.starter && (st.running || k > 60 * 3.5)) b.release();
    if (opts.fix) { st.headC = 30 + 45 * opts.warm; }
    b.step(1 / 60); if (caught < 0 && st.running) caught = k / 60;
    if (k > 60 * (opts.sec - 3)) rs.push(st.rpm);
    b.clearEvents();
  }
  const avg = rs.reduce((a, b) => a + b, 0) / rs.length, mn = Math.min(...rs), mx = Math.max(...rs);
  return `caught ${caught.toFixed(2)}s idle ${avg.toFixed(0)} (${mn.toFixed(0)}-${mx.toFixed(0)}) MAP ${(st.pMan / 1000).toFixed(0)}kPa λ ${st.lambdaEff.toFixed(2)} head ${st.headC.toFixed(0)}C fuel ${st.fuelLph.toFixed(2)}`;
}
console.log('warm idle      ', freeRun({ choke: false, warm: 1, sec: 8, fix: true }));
console.log('cold+choke     ', freeRun({ choke: true, warm: 0, sec: 6, fix: true }));
console.log('cold no choke  ', freeRun({ choke: false, warm: 0, sec: 6, fix: true }));
console.log('warm + choke   ', freeRun({ choke: true, warm: 1, sec: 8, fix: true }));
