// Takometer, roda siklus 720°, dan diagram P–V, digambar di canvas 2D dengan warna dari token tema.
import { SPEC, VD, CYCLE, clamp, TIMING } from '../sim/engine.js';

const MONO = '500 10px "Martian Mono", ui-monospace, monospace';
function fit(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [x, w, h];
}

export function drawTach(cv, T, rpm, st) {
  const [x, w, h] = fit(cv); x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.5, R = Math.min(w * 0.42, h * 0.46);
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, max = 10000, ang = (v) => a0 + (v / max) * sweep;
  x.lineCap = 'butt';
  x.lineWidth = 6; x.strokeStyle = T.line; x.beginPath(); x.arc(cx, cy, R, a0, a0 + sweep); x.stroke();
  x.strokeStyle = T.hot; x.beginPath(); x.arc(cx, cy, R, ang(SPEC.limiter - 100), ang(max)); x.stroke();
  x.strokeStyle = T.accent; x.beginPath(); x.arc(cx, cy, R, a0, ang(clamp(rpm, 0, max))); x.stroke();
  x.font = MONO; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let v = 0; v <= max; v += 500) {
    const a = ang(v), major = v % 1000 === 0;
    x.strokeStyle = v >= 9500 ? T.hot : T.ink; x.lineWidth = major ? 1.6 : 1;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); x.lineTo(cx + Math.cos(a) * (R - (major ? 16 : 12)), cy + Math.sin(a) * (R - (major ? 16 : 12))); x.stroke();
    if (major) { x.fillStyle = T.muted; x.fillText(String(v / 1000), cx + Math.cos(a) * (R - 25), cy + Math.sin(a) * (R - 25)); }
  }
  const a = ang(clamp(rpm, 0, max * 1.02));
  x.strokeStyle = T.hot; x.lineWidth = 2.2;
  x.beginPath(); x.moveTo(cx - Math.cos(a) * 8, cy - Math.sin(a) * 8); x.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); x.stroke();
  x.fillStyle = T.ink; x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.fill();
  x.fillStyle = T.muted; x.fillText('×1000', cx, cy + R * 0.5); x.fillText('rpm', cx, cy + R * 0.5 + 12);
  // indikator gigi di tengah atas
  x.font = '800 18px "Big Shoulders Display", "Arial Narrow", sans-serif'; x.fillStyle = st.gear === 0 ? '#2fa35a' : T.ink;
  x.fillText(st.shiftT > 0 ? '·' : st.gear === 0 ? 'N' : String(st.gear), cx, cy - R * 0.42);
}

export function drawCycle(cv, T, st) {
  const [x, w, h] = fit(cv); x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
  const toA = (deg) => -Math.PI / 2 + (deg / 720) * Math.PI * 2;
  const names = ['HISAP', 'KOMPRESI', 'USAHA', 'BUANG'], letters = ['H', 'K', 'U', 'B'];
  const colors = [T.intake, T.accent, T.hot, T.exhaust];
  const c = ((st.phi % CYCLE) + CYCLE) % CYCLE, deg = (c * 180) / Math.PI, cur = Math.floor(c / Math.PI);
  x.lineCap = 'butt';
  for (let i = 0; i < 4; i++) {
    x.lineWidth = i === cur ? 10 : 6; x.strokeStyle = i === cur ? colors[i] : T.line;
    x.beginPath(); x.arc(cx, cy, R, toA(i * 180) + 0.04, toA((i + 1) * 180) - 0.04); x.stroke();
    const mid = toA(i * 180 + 90);
    x.font = (i === cur ? '600 ' : '500 ') + '10px "Martian Mono", ui-monospace, monospace';
    x.fillStyle = i === cur ? T.ink : T.muted; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letters[i], cx + Math.cos(mid) * (R + 15), cy + Math.sin(mid) * (R + 15));
  }
  x.lineWidth = 2.5;
  x.strokeStyle = T.intake; x.beginPath(); x.arc(cx, cy, R - 10, toA(TIMING.ivo), toA(TIMING.ivc)); x.stroke();
  x.strokeStyle = T.exhaust; x.beginPath(); x.arc(cx, cy, R - 15, toA(TIMING.evo), toA(TIMING.evc)); x.stroke();
  const ig = toA(360 - st.advance);
  x.fillStyle = T.hot; x.beginPath(); x.arc(cx + Math.cos(ig) * (R + 9), cy + Math.sin(ig) * (R + 9), 2.6, 0, Math.PI * 2); x.fill();
  const a = toA(deg), px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
  x.fillStyle = T.panel; x.strokeStyle = T.ink; x.lineWidth = 2;
  x.beginPath(); x.arc(px, py, 5.5, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = T.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = '800 ' + Math.max(11, Math.min(16, R * 0.27)) + 'px "Big Shoulders Display", "Arial Narrow", sans-serif';
  x.fillText(names[cur], cx, cy + 2);
  x.font = '500 9.5px "Martian Mono", ui-monospace, monospace'; x.fillStyle = T.muted; x.textBaseline = 'top';
  x.fillText(Math.floor(deg) + '°', cx, cy + 6);
}

export function drawPV(cv, T, st) {
  const [x, w, h] = fit(cv); x.clearRect(0, 0, w, h);
  const ml = 34, mr = 10, mt = 10, mb = 24, pw = w - ml - mr, ph = h - mt - mb;
  const vx = (v) => ml + (v / 1.15) * pw;
  const lp0 = Math.log(0.1), lp1 = Math.log(80);
  const py = (p) => mt + ph - ((Math.log(clamp(p, 0.1, 80)) - lp0) / (lp1 - lp0)) * ph;
  x.font = MONO; x.fillStyle = T.muted; x.textAlign = 'right'; x.textBaseline = 'middle'; x.lineWidth = 1;
  for (const p of [0.2, 0.5, 1, 2, 5, 10, 20, 50]) {
    x.strokeStyle = T.line; x.beginPath(); x.moveTo(ml, py(p)); x.lineTo(ml + pw, py(p)); x.stroke();
    x.fillText(String(p).replace('.', ','), ml - 5, py(p));
  }
  x.textAlign = 'center'; x.textBaseline = 'top';
  x.fillText('TMA', vx(1 / (SPEC.cr - 1)), mt + ph + 6);
  x.fillText('TMB', vx(SPEC.cr / (SPEC.cr - 1)), mt + ph + 6);
  x.save(); x.translate(10, mt + ph / 2); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.fillText('bar', 0, 0); x.restore();
  const draw = (arr, color, width) => {
    if (arr.length < 4) return;
    x.strokeStyle = color; x.lineWidth = width; x.beginPath();
    for (let i = 0; i < arr.length; i += 2) { const X = vx(arr[i]), Y = py(arr[i + 1]); i === 0 ? x.moveTo(X, Y) : x.lineTo(X, Y); }
    x.stroke();
  };
  draw(st.pvLast, T.hot, 1.6); draw(st.pv, T.accent, 1.4);
  if (st.pv.length >= 2) { const i = st.pv.length - 2; x.fillStyle = T.ink; x.beginPath(); x.arc(vx(st.pv[i]), py(st.pv[i + 1]), 3.2, 0, Math.PI * 2); x.fill(); }
}
