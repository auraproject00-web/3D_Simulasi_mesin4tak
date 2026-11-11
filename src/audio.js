// Suara disintesis Web Audio. Dentuman knalpot dijadwalkan dari saat klep buang membuka di simulasi,
// lalu dilewatkan ke resonator pipa knalpot dan peredam. Ketukan klep, starter, kipas, dan dengung dinamo ikut.
import { clamp } from './sim/engine.js';

export function createAudio() {
  const A = { ctx: null, on: false };
  function init() {
    if (A.ctx) return true;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return false;
    const ctx = new C();
    const sr = ctx.sampleRate;
    const noise = ctx.createBuffer(1, sr * 2, sr);
    const d = noise.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 4; }
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
    master.connect(comp).connect(ctx.destination);
    // resonator pipa: umpan balik tertunda ≈ 2L/c
    const pipeIn = ctx.createGain();
    const pipeDelay = ctx.createDelay(0.05); pipeDelay.delayTime.value = 0.0052;
    const pipeFb = ctx.createGain(); pipeFb.gain.value = 0.5;
    const pipeLp = ctx.createBiquadFilter(); pipeLp.type = 'lowpass'; pipeLp.frequency.value = 2600;
    pipeIn.connect(pipeDelay); pipeDelay.connect(pipeLp).connect(pipeFb).connect(pipeDelay);
    const muffler = ctx.createBiquadFilter(); muffler.type = 'lowpass'; muffler.frequency.value = 1700; muffler.Q.value = 0.8;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 115; body.gain.value = 7; body.Q.value = 1.2;
    pipeIn.connect(muffler); pipeLp.connect(muffler);
    muffler.connect(body).connect(master);
    const loop = (type, f, q, g, dest = master) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gn = ctx.createGain(); gn.gain.value = g;
      src.connect(fl).connect(gn).connect(dest); src.start(); return { fl, gn };
    };
    const intake = loop('bandpass', 700, 1.6, 0);
    const mech = loop('bandpass', 4200, 0.9, 0);
    const fan = loop('lowpass', 900, 0.5, 0.012);
    const osc = (type, f, g) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return { o, gn }; };
    const starter = osc('sawtooth', 220, 0); const stf = ctx.createBiquadFilter(); stf.type = 'lowpass'; stf.frequency.value = 1300; starter.gn.connect(stf).connect(master);
    const whine = osc('triangle', 600, 0); whine.gn.connect(master);
    const dyno = osc('sine', 80, 0); dyno.gn.connect(master);
    Object.assign(A, { ctx, noise, master, pipeIn, pipeDelay, pipeFb, muffler, intake, mech, fan, starter, whine, dyno });
    return true;
  }
  function burst(t, amp, dur, freq, q, dest, offset = 0) {
    const { ctx, noise } = A;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest); src.start(t, offset || Math.random() * 1.5, dur + 0.03);
  }
  function exhaustPulse(t, amp, st) {
    const { ctx, pipeIn } = A, rpm = Math.max(st.rpm, 250);
    const dur = clamp(0.014 + 7 / rpm, 0.02, 0.085);
    burst(t, amp, dur, 260 + 900 * st.throttle + rpm * 0.08, 0.7, pipeIn);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(135, t); o.frequency.exponentialRampToValueAtTime(52, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(amp * 1.15, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3);
    o.connect(og).connect(pipeIn); o.start(t); o.stop(t + dur * 1.3 + 0.02);
  }
  return {
    get on() { return A.on; },
    get ready() { return !!A.ctx; },
    wanted: undefined,
    set(on) {
      if (on && !init()) on = false;
      A.on = on;
      if (A.ctx) { if (on && A.ctx.state === 'suspended') A.ctx.resume(); A.master.gain.setTargetAtTime(on ? 0.75 : 0, A.ctx.currentTime, 0.05); }
      return on;
    },
    now() { return A.ctx && A.on ? A.ctx.currentTime + 0.05 : 0; },
    event(ev, at, st) {
      if (!at) return;
      if (ev.type === 'exhaust') exhaustPulse(at, ev.lit ? clamp(0.22 + ev.k * 0.55, 0.05, 0.9) * (0.5 + 0.5 * st.throttle) : 0.035, st);
      else if (ev.type === 'valve') burst(at, 0.012 + 0.012 * clamp(st.rpm / 6000, 0, 1), 0.012, ev.which === 'in' ? 3600 : 4300, 6, A.master);
      else if (ev.type === 'afterfire') { burst(at, 0.9, 0.05, 900, 0.5, A.pipeIn); burst(at + 0.006, 0.5, 0.08, 300, 0.6, A.pipeIn); }
      else if (ev.type === 'shift') { burst(at, 0.08, 0.05, 1800, 3, A.master); burst(at + 0.09, 0.12, 0.04, 900, 4, A.master); }
    },
    update(st, scale) {
      if (!A.ctx || !A.on) return;
      const t = A.ctx.currentTime, rpm = st.rpm;
      const run = st.rpm > 80 ? 1 : 0;
      A.intake.gn.gain.setTargetAtTime(run * clamp(st.airKgs * 7, 0, 0.06), t, 0.05);
      A.intake.fl.frequency.setTargetAtTime(420 + rpm * 0.11, t, 0.05);
      A.mech.gn.gain.setTargetAtTime(clamp(rpm / 9000, 0, 1) * 0.018 * (scale < 1 ? 0.3 : 1), t, 0.05);
      A.mech.fl.frequency.setTargetAtTime(3200 + rpm * 0.2, t, 0.1);
      A.starter.gn.gain.setTargetAtTime(st.starter ? 0.05 : 0, t, 0.02);
      A.starter.o.frequency.setTargetAtTime(150 + rpm * 0.55, t, 0.03);
      // dengung rantai keteng & gigi transmisi
      A.whine.gn.gain.setTargetAtTime(clamp(rpm / 9000, 0, 1) * 0.006 + (st.gear > 0 ? clamp(st.out / 200, 0, 1) * 0.006 : 0), t, 0.1);
      A.whine.o.frequency.setTargetAtTime(Math.max(40, (rpm / 60) * 14 * 0.5), t, 0.05);
      A.dyno.gn.gain.setTargetAtTime(clamp(st.out / 150, 0, 1) * (0.004 + 0.02 * st.load), t, 0.1);
      A.dyno.o.frequency.setTargetAtTime(Math.max(30, (st.out / (2 * Math.PI)) * 18), t, 0.05);
      A.pipeDelay.delayTime.setTargetAtTime(clamp(0.0062 - st.headC * 0.000006, 0.004, 0.0062), t, 0.5);
      A.muffler.frequency.setTargetAtTime(1300 + 1400 * st.throttle, t, 0.08);
    },
  };
}
