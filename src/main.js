import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { V3, MAT, cutPlane, sectioned, glowTex } from './kit.js';
import { STROKES, strokeIndex, clamp, SPEC } from './sim/engine.js';
import { createBench, GEARBOX } from './sim/bench.js';
import { buildEngine } from './model/engine3d.js';
import { buildPlug } from './model/plug.js';
import { buildBench, FLOOR_Y } from './model/bench3d.js';
import { createAudio } from './audio.js';
import { drawTach, drawCycle, drawPV } from './ui/instruments.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sim = createBench(), st = sim.state;

/* ---------- renderer, kamera, cahaya ---------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
scene.fog = new THREE.Fog(0xd7dfd8, 260, 520);
const camera = new THREE.PerspectiveCamera(32, 1, 1, 900);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.minDistance = 4; controls.maxDistance = 260;
controls.maxPolarAngle = Math.PI * 0.62;
scene.add(new THREE.HemisphereLight(0xf2f6f0, 0x3d4a42, 0.45));
const sun = new THREE.DirectionalLight(0xfff4e6, 2.7);
sun.position.set(30, 70, 45); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 55, top: 45, bottom: -45, near: 1, far: 220 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe4efff, 0.6); fill.position.set(-30, 14, 50); scene.add(fill);
const rim = new THREE.DirectionalLight(0xcfe3ff, 1.0); rim.position.set(-40, 26, -40); scene.add(rim);

/* ---------- model ---------- */
const eng = buildEngine(scene);
const plug = buildPlug(eng.cyl);
scene.updateMatrixWorld(true);
eng.plugBootWorld = plug.group.localToWorld(V3(0, 10.4, 0));
const bench = buildBench(scene, eng);
const GAP_WORLD = () => eng.cyl.localToWorld(plug.gapLocal.clone());

/* ---------- asap knalpot ---------- */
const smoke = [];
for (let i = 0; i < 80; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9a9d98, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false; scene.add(s); smoke.push({ s, life: 0, max: 1, v: V3(0, 0, 0), a: 0 });
}
let smokeIdx = 0;
const tailDir = V3(-1, 0.12, 0).normalize();
function puff(amount, color) {
  const p = smoke[smokeIdx++ % smoke.length];
  p.s.visible = true; p.life = 0; p.max = 1.0 + Math.random() * 0.9;
  p.s.position.copy(eng.parts.tail);
  p.v.copy(tailDir).multiplyScalar(9 + Math.random() * 6 + st.rpm * 0.002).add(V3(0, 0.6 + Math.random() * 1.5, (Math.random() - 0.5) * 2));
  p.a = amount; p.s.material.color.setHex(color);
}
function updateSmoke(dt) {
  for (const p of smoke) {
    if (!p.s.visible) continue;
    p.life += dt; const t = p.life / p.max;
    if (t >= 1) { p.s.visible = false; continue; }
    p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.6); p.v.y += dt * 2.6;
    const size = 1.2 + t * 7; p.s.scale.set(size, size, 1);
    p.s.material.opacity = p.a * (1 - t) * (1 - t);
  }
}
const afterfireLight = new THREE.PointLight(0xff8a3a, 0, 30, 1.5); scene.add(afterfireLight);
let afterGlow = 0;

/* ---------- mode tampilan ---------- */
let mode = 'potong';
function setMode(m) {
  mode = m;
  for (const mat of sectioned) {
    mat.clippingPlanes = m === 'potong' ? [cutPlane] : [];
    mat.transparent = m === 'tembus';
    mat.opacity = m === 'tembus' ? 0.13 : 1;
    mat.depthWrite = m !== 'tembus';
    mat.needsUpdate = true;
  }
  for (const mat of [eng.gasMat, eng.parts.oilMat, ...plug.clipMats]) { mat.clippingPlanes = m === 'potong' ? [cutPlane] : []; mat.needsUpdate = true; }
  eng.gas.visible = m !== 'utuh';
  eng.parts.oil.visible = m !== 'utuh';
  eng.clutch.visible = m !== 'potong';
  plug.setVisible(m !== 'utuh');
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === m)));
}

