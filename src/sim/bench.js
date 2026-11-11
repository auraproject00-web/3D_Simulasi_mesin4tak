// Meja uji: mesin + kopling sentrifugal + transmisi 4 percepatan + dinamo arus eddy di poros output.
import {
  SPEC, PA, CYCLE, AREA, VD, VBDC, deg, clamp, volume, dPin, intakeLift, exhaustLift,
  advanceAt, veAt, carbLambda, manifoldEquilibrium, lambdaTorque, misfireChance, gauss, TIMING,
} from './engine.js';

export const GEARBOX = {
  primary: 69 / 17,                                // 4,059
  ratios: [0, 34 / 13, 28 / 18, 25 / 22, 22 / 24], // N, 1-4
  final: 37 / 14,                                  // 2,642
  wheelR: 0.288,                                   // ban 80/90-17
  efficiency: 0.92,
};
const I_DRUM = 0.0012;          // rumah kopling + gigi primer, dirujuk ke kruk as
const I_OUT = 0.32;             // rotor dinamo + poros output
const DYNO_MAX = 400;           // N·m di poros output (rem arus eddy)
const DYNO_WS = 300;            // rad/s, torsi naik sebanding putaran lalu jenuh
const SHIFT_TIME = 0.28;        // detik kopling manual terlepas saat memindah gigi

