import { createBench } from '../src/sim/bench.js';
const b = createBench(), st = b.state, dt = 1 / 60;
let t = 0; const log = (m) => console.log(t.toFixed(1).padStart(5), 's', m);
const run = (sec, each) => { for (let k = 0; k < sec / dt; k++) { if (st.starter && (st.running || k * dt > 3.5)) b.release(); b.step(dt); t += dt; each && each(); b.clearEvents(); } };
const s = () => `rpm ${st.rpm.toFixed(0)} gear ${st.gear} clutch ${st.clutchState} out ${(st.out * 30 / Math.PI).toFixed(0)} km/h ${st.speedKmh.toFixed(1)} dyno ${st.dynoTq.toFixed(1)}Nm ${(st.dynoPower / 745.7).toFixed(2)}hp head ${st.headC.toFixed(0)}C λ ${st.lambdaEff.toFixed(2)}`;
b.key(); run(2); log('start choke ' + s());
let warmT = -1; run(120, () => { if (warmT < 0 && st.headC > 60) warmT = t; }); log('after 2 min idle ' + s() + ' reached 60C at ' + warmT.toFixed(0) + 's');
b.setChoke(false); run(3); log('choke off ' + s());
b.shift(1); run(1); log('in 1st, idle ' + s());
b.setThrottle(1); b.setLoad(0.15);
for (let g = 1; g <= 4; g++) { run(4); log(`WOT gear ${st.gear} ` + s()); if (g < 4) b.shift(1); }
b.setLoad(1); run(5); log('4th full load ' + s());
b.setThrottle(0); run(4); log('closed throttle 4th full load (should not stall) ' + s() + ' running ' + st.running);
b.setLoad(0.3); b.setThrottle(1); b.setGear(1); run(6); log('1st WOT load 30% ' + s());
let lim = 0; b.setLoad(0); b.setGear(0); run(3, () => { if (st.limiter) lim++; }); log('neutral WOT ' + s() + ' limiter frames ' + lim);
b.setThrottle(0); run(4); log('back idle ' + s());
b.stop(); run(4); log('stopped ' + s());
// acak
const c = createBench(), cs = c.state; let bad = 0, maxR = 0; c.key();
for (let k = 0; k < 60 * 300; k++) {
  if (k % 70 === 0) { c.setThrottle(Math.random()); c.setLoad(Math.random()); if (Math.random() < 0.3) c.shift(Math.random() < 0.7 ? 1 : -1); if (Math.random() < 0.05) c.setChoke(!cs.choke); }
  if (!cs.fuel && Math.random() < 0.02) c.key();
  if (cs.starter && cs.running) c.release();
  if (Math.random() < 0.002) c.stop();
  c.step(Math.random() < 0.03 ? 0.05 : Math.random() < 0.1 ? 1 / 1200 : dt);
  for (const v of [cs.rpm, cs.p, cs.out, cs.drum, cs.headC, cs.pMan]) if (!Number.isFinite(v)) bad++;
  maxR = Math.max(maxR, cs.rpm); c.clearEvents();
}
console.log('random 5 min: NaN', bad, 'max rpm', maxR.toFixed(0), 'head', cs.headC.toFixed(0), 'out', cs.out.toFixed(1));
{ const d = createBench(), ds = d.state; d.setChoke(false); ds.headC = 160; d.key();
  for (let k = 0; k < 120; k++) { if (ds.running) d.release(); d.step(1/60); d.clearEvents(); }
  d.setThrottle(1); for (let k = 0; k < 180; k++) { d.step(1/60); d.clearEvents(); }
  d.setThrottle(0); const tr = []; for (let k = 0; k < 600; k++) { d.step(1/60); d.clearEvents(); if (k % 60 === 0) tr.push(ds.rpm.toFixed(0) + '/' + (ds.pMan/1000).toFixed(0) + '/' + ds.misfire); }
  console.log('hot decel trace', tr.join(' ')); }