/* ---------- kamera ---------- */
const VIEW_DIR = V3(0.34, 0.2, 0.92).normalize();
const HOME_TARGET = V3(2, 3.5, 0);
function homeView() {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const dist = aspect < 0.8 ? 112 : aspect < 1.2 ? 82 : 66;
  return { t: HOME_TARGET.clone(), p: HOME_TARGET.clone().addScaledVector(VIEW_DIR, dist) };
}
let fly = null;
function flyTo(where) {
  let v;
  if (where === 'plug') {
    const g = GAP_WORLD(), t = g.clone().lerp(eng.cyl.localToWorld(V3(0, 13.6, 0)), 0.45);
    const d = V3(0.35, 0.15, 1).normalize().applyAxisAngle(V3(0, 0, 1), -eng.tilt);
    v = { t, p: t.clone().addScaledVector(d, stage.clientWidth < 500 ? 20 : 14) };
  }
  else if (where === 'gearbox') { const t = V3(-8.2, -1.0, 0); v = { t, p: t.clone().addScaledVector(V3(-0.25, 0.3, 1).normalize(), stage.clientWidth < 500 ? 44 : 32) }; }
  else v = homeView();
  if (reduceMotion) { controls.target.copy(v.t); camera.position.copy(v.p); controls.update(); return; }
  fly = { k: 0, t0: controls.target.clone(), p0: camera.position.clone(), t1: v.t, p1: v.p };
}
function updateFly(dt) {
  if (!fly) return;
  fly.k = Math.min(1, fly.k + dt / 1.1);
  const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - Math.pow(-2 * fly.k + 2, 3) / 2;
  controls.target.lerpVectors(fly.t0, fly.t1, e); camera.position.lerpVectors(fly.p0, fly.p1, e);
  if (fly.k >= 1) fly = null;
}
renderer.domElement.addEventListener('pointerdown', () => { fly = null; });

