// Simulasi mesin 1 silinder 4-tak (109 cc). Model per derajat engkol.
export const SPEC = {
  bore: 0.050, stroke: 0.0556, rod: 0.090, cr: 9.3,
  inertia: 0.009, idle: 0.0085, limiter: 9500,
};
const PA = 101325;
const r = SPEC.stroke / 2, L = SPEC.rod;
export const AREA = Math.PI * SPEC.bore ** 2 / 4;
export const VD = AREA * SPEC.stroke;
export const VC = VD / (SPEC.cr - 1);
const TAU = Math.PI * 2, CYC = Math.PI * 4;

export function pinHeight(th) { const s = Math.sin(th); return r * Math.cos(th) + Math.sqrt(L * L - r * r * s * s); }
export function dPin(th) { const s = Math.sin(th), c = Math.cos(th); return -r * s - (r * r * s * c) / Math.sqrt(L * L - r * r * s * s); }
export function volume(th) { return VC + AREA * (r + L - pinHeight(th)); }
const VBDC = volume(Math.PI);

// angkat klep (m) berdasarkan sudut siklus 0..4π (0 = TMA awal hisap)
const deg = (d) => (d * Math.PI) / 180;
function camLift(phi, open, close, max) {
  // open/close dalam derajat siklus, boleh melingkar
  let a = (phi * 180) / Math.PI; let o = open, c = close;
  if (c < o) c += 720;
  if (a < o) a += 720;
  if (a > c) return 0;
  const t = (a - o) / (c - o);
  const s = Math.sin(Math.PI * t);
  return max * s * s;
}
export const intakeLift = (phi) => camLift(phi, 710, 225, 0.0062);   // IVO 10° sblm TMA, IVC 45° stl TMB
export const exhaustLift = (phi) => camLift(phi, 495, 15, 0.0058);   // EVO 45° sblm TMB, EVC 15° stl TMA

export function strokeName(phi) {
  const q = Math.floor(((phi % CYC) + CYC) % CYC / Math.PI);
  return ['hisap', 'kompresi', 'usaha', 'buang'][q];
}