export function createBench() {
  const st = {
    phi: deg(400), omega: 0, rpm: 0,
    drum: 0, out: 0, locked: false, clutchTq: 0, clutchState: 'lepas',
    gear: 0, shiftT: 0, pendingGear: 0,
    throttle: 0, load: 0, choke: true, fuel: false, starter: false, running: false,
    pMan: PA, p: PA, pIvc: PA, burnQ: 0, xb: 0, peakP: 0, lastPeak: 0, misfire: false, limiter: false,
    lambda: 1, lambdaEff: 1, xr: 0.1, advance: 10, burnDur: 50,
    headC: SPEC.ambientC, warm: 0,
    dynoTq: 0, dynoPower: 0, crankTq: 0, fuelLph: 0, airKgs: 0,
    events: [], time: 0, pv: [], pvLast: [], cycleN: 0,
  };
  let fired = false, evoDone = false, ivcDone = false, evcDone = false, pendingAfterfire = false;

  const ratio = () => GEARBOX.primary * GEARBOX.ratios[st.gear];
  const connected = () => st.gear > 0 && st.shiftT <= 0;

  function pressure(phi) {
    const c = ((phi % CYCLE) + CYCLE) % CYCLE;
    const V = volume(c);
    const pex = PA * (1.03 + 0.000007 * st.rpm);
    if (c < Math.PI) {                                   // hisap
      const k = Math.min(1, c / deg(28));
      st.xb = 0;
      return pex + (st.pMan - pex) * k;
    }
    const ign = Math.PI * 2 - deg(st.advance), dur = deg(st.burnDur);
    let xb = 0;
    if (st.burnQ > 0 && c > ign) {
      const t = Math.min(1, (c - ign) / dur);
      xb = 1 - Math.exp(-5 * Math.pow(t, 3));
    }
    st.xb = xb;
    const decomp = st.rpm < 300 ? 0.72 : 0;                // dekompresor otomatis saat starter
    let poly = st.pIvc * Math.pow(VBDC / V, 1.32) * (1 + st.burnQ * xb);
    poly = PA + (poly - PA) * (1 - decomp);
    const evo = deg(TIMING.evo);
    if (c < evo) return poly;
    if (c < 3 * Math.PI) { const t = (c - evo) / (3 * Math.PI - evo); return pex + (poly - pex) * Math.pow(1 - t, 2.2); }
    return pex;
  }

  function lockCharge(rpm) {
    st.pIvc = st.pMan * veAt(rpm) / 0.95;
    const pex = PA * (1.03 + 0.000007 * rpm);
    st.xr = clamp((1 / SPEC.cr) * Math.pow(pex / Math.max(st.pIvc, 5000), 1 / 1.3) * 0.36, 0.02, 0.4);
    st.lambda = carbLambda(st.throttle, rpm) * (st.choke ? 0.62 : 1);
    st.lambdaEff = st.lambda * (1 + 0.36 * (1 - st.warm));      // bensin mengembun di dinding dingin
    const air = st.pIvc * VBDC * 0.95 * (1 - st.xr) / (287 * 320);
    const can = st.fuel && rpm > 150;
    st.limiter = st.fuel && rpm >= SPEC.limiter;
    const sigma = 0.018 + 0.3 * Math.max(0, st.xr - 0.04) + 0.05 * (1 - st.warm) * (st.choke ? 0 : 1);
    const miss = Math.random() < misfireChance(st.lambdaEff) || (rpm < 400 && Math.random() < 0.15);
    st.misfire = can && (miss || st.limiter);
    const dil = 1 - 1.5 * Math.max(0, st.xr - 0.04);
    st.burnQ = can && !st.misfire ? 3.86 * lambdaTorque(st.lambdaEff) * dil * Math.max(0.6, 1 + sigma * gauss()) : 0;
    st.burnDur = 40 + 0.0032 * rpm + 140 * st.xr + 30 * Math.max(0, st.lambdaEff - 1.05);
    const fuelKg = can && !st.limiter ? air / (14.7 * st.lambda) : 0;
    st.airKgs = air * rpm / 120;
    st.fuelLph = fuelKg * (rpm / 120) * 3600 / 0.74;
    if (st.misfire && st.fuel && !st.limiter) pendingAfterfire = true;
    return fuelKg;
  }

  let heatIn = 0, slipAcc = 0, spinAcc = 0;
  function micro(h) {
    st.time += h;
    const c0 = ((st.phi % CYCLE) + CYCLE) % CYCLE;
    const rpm = st.omega * 30 / Math.PI;
    st.rpm = rpm;
    st.advance = advanceAt(rpm);
    const p = pressure(st.phi);
    st.p = p;
    if (p > st.peakP) st.peakP = p;

    const cold = 1 - st.warm;
    const T_gas = (p - PA) * AREA * -dPin(st.phi);
    const T_fric = Math.sign(st.omega) * (0.55 + 0.000155 * rpm + 1.25e-8 * rpm * rpm) * (1 + 0.45 * cold);
    const T_start = st.starter ? Math.max(0, 6.8 * (1 - rpm / 720)) : 0;
    const T_eng = T_gas + T_start - T_fric;

    // kopling sentrifugal: gaya sepatu ∝ ω², melawan pegas yang menahan sampai ±1.800 rpm
    const cap = Math.min(220, 3.2e-6 * Math.max(0, rpm * rpm - 1800 * 1800));
    const conn = connected();
    const R = conn ? ratio() : 1;
    const wOutEq = conn ? st.out : 0;
    const dynoT = st.load * DYNO_MAX * (st.out / DYNO_WS) / (1 + st.out / DYNO_WS);   // di poros output
    st.dynoTq = dynoT;
    const drumLoad = conn ? (dynoT / R) / GEARBOX.efficiency + 0.08 : 0.04;  // dirujuk ke kruk as
    const Id = I_DRUM + (conn ? I_OUT / (R * R) : 0);
    let Tc;
    if (st.locked) {
      const a = (T_eng - drumLoad) / (SPEC.inertia + Id);
      Tc = T_eng - SPEC.inertia * a;
      if (Math.abs(Tc) > cap || cap <= 0) st.locked = false;
    }
    if (st.locked) {
      const a = (T_eng - drumLoad) / (SPEC.inertia + Id);
      st.omega += a * h; st.drum = st.omega;
    } else {
      const slip = st.omega - st.drum;
      Tc = cap * Math.sign(slip);
      const wE = st.omega + ((T_eng - Tc) / SPEC.inertia) * h;
      let wD = st.drum + ((Tc - drumLoad * Math.sign(st.drum || 1)) / Id) * h;
      if (wD < 0) wD = 0;
      if (cap > 0 && Math.sign(wE - wD) !== Math.sign(slip) && slip !== 0) {
        const w = (SPEC.inertia * wE + Id * wD) / (SPEC.inertia + Id);
        st.omega = w; st.drum = w; st.locked = true;
      } else { st.omega = wE; st.drum = wD; }
    }
    st.clutchTq = Tc || 0;
    if (st.omega < 0) st.omega = 0;                       // tidak berputar mundur
    if (conn) st.out = st.drum / R;
    else st.out = Math.max(0, st.out - ((dynoT + 0.8 + 0.03 * st.out) / I_OUT) * h);

    st.phi += st.omega * h;
    st.crankTq = T_eng;
    heatIn += Math.max(0, T_fric * st.omega) * h * 0.5;
    slipAcc += Math.abs(st.omega - st.drum) * h; spinAcc += Math.abs(st.omega) * h;
    const c1 = ((st.phi % CYCLE) + CYCLE) % CYCLE;
    if (st.pv.length < 1600) st.pv.push(volume(c1) / VD, p / 1e5);

    const crossed = (a) => c0 < a && c1 >= a && c1 - c0 < Math.PI;
    if (crossed(Math.PI)) {
      const fuelKg = lockCharge(rpm);
      heatIn += fuelKg * 44e6 * (st.burnQ > 0 ? 0.24 : 0.04);
      fired = false; evoDone = false; ivcDone = false; evcDone = false;
    }
    if (!ivcDone && crossed(deg(TIMING.ivc))) { ivcDone = true; st.events.push({ type: 'valve', which: 'in', t: st.time }); }
    const ign = Math.PI * 2 - deg(st.advance);
    if (!fired && crossed(ign)) {
      fired = true;
      if (st.fuel && rpm > 150) st.events.push({ type: 'spark', t: st.time, lit: st.burnQ > 0 });
    }
    if (!evoDone && crossed(deg(TIMING.evo))) {
      evoDone = true;
      st.events.push({ type: 'exhaust', t: st.time, k: st.burnQ > 0 ? st.peakP / 4e6 : 0.04, lit: st.burnQ > 0, rich: st.lambdaEff < 0.75 });
      if (pendingAfterfire && st.burnQ > 0 && st.headC > 70 && Math.random() < 0.5) st.events.push({ type: 'afterfire', t: st.time + 0.004 });
      if (st.burnQ > 0) pendingAfterfire = false;
    }
    if (!evcDone && c1 > deg(10) && c1 < deg(40) && c0 < deg(10)) { evcDone = true; st.events.push({ type: 'valve', which: 'ex', t: st.time }); }
    if (c1 < c0 && st.omega > 0) {
      st.lastPeak = st.peakP; st.peakP = 0;
      st.pvLast = st.pv; st.pv = [];
      st.cycleN++;
      st.events.push({ type: 'cycle', t: st.time });
      if (st.burnQ > 0 && !st.running && rpm > 550) { st.running = true; st.events.push({ type: 'caught', t: st.time }); }
    }
    if (st.running && rpm < 180) st.running = false;
  }

  function step(dt) {
    if (st.shiftT > 0) {
      st.shiftT -= dt;
      if (st.shiftT <= 0) engageGear();
    }
    // tekanan intake mengejar titik setimbang dengan konstanta waktu ± 25 ms
    const target = manifoldEquilibrium(st.throttle, st.rpm, st.choke);
    st.pMan += (target - st.pMan) * (1 - Math.exp(-dt / 0.025));
    const sub = Math.max(1, Math.min(700, Math.ceil(Math.abs(st.omega) * dt / deg(1.5))));
    const h = dt / sub;
    heatIn = 0; slipAcc = 0; spinAcc = 0;
    for (let i = 0; i < sub; i++) micro(h);
    st.rpm = st.omega * 30 / Math.PI;
    // suhu kepala silinder, dengan kipas meja uji
    const dT = st.headC - SPEC.ambientC;
    const cool = 1.6 * dT + 0.16 * dT * dT;
    st.headC += ((heatIn / Math.max(dt, 1e-6) - cool) / 1800) * SPEC.heatSpeedup * dt;
    st.warm = clamp((st.headC - SPEC.ambientC) / 45, 0, 1);
    const R = connected() ? ratio() : 0;
    st.dynoPower = st.dynoTq * st.out;
    st.locked = st.locked && st.rpm > 1;
    const slipRatio = spinAcc > 0 ? slipAcc / spinAcc : 0;
    const cap = Math.min(220, 3.2e-6 * Math.max(0, st.rpm * st.rpm - 1800 * 1800));
    st.clutchState = cap <= 0 ? 'lepas' : slipRatio < 0.03 ? 'menyatu' : 'selip';
    st.speedKmh = st.out / GEARBOX.final * GEARBOX.wheelR * 3.6;
    st.ratioTotal = R;
  }

  function engageGear() {
    st.gear = st.pendingGear; st.shiftT = 0;
    if (st.gear > 0) {
      const R = ratio(), Iref = I_OUT / (R * R);
      // kopling manual menyatu: momentum rumah kopling dan poros output digabung
      const w = (I_DRUM * st.drum + Iref * st.out * R) / (I_DRUM + Iref);
      st.drum = w; st.out = w / R;
      if (st.locked) { const wl = (SPEC.inertia * st.omega + (I_DRUM + Iref) * w) / (SPEC.inertia + I_DRUM + Iref); st.omega = wl; st.drum = wl; st.out = wl / R; }
    }
  }

  return {
    state: st, step,
    clearEvents() { st.events.length = 0; },
    key() { st.fuel = true; st.starter = true; },
    release() { st.starter = false; },
    stop() { st.fuel = false; st.starter = false; st.running = false; st.fuelLph = 0; st.burnQ = 0; },
    setThrottle(v) { st.throttle = clamp(v, 0, 1); },
    setLoad(v) { st.load = clamp(v, 0, 1); },
    setChoke(v) { st.choke = !!v; },
    // gigi rotari: N-1-2-3-4-N
    shift(dir) {
      const from = st.shiftT > 0 ? st.pendingGear : st.gear;
      const to = (from + (dir > 0 ? 1 : 4)) % 5;
      st.pendingGear = to; st.shiftT = SHIFT_TIME;
      st.events.push({ type: 'shift', t: st.time, to });
      return to;
    },
    setGear(g) { st.pendingGear = clamp(Math.round(g), 0, 4); st.shiftT = SHIFT_TIME; st.events.push({ type: 'shift', t: st.time, to: st.pendingGear }); },
    shiftingTo() { return st.shiftT > 0 ? st.pendingGear : st.gear; },
    pressureAt: pressure,
    // untuk kalibrasi: tahan putaran kruk as tetap dan ukur torsi rata-rata
    holdSpeed(rpm, seconds, opts = {}) {
      st.fuel = true; st.running = true; st.starter = false;
      if (opts.warm !== undefined) { st.headC = SPEC.ambientC + 45 * opts.warm; st.warm = opts.warm; }
      const w = rpm * Math.PI / 30, dt = 1 / 240;
      let sum = 0, n = 0;
      for (let t = 0; t < seconds; t += dt) {
        st.pMan = manifoldEquilibrium(st.throttle, rpm, st.choke);
        const sub = Math.ceil(w * dt / deg(1));
        for (let i = 0; i < sub; i++) {
          st.omega = w; st.drum = 0; st.locked = false; st.gear = 0;
          const keep = st.load; st.load = 0;
          micro(dt / sub);
          st.load = keep;
          if (t > seconds * 0.25) { sum += st.crankTq; n++; }
        }
        st.events.length = 0;
        if (opts.fixHeat) { st.headC = SPEC.ambientC + 45 * (opts.warm ?? 1); st.warm = opts.warm ?? 1; }
      }
      return sum / n;
    },
  };
}