/* ---------- tema ---------- */
const T = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ink', 'muted', 'line', 'accent', 'hot', 'panel', 'stage', 'intake', 'exhaust']) T[k] = cs.getPropertyValue('--' + k).trim();
  if (T.stage) { const c = new THREE.Color(T.stage); scene.background = c; scene.fog.color.copy(c); }
}
readTokens();
{ const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', readTokens); else if (mq.addListener) mq.addListener(readTokens); }
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- suara ---------- */
const audio = createAudio();
function setSound(on) {
  const ok = audio.set(on);
  $('sound').setAttribute('aria-pressed', String(ok));
  $('sound').textContent = ok ? 'Suara: nyala' : 'Nyalakan suara';
}

/* ---------- panel ---------- */
const ui = {};
for (const id of ['v-rpm', 'v-speed', 'v-hp', 'v-tq', 'v-head', 'v-afr', 'v-map', 'v-fuel', 'v-clutch', 'v-peak', 'v-adv', 'state', 'stroke-tag', 'run', 'note', 'choke']) ui[id] = $(id);
const nf = (min, max) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
const nf0 = nf(0, 0), nf1 = nf(1, 1), nf2 = nf(2, 2);
const smooth = { rpm: 0, hp: 0, tq: 0, fuel: 0, afr: 14.7, map: 101, speed: 0 };
let starterTime = 0, stallNote = '', slow = false;
const STROKE_TEXT = {
  hisap: 'Hisap: klep masuk terbuka, seher turun menarik campuran bensin dan udara dari karbu.',
  kompresi: 'Kompresi: kedua klep tertutup, seher naik memampatkan campuran. Busi memercik sebelum TMA.',
  usaha: 'Usaha: api merambat dari busi, tekanan mendorong seher turun dan memutar kruk as.',
  buang: 'Buang: klep buang terbuka, seher naik mendorong gas sisa ke knalpot.',
};
function phase() {
  if (st.starter) return 'starter';
  if (st.running) return st.limiter ? 'limiter' : 'hidup';
  if (st.rpm > 5) return 'berhenti';
  return 'mati';
}
function noteText(ph, readable, sname) {
  if (stallNote && !st.fuel) return stallNote;
  if (readable && st.rpm > 1) return STROKE_TEXT[sname];
  if (ph === 'starter') return 'Motor starter memutar kruk as lewat kopling satu arah sampai campuran pertama terbakar.';
  if (ph === 'mati' || ph === 'berhenti') return 'Mesin mati. Tekan Hidupkan mesin. Saat dingin, nyalakan choke dulu.';
  if (st.headC > 250) return 'Kepala silinder terlalu panas. Kurangi gas atau beban dan biarkan kipas mendinginkan mesin.';
  if (ph === 'limiter') return 'CDI memotong pengapian di 9.600 rpm. Kurangi gas, tambah beban, atau naikkan gigi.';
  if (st.choke && st.headC > 62) return `Mesin sudah hangat (${nf0.format(st.headC)} °C). Matikan choke: campuran terlalu kaya, putaran turun dan asap menghitam.`;
  if (st.choke) return 'Choke aktif: campuran diperkaya karena bensin mengembun di dinding mesin yang dingin. Tunggu sampai ±60 °C.';
  if (st.warm < 0.55) return 'Mesin masih dingin tanpa choke: campuran terlalu kurus, putaran tersendat. Nyalakan choke sebentar.';
  if (st.gear === 0 && st.load > 0.02) return 'Gigi netral: dinamo tidak tersambung ke mesin. Masukkan gigi 1–4 untuk membebani.';
  if (st.gear > 0 && st.clutchState === 'selip' && st.throttle > 0.1) return 'Kopling sentrifugal selip: putaran belum cukup tinggi untuk beban ini, sepatu kopling belum menggigit penuh.';
  if (st.gear > 0 && st.clutchState === 'lepas') return 'Di bawah ±1.800 rpm sepatu kopling sentrifugal belum mengembang, jadi mesin stasioner tanpa menarik roda. Tambah gas.';
  if (st.gear > 0) return `Gigi ${st.gear}: rasio total ${nf2.format(GEARBOX.primary * GEARBOX.ratios[st.gear] * GEARBOX.final)} dari kruk as ke roda. Dinamo membaca tenaga setelah rugi transmisi.`;
  return 'Mesin hangat dan stasioner. Masukkan gigi lalu tarik beban dinamo untuk mengukur tenaga. Tekan Lambat untuk melihat tiap langkah.';
}
let uiTick = 0, lastTag = '';
function updateUI(dt) {
  const k = 1 - Math.exp(-dt * 8);
  const hp = st.dynoPower / 745.7;
  smooth.rpm += (st.rpm - smooth.rpm) * k; smooth.hp += (hp - smooth.hp) * k; smooth.tq += (st.dynoTq - smooth.tq) * k;
  smooth.fuel += (st.fuelLph - smooth.fuel) * k; smooth.afr += (14.7 * st.lambdaEff - smooth.afr) * k * 0.5; smooth.map += (st.pMan / 1000 - smooth.map) * k;
  smooth.speed += (st.speedKmh - smooth.speed) * k;
  const sname = STROKES[strokeIndex(st.phi)], readable = slow || st.rpm < 250;
  const tag = readable ? sname : '4 langkah';
  if (tag !== lastTag) { lastTag = tag; ui['stroke-tag'].textContent = tag; ui['stroke-tag'].dataset.stroke = readable ? sname : 'siklus'; }
  uiTick += dt;
  if (uiTick > 0.1) {
    uiTick = 0;
    const turning = st.rpm > 60, ph = phase();
    ui['v-rpm'].textContent = nf0.format(Math.round(smooth.rpm / 10) * 10);
    ui['v-speed'].textContent = nf0.format(Math.max(0, smooth.speed));
    ui['v-hp'].textContent = nf2.format(Math.max(0, smooth.hp));
    ui['v-tq'].textContent = nf1.format(Math.max(0, smooth.tq));
    ui['v-head'].textContent = nf0.format(st.headC);
    ui['v-head'].parentElement.parentElement.dataset.warn = st.headC > 250 ? 'hot' : st.headC < 55 ? 'cold' : '';
    ui['v-afr'].textContent = turning && st.fuel ? nf1.format(smooth.afr) : '–';
    ui['v-map'].textContent = nf0.format(turning ? smooth.map : 101);
    ui['v-fuel'].textContent = nf2.format(turning && st.fuel ? Math.max(0, smooth.fuel) : 0);
    ui['v-clutch'].textContent = st.gear === 0 && st.shiftT <= 0 ? 'netral' : st.shiftT > 0 ? 'pindah gigi' : st.clutchState;
    ui['v-peak'].textContent = nf0.format(turning ? st.lastPeak / 1e5 : 0);
    ui['v-adv'].textContent = nf0.format(st.advance);
    ui.state.textContent = { starter: 'Starter berputar', hidup: 'Hidup', limiter: 'Pembatas putaran', berhenti: 'Berhenti', mati: 'Mati' }[ph];
    ui.state.dataset.state = ph;
    ui.run.textContent = ph === 'hidup' || ph === 'limiter' ? 'Matikan mesin' : ph === 'starter' ? 'Menyalakan…' : 'Hidupkan mesin';
    ui.run.dataset.on = String(st.fuel);
    const n = noteText(ph, readable, sname);
    if (ui.note.textContent !== n) ui.note.textContent = n;
    const tg = sim.shiftingTo();
    document.querySelectorAll('[data-gear]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.gear === tg)));
    ui.choke.setAttribute('aria-pressed', String(st.choke));
    ui.choke.textContent = st.choke ? 'Choke: aktif' : 'Choke: mati';
  }
  drawTach($('tach'), T, smooth.rpm, st);
  drawCycle($('cycle'), T, st);
  drawPV($('pv'), T, st);
}

function toggleEngine() {
  if (st.running || st.starter) { sim.stop(); stallNote = ''; return false; }
  sim.stop(); sim.key(); starterTime = 0; stallNote = '';
  return true;
}
ui.run.addEventListener('click', () => { const s = toggleEngine(); if (s && !audio.ready && audio.wanted !== false) setSound(true); });
$('gas').addEventListener('input', (e) => { sim.setThrottle(e.target.value / 100); $('gas-out').textContent = e.target.value + '%'; });
$('load').addEventListener('input', (e) => { sim.setLoad(e.target.value / 100); $('load-out').textContent = e.target.value + '%'; });
$('sound').addEventListener('click', () => { audio.wanted = !audio.on; setSound(!audio.on); });
ui.choke.addEventListener('click', () => sim.setChoke(!st.choke));
document.querySelectorAll('[data-gear]').forEach((b) => b.addEventListener('click', () => sim.setGear(+b.dataset.gear)));
function setSlow(v) { slow = v; $('slow').setAttribute('aria-pressed', String(v)); }
$('slow').addEventListener('click', () => setSlow(!slow));
$('reset').addEventListener('click', () => flyTo(null));
$('plug-view').addEventListener('click', () => { setMode('potong'); setSlow(true); flyTo('plug'); });
$('gear-view').addEventListener('click', () => { setMode('potong'); flyTo('gearbox'); });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.view)));
function nudge(id, d) { const el = $(id); el.value = clamp(+el.value + d, 0, 100); el.dispatchEvent(new Event('input')); }
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); toggleEngine(); }
  else if (e.key === 'ArrowUp' && e.target.tagName !== 'INPUT') { e.preventDefault(); nudge('gas', 10); }
  else if (e.key === 'ArrowDown' && e.target.tagName !== 'INPUT') { e.preventDefault(); nudge('gas', -10); }
  else if (k === '1') setMode('utuh'); else if (k === '2') setMode('potong'); else if (k === '3') setMode('tembus');
  else if (k === 's') setSlow(!slow);
  else if (k === 'b') { setMode('potong'); setSlow(true); flyTo('plug'); }
  else if (k === 't') { setMode('potong'); flyTo('gearbox'); }
  else if (k === 'c') sim.setChoke(!st.choke);
  else if (k === 'e') sim.shift(1);
  else if (k === 'q') sim.shift(-1);
});

