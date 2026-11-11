// Mesin bebek 1 silinder 4-tak, 109,1 cc. Geometri, bukaan klep, dan model termodinamika per derajat engkol.
// Angka yang dipublikasikan untuk mesin kelas ini: 50 × 55,6 mm, kompresi 9,0 : 1,
// 6,22 kW @ 7.500 rpm, 8,59 N·m @ 5.500 rpm. Semua yang lain di sini dimodelkan.

export const SPEC = {
  bore: 0.050, stroke: 0.0556, rod: 0.0905, cr: 9.0,
  inertia: 0.0074,          // kruk as + rotor magnet, kg·m²
  limiter: 9600,            // CDI memotong pengapian
  ambientC: 30,
  heatSpeedup: 6,           // pemanasan mesin dipercepat agar terlihat di layar
};

export const PA = 101325;
const R_AIR = 287, GAM = 1.4;
const TAU = Math.PI * 2;
export const CYCLE = Math.PI * 4;
const r = SPEC.stroke / 2, L = SPEC.rod;
export const AREA = Math.PI * SPEC.bore ** 2 / 4;
export const VD = AREA * SPEC.stroke;
export const VC = VD / (SPEC.cr - 1);
export const deg = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// tinggi pena seher dari sumbu kruk as (m), θ = 0 di TMA
export function pinHeight(th) { const s = Math.sin(th); return r * Math.cos(th) + Math.sqrt(L * L - r * r * s * s); }
export function dPin(th) { const s = Math.sin(th), c = Math.cos(th); return -r * s - (r * r * s * c) / Math.sqrt(L * L - r * r * s * s); }
export function volume(th) { return VC + AREA * (r + L - pinHeight(th)); }
export const VBDC = volume(Math.PI);

export const TIMING = { ivo: -10, ivc: 220, evo: 500, evc: 730 }; // derajat siklus, 0 = TMA awal hisap
function camLift(phi, open, close, max) {
  let a = ((phi * 180) / Math.PI) % 720; if (a < 0) a += 720;
  let o = open, c = close;
  if (o < 0) { o += 720; }
  if (c < o) c += 720;
  if (a < o) a += 720;
  if (a > c) return 0;
  const t = (a - o) / (c - o), s = Math.sin(Math.PI * t);
  return max * s * s;
}
export const intakeLift = (phi) => camLift(phi, TIMING.ivo, TIMING.ivc, 0.0062);
export const exhaustLift = (phi) => camLift(phi, TIMING.evo, TIMING.evc, 0.0058);
export const STROKES = ['hisap', 'kompresi', 'usaha', 'buang'];
export function strokeIndex(phi) { return Math.floor((((phi % CYCLE) + CYCLE) % CYCLE) / Math.PI); }

// pengapian CDI: maju dari 10° di stasioner sampai 32° di atas 4.500 rpm
export function advanceAt(rpm) { return 10 + 22 * clamp((rpm - 1900) / 2600, 0, 1); }

// efisiensi volumetrik (karbu skep 20 mm, porting standar)
export function veAt(rpm) {
  const n = rpm / 1000;
  return 0.66 + 0.25 * Math.exp(-(((n - 6.7) / 4.0) ** 2)) - 0.014 * Math.max(0, n - 9) ** 2;
}

// karburator: lambda dasar dari jet stasioner, jarum, dan jet utama
export function carbLambda(thr, rpm) {
  const base = 0.96 + 0.07 * Math.exp(-(((thr - 0.32) / 0.2) ** 2));   // part-throttle sedikit irit
  const power = 0.1 * clamp((thr - 0.65) / 0.3, 0, 1);                 // pengayaan di bukaan besar
  return base - power - 0.015 * clamp((rpm - 7000) / 2000, 0, 1);
}

// aliran kompresibel melewati skep
const A_MAX = Math.PI * 0.01 ** 2, A_IDLE = 1.6e-6, CD = 0.72;
export function throttleArea(thr) { return A_IDLE + (A_MAX - A_IDLE) * Math.pow(clamp(thr, 0, 1), 2.0); }
function orificeFlow(area, p0, T0, p) {
  const pr = Math.max(p / p0, 0.5283);
  const psi = Math.sqrt((2 * GAM / (GAM - 1)) * (Math.pow(pr, 2 / GAM) - Math.pow(pr, (GAM + 1) / GAM)));
  return CD * area * p0 / Math.sqrt(R_AIR * T0) * psi;
}
// tekanan intake setimbang: aliran skep = aliran yang dihisap silinder
export function manifoldEquilibrium(thr, rpm, chokeOn) {
  if (rpm < 20) return PA;
  const area = throttleArea(thr) * (chokeOn ? 0.8 : 1);
  const draw = (p) => veAt(rpm) * VD * (rpm / 120) * p / (R_AIR * 300);
  let lo = 0.02 * PA, hi = PA;
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2;
    if (orificeFlow(area, PA, 300, m) > draw(m)) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// faktor torsi terhadap campuran: puncak di λ ≈ 0,88
export function lambdaTorque(l) { return clamp(1 - 2.2 * (l - 0.88) ** 2, 0.15, 1); }
export function misfireChance(l) { return clamp((l - 1.2) / 0.28, 0, 1) + clamp((0.6 - l) / 0.14, 0, 1); }

export function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