export function createSim() {
  const st = {
    phi: deg(400), omega: 0, rpm: 0,
    throttle: 0, load: 0, fuel: false, starter: false, running: false,
    p: PA, pIvc: PA, burnQ: 0, xb: 0, peakP: 0, lastPeak: 0,
    torqueAvg: 0, brakeTorque: 0, powerKw: 0, indicatedTorque: 0,
    events: [], time: 0, cycleTq: 0, cycleN: 0, brakeTemp: 25, fuelLph: 0,
    advance: 10, misfire: false, pv: [], pvLast: [],
  };
  let fired = false, evoDone = false;

  function manifold(rpm, thr) {
    const a = SPEC.idle + (1 - SPEC.idle) * Math.pow(thr, 1.6);
    return PA * a / (a + 0.02 * Math.max(rpm, 120) / 1000);
  }
  function ve(rpm) { const n = rpm / 1000; return 0.80 + 0.14 * Math.exp(-(((n - 5.8) / 3.2) ** 2)); }

  function pressure(phi) {
    const c = ((phi % CYC) + CYC) % CYC;
    const V = volume(c);
    const pman = manifold(st.rpm, st.throttle);
    const pex = PA * (1.04 + 0.000006 * st.rpm);
    if (c < Math.PI) { // hisap
      const k = Math.min(1, c / deg(25));
      return pex + (pman - pex) * k;
    }
    const ign = TAU - deg(st.advance), dur = deg(42 + 0.0035 * st.rpm);
    let xb = 0;
    if (st.burnQ > 0 && c > ign) {
      const t = Math.min(1, (c - ign) / dur);
      xb = 1 - Math.exp(-5 * Math.pow(t, 3));
    }
    st.xb = xb;
    const decomp = st.rpm < 280 ? 0.75 : 0;
    let poly = st.pIvc * Math.pow(VBDC / V, 1.32) * (1 + st.burnQ * xb);
    poly = PA + (poly - PA) * (1 - decomp);
    const evo = deg(495);
    if (c < evo) return poly;
    if (c < 3 * Math.PI) { // blowdown
      const t = (c - evo) / (3 * Math.PI - evo);
      return pex + (poly - pex) * Math.pow(1 - t, 2.2);
    }
    return pex; // buang
  }

  function step(dt) {
    const sub = Math.max(1, Math.min(600, Math.ceil(Math.abs(st.omega) * dt / deg(1.5))));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) micro(h);
    st.rpm = st.omega * 30 / Math.PI;
    // suhu cakram rem dinamo
    const heat = st.brakeTorque * st.omega; // W
    st.brakeTemp += (heat * 0.012 - (st.brakeTemp - 25) * 0.08) * dt;
  }

  function micro(h) {
    st.time += h;
    const before = st.phi;
    const c0 = ((before % CYC) + CYC) % CYC;
    const rpm = st.omega * 30 / Math.PI;
    st.rpm = rpm;
    st.advance = 10 + Math.min(22, Math.max(0, (rpm - 1500) * 0.005));
    const p = pressure(before);
    st.p = p;
    if (p > st.peakP) st.peakP = p;
    const T_gas = (p - PA) * AREA * -dPin(before);
    const T_fric = Math.sign(st.omega) * (0.55 + 0.00016 * rpm + 1.3e-8 * rpm * rpm);
    const T_start = st.starter ? Math.max(0, 7.5 * (1 - rpm / 650)) : 0;
    const T_brake = st.load * 9.5 * (1 - Math.exp(-rpm / 600));
    st.brakeTorque = T_brake;
    let net = T_gas + T_start - T_fric - T_brake;
    if (Math.abs(st.omega) < 0.5 && Math.abs(T_gas + T_start - T_brake) < 0.5) { st.omega = 0; net = 0; }
    st.omega += (net / SPEC.inertia) * h;
    if (st.omega < 0 && !st.starter) st.omega = 0; // tidak berputar mundur saat berhenti
    st.phi += st.omega * h;
    st.cycleTq += T_gas * h; st.cycleN += h;
    const c1 = ((st.phi % CYC) + CYC) % CYC;
    if (st.pv.length < 1400) st.pv.push(volume(c1) / VD, p / 1e5);

    const crossed = (a) => c0 < a && c1 >= a && c1 - c0 < Math.PI;
    // TMB hisap: kunci tekanan muatan
    if (crossed(Math.PI)) {
      st.pIvc = manifold(rpm, st.throttle) * ve(rpm) / 0.95;
      const charge = st.pIvc / PA;
      const can = st.fuel && rpm > 200 && rpm < SPEC.limiter;
      st.misfire = st.fuel && rpm >= SPEC.limiter;
      st.burnQ = can ? 4.3 * Math.min(1, 0.45 + 0.6 * charge) : 0;
      fired = false; evoDone = false;
      // bahan bakar l/jam: massa udara/14.7
      const air = charge * PA * VD * 0.95 / (287 * 300);
      st.fuelLph = can ? (air / 14.0) * (rpm / 120) * 3600 / 0.74 : 0;
    }
    const ign = TAU - deg(st.advance);
    if (!fired && crossed(ign)) {
      fired = true;
      if (st.burnQ > 0) st.events.push({ type: 'spark', t: st.time, k: st.pIvc / PA });
    }
    if (!evoDone && crossed(deg(495))) {
      evoDone = true;
      st.events.push({ type: 'exhaust', t: st.time, k: st.burnQ > 0 ? st.peakP / 4e6 : 0.05, lit: st.burnQ > 0 });
    }
    if (c1 < c0 && st.omega > 0) { // siklus selesai
      st.lastPeak = st.peakP; st.peakP = 0;
      st.indicatedTorque = st.cycleN > 0 ? st.cycleTq / st.cycleN : 0;
      st.cycleTq = 0; st.cycleN = 0;
      st.pvLast = st.pv; st.pv = [];
      st.events.push({ type: 'cycle', t: st.time });
      if (st.burnQ > 0 && !st.running && rpm > 500) { st.running = true; st.events.push({ type: 'caught', t: st.time }); }
    }
    if (st.running && rpm < 150) st.running = false;
  }

  return {
    state: st, step,
    clearEvents() { st.events.length = 0; },
    key() { st.fuel = true; st.starter = true; },
    release() { st.starter = false; },
    stop() { st.fuel = false; st.starter = false; st.running = false; st.fuelLph = 0; st.burnQ = 0; },
    setThrottle(v) { st.throttle = Math.max(0, Math.min(1, v)); },
    setLoad(v) { st.load = Math.max(0, Math.min(1, v)); },
    pressureAt: pressure,
  };
}
