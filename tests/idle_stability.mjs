import { createBench } from '../src/sim/bench.js';
// berapa sering mesin mati sendiri saat stasioner (tanpa campur tangan), dingin+choke dan hangat
function trial(choke, headC, sec, dt) {
  const b = createBench(), st = b.state; b.setChoke(choke); st.headC = headC; b.key();
  for (let t = 0; t < sec; t += dt) {
    if (st.starter && (st.running || t > 3.5)) b.release();
    b.step(dt); b.clearEvents();
    if (t > 4 && !st.running && st.rpm < 60) return t;
  }
  return -1;
}
for (const [label, choke, head] of [['dingin+choke', true, 30], ['hangat', false, 90], ['hangat+choke', true, 90]]) {
  let stalls = 0, n = 20, when = [];
  for (let i = 0; i < n; i++) { const r = trial(choke, head, 60, 1 / 60); if (r >= 0) { stalls++; when.push(r.toFixed(0)); } }
  console.log(label, `mati ${stalls}/${n}`, when.join(','));
}