/* ---------- loop ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
{ const v = homeView(); controls.target.copy(v.t); camera.position.copy(v.p); controls.update(); }
setMode('potong'); setSound(false);
setTimeout(() => { if (!st.fuel) { sim.key(); starterTime = 0; } }, 700);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const scale = slow ? 1 / 20 : 1, sdt = dt * scale, t0 = st.time;
  if (st.starter) {
    starterTime += sdt;
    if (st.running || starterTime > 3.5) {
      sim.release();
      if (!st.running) { sim.stop(); stallNote = !st.choke && st.warm < 0.5 ? 'Mesin gagal hidup: masih dingin dan choke mati. Nyalakan choke lalu coba lagi.' : 'Mesin gagal hidup. Coba lagi.'; }
    }
  } else if (st.fuel && !st.running && st.rpm < 60) {
    sim.stop();
    stallNote = st.choke && st.warm > 0.8 ? 'Mesin mati: choke masih aktif saat mesin panas, campuran terlalu kaya. Matikan choke lalu hidupkan lagi.'
      : !st.choke && st.warm < 0.5 ? 'Mesin mati: masih dingin dan campuran terlalu kurus. Nyalakan choke lalu hidupkan lagi.' : 'Mesin mati.';
  }
  sim.step(sdt);
  const at = audio.now();
  for (const ev of st.events) {
    const delay = (ev.t - t0) / scale;
    audio.event(ev, at ? at + delay : 0, st);
    if (ev.type === 'exhaust') {
      const cold = st.headC < 50, rich = ev.rich;
      if (!reduceMotion && Math.random() < (slow ? 1 : clamp(600 / Math.max(st.rpm, 1), 0.1, 1)))
        puff(ev.lit ? (rich ? 0.45 : cold ? 0.32 : 0.12 + 0.18 * st.throttle) : 0.05, rich ? 0x3b3c39 : cold ? 0xe8ece8 : 0xb7bab4);
    } else if (ev.type === 'spark') { if (ev.lit) plug.spark(); }
    else if (ev.type === 'caught') { for (let i = 0; i < 6; i++) puff(0.5, 0x4a4b48); }
    else if (ev.type === 'afterfire') { afterGlow = 1; for (let i = 0; i < 3; i++) puff(0.4, 0x5a5047); }
  }
  sim.clearEvents();
  afterGlow = Math.max(0, afterGlow - dt * 14);
  afterfireLight.intensity = afterGlow * 400; afterfireLight.position.copy(eng.parts.tail);
  audio.update(st, scale);
  eng.update(st, sdt);
  plug.update(st, dt, slow);
  bench.update(st, sdt);
  updateSmoke(dt * (slow ? 0.25 : 1));
  updateUI(dt);
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__mesin = { sim, setMode, flyTo, setSlow, camera, controls, scene, renderer, eng };
