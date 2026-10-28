import { createSim } from '../src/sim.js';
const sim = createSim(), st = sim.state, dt = 1 / 60;
const run = (sec, f) => { for (let k = 0; k < sec * 60; k++) { sim.step(dt); f && f(k); sim.clearEvents(); } };
sim.key();
let caught = -1;
for (let k = 0; k < 60 * 4; k++) { sim.step(dt); if (st.running && caught < 0) { caught = k / 60; sim.release(); } sim.clearEvents(); if (k % 15 == 0) process.stdout.write(st.rpm.toFixed(0) + ' '); }
console.log('\ncaught', caught);
sim.release();
run(5); console.log('idle rpm', st.rpm.toFixed(0), 'peak bar', (st.lastPeak / 1e5).toFixed(1));
sim.setThrottle(1); run(4); console.log('wot free rpm', st.rpm.toFixed(0));
for (const target of [3000, 4500, 5500, 6500, 7500, 8500]) {
  // cari beban yang menahan target rpm
  let lo = 0, hi = 1;
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; sim.setLoad(m); run(3); if (st.rpm > target) lo = m; else hi = m; }
  let s = 0, n = 0; run(2, () => { s += st.brakeTorque * st.omega; n++; });
  console.log(target, 'rpm', st.rpm.toFixed(0), 'tq', st.brakeTorque.toFixed(2), 'hp', (s / n / 745.7).toFixed(2), 'peak', (st.lastPeak / 1e5).toFixed(0), 'fuel', st.fuelLph.toFixed(2));
}
sim.setLoad(0); sim.setThrottle(0); run(3); console.log('back idle', st.rpm.toFixed(0));
sim.stop(); run(4); console.log('stopped', st.rpm.toFixed(1));
