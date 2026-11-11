// Model mesin bebek: silinder rebah 80° ke depan, karbu di atas kepala silinder, knalpot lewat bawah,
// transmisi di belakang kruk as, kopling sentrifugal di ujung kanan kruk as, magnet di kiri.
import * as THREE from 'three';
import {
  V2, V3, Y_AXIS, MAT, mesh, box, rbox, zCyl, bar, rod, gearGeo, sprocketGeo, helixGeo, bolt, finPlate,
  shellWall, plate, hullOf, chainLoop, perforation, housingMat,
} from '../kit.js';
import { SPEC, pinHeight, intakeLift, exhaustLift, CYCLE, clamp } from '../sim/engine.js';
import { GEARBOX } from '../sim/bench.js';

export const TILT = (80 * Math.PI) / 180;
const CR = SPEC.stroke * 50, ROD = SPEC.rod * 100;
const DECK = 5.6;                                   // dudukan blok silinder di bak mesin (lokal)
export const MAIN = V2(-6.0, -2.3), COUNTER = V2(-10.6, -0.5);
const PRIMARY_D = 6.43, GEAR_D = MAIN.distanceTo(COUNTER);

export function buildEngine(root) {
  const engine = new THREE.Group(); root.add(engine);
  const cyl = new THREE.Group(); cyl.rotation.z = -TILT; engine.add(cyl);
  const toWorld = (x, y, z = 0) => V3(x, y, z).applyAxisAngle(V3(0, 0, 1), -TILT);
  const parts = {};

  /* ===== bak mesin (koordinat dunia) ===== */
  const deckL = toWorld(-3.9, DECK), deckR = toWorld(3.9, DECK);
  const deckLi = toWorld(-3.25, DECK), deckRi = toWorld(3.25, DECK);
  const outerHull = hullOf([[0, 0, 5.5], [MAIN.x, MAIN.y, 4.0], [COUNTER.x, COUNTER.y, 4.4], [-4.5, -5.0, 1.6]], [[deckL.x, deckL.y], [deckR.x, deckR.y]]);
  const innerHull = hullOf([[0, 0, 4.9], [MAIN.x, MAIN.y, 3.4], [COUNTER.x, COUNTER.y, 3.85], [-4.5, -4.5, 1.2]], [[deckLi.x, deckLi.y], [deckRi.x, deckRi.y]]);
  function openPath(hull, a, b) {
    const ia = hull.findIndex((p) => p.distanceTo(V2(a.x, a.y)) < 1e-6), ib = hull.findIndex((p) => p.distanceTo(V2(b.x, b.y)) < 1e-6);
    const n = hull.length, out = [];
    let start = (ia + 1) % n === ib ? ib : ia, end = start === ib ? ia : ib;
    for (let i = start; ; i = (i + 1) % n) { out.push(hull[i]); if (i === end) break; }
    return out;
  }
  const outerPath = openPath(outerHull, deckL, deckR);
  let innerPath = openPath(innerHull, deckLi, deckRi);
  if (innerPath[0].distanceTo(outerPath[0]) > innerPath[innerPath.length - 1].distanceTo(outerPath[0])) innerPath = innerPath.reverse();
  const Z_L = -5.0, Z_R = 4.0;
  shellWall(outerPath, innerPath, Z_L, Z_R, MAT.caseAlu, engine);
  // garis belahan tengah bak mesin
  shellWall(outerPath.map((p) => p.clone().multiplyScalar(1.004)), outerPath, -0.25, 0.25, MAT.caseAlu, engine);
  // dinding samping kiri & kanan bak mesin
  plate(outerHull, Z_L - 0.6, 0.6, 0, MAT.caseAlu, engine);
  plate(outerHull, Z_R, 0.6, 0, MAT.caseAlu, engine);
  // dudukan silinder (neck) agar dinding bak menyambung ke blok
  // lug gantungan atas dan baut pivot belakang
  rbox(3.0, 3.2, 3.4, 0.5, MAT.caseAlu, -2.4, 5.6, 0, engine);
  zCyl(0.55, 18.6, MAT.steel, -2.4, 6.2, -4.3, engine, 16);
  zCyl(1.5, 9.6, MAT.caseAlu, -13.6, 1.6, -0.5, engine, 32);
  zCyl(0.55, 18.6, MAT.steel, -13.6, 1.6, -4.3, engine, 16);
  // baut pembuangan oli
  bolt(-4.6, -6.55, 0, '-y', engine, MAT.boltH, 1.2);

  // oli di dasar bak mesin (terlihat di tampilan potong)
  {
    const level = -3.9, poly = [];
    for (let i = 0; i < innerHull.length; i++) {
      const a = innerHull[i], b = innerHull[(i + 1) % innerHull.length];
      const ia = a.y < level, ib = b.y < level;
      if (ia) poly.push(a);
      if (ia !== ib) { const t = (level - a.y) / (b.y - a.y); poly.push(V2(a.x + (b.x - a.x) * t, level)); }
    }
    const s = new THREE.Shape(poly);
    const g = new THREE.ExtrudeGeometry(s, { depth: Z_R - Z_L - 0.1, bevelEnabled: false }); g.translate(0, 0, Z_L + 0.05);
    const oilMat = new THREE.MeshStandardMaterial({ color: 0x8a5a10, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    parts.oil = mesh(g, oilMat, engine, false); parts.oil.renderOrder = 1; parts.oilMat = oilMat;
  }

  /* ===== tutup kiri: magnet (ACG), tutup gir depan ===== */
  {
    const prof = [V2(0.001, 0), V2(6.7, 0), V2(6.75, -0.3), V2(6.6, -1.8), V2(6.2, -2.8), V2(5.2, -3.5), V2(2.4, -3.75), V2(0.001, -3.8)].reverse();
    const g = new THREE.LatheGeometry(prof, 64); g.rotateX(-Math.PI / 2);
    const acg = mesh(g, MAT.coverAlu, engine); acg.position.z = Z_L - 0.6;
    acg.scale.set(1, 1, 1);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; bolt(Math.cos(a) * 6.15, Math.sin(a) * 6.15, Z_L - 1.0, '-z', engine); }
    // tutup lubang pengintip tanda pengapian
    zCyl(0.9, 0.5, MAT.boltH, 3.2, 2.6, Z_L - 4.15, engine, 24);
    // tutup gir depan dan tuas pemindah gigi
    const sc = hullOf([[COUNTER.x, COUNTER.y, 2.6], [MAIN.x, MAIN.y, 2.0]]);
    plate(sc, Z_L - 2.2, 1.6, 0.35, MAT.coverAlu, engine, []);
    parts.shiftPivot = V3(MAIN.x + 0.6, MAIN.y - 1.2, Z_L - 2.6);
    const pedal = new THREE.Group(); pedal.position.copy(parts.shiftPivot); engine.add(pedal);
    zCyl(0.55, 1.0, MAT.steelDark, 0, 0, -0.3, pedal, 18);
    bar(V3(0, 0, -0.7), V3(7.5, -4.2, -1.6), 0.7, 0.45, MAT.steelDark, pedal);   // depan (injak)
    bar(V3(0, 0, -0.7), V3(-6.0, -3.0, -1.6), 0.7, 0.45, MAT.steelDark, pedal);  // belakang (tumit)
    mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 14).rotateX(Math.PI / 2), MAT.rubber, pedal).position.set(7.5, -4.2, -2.6);
    mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 14).rotateX(Math.PI / 2), MAT.rubber, pedal).position.set(-6.0, -3.0, -2.6);
    parts.pedal = pedal;
  }

  /* ===== tutup kanan: kopling, selah, pengisi oli ===== */
  const coverR = hullOf([[0, 0, 4.7], [MAIN.x, MAIN.y, 5.9], [COUNTER.x + 0.6, COUNTER.y - 0.6, 3.2]]);
  {
    plate(coverR, Z_R + 0.6, 2.8, 0.7, MAT.coverAlu, engine);
    const boss = mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.0, 48).rotateX(Math.PI / 2), MAT.coverAlu, engine); boss.position.set(0, 0, Z_R + 4.5);
    const cap = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 40).rotateX(Math.PI / 2), MAT.boltH, engine); cap.position.set(0, 0, Z_R + 5.05);
    coverR.forEach((p, i) => { if (i % 9 === 0) bolt(p.x * 0.93 + MAIN.x * 0.07, p.y * 0.93 + MAIN.y * 0.07, Z_R + 4.15, 'z', engine); });
    // tutup pengisi oli dengan tongkat ukur
    const fill = V3(-8.6, 3.0, Z_R + 2.0);
    zCyl(0.8, 1.2, MAT.coverAlu, fill.x, fill.y, fill.z, engine, 24);
    const knob = mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 16), MAT.rubberS, engine); knob.position.set(fill.x, fill.y + 1.0, fill.z);
    // selah (kick starter)
    const kick = new THREE.Group(); kick.position.set(COUNTER.x - 0.8, COUNTER.y - 1.6, Z_R + 4.0); kick.rotation.z = 0.35; engine.add(kick);
    mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 20).rotateX(Math.PI / 2), MAT.rubberS, kick).position.z = 0.4;
    rbox(0.9, 9.0, 0.7, 0.3, MAT.rubberS, 0.2, 4.4, 1.2, kick).rotation.z = -0.15;
    rbox(1.1, 1.1, 3.4, 0.35, MAT.rubberS, 0.9, 8.8, 2.4, kick);
  }

  /* ===== blok silinder & kepala (koordinat silinder) ===== */
  {
    const ri = 2.5, ro = 3.15, yb = 4.4, yt = 14.2;
    const wall = [V2(ri, yb), V2(2.95, yb), V2(2.95, DECK), V2(ro + 0.55, DECK), V2(ro + 0.55, DECK + 0.45), V2(ro, DECK + 0.75), V2(ro, yt - 0.4), V2(ro + 0.45, yt - 0.3), V2(ro + 0.45, yt), V2(ri, yt), V2(ri, yb)];
    mesh(new THREE.LatheGeometry(wall, 56), MAT.finPaint, cyl);
    for (let y = 6.55, i = 0; y < 13.6; y += 0.8, i++) {
      const k = Math.sin(((i + 0.5) / 9) * Math.PI);
      finPlate(y, 0.28, 4.6 + 0.8 * k, 4.1 + 0.6 * k, -2.95, ro - 0.05, cyl, 0.8);
    }
    const gk = [V2(ri, 14.2), V2(4.4, 14.2), V2(4.4, 14.35), V2(ri, 14.35), V2(ri, 14.2)];
    mesh(new THREE.LatheGeometry(gk, 56), MAT.boltH, cyl);
    // kepala silinder dengan ruang bakar kubah
    const pts = [V2(2.5, 14.35), V2(4.3, 14.35), V2(4.3, 19.2), V2(0.001, 19.2), V2(0.001, 15.25)];
    for (let a = 4; a <= 90; a += 4) { const t = (a * Math.PI) / 180; pts.push(V2(2.5 * Math.sin(t), 14.35 + 0.9 * Math.cos(t))); }
    mesh(new THREE.LatheGeometry(pts, 56), MAT.headAlu, cyl);
    for (let y = 14.8, i = 0; y < 18.8; y += 0.78, i++) finPlate(y, 0.28, 5.7 - i * 0.12, 5.1 - i * 0.1, -2.95, 4.25, cyl, 1.0, [MAT.headAlu, MAT.machined]);
    rbox(8.6, 4.3, 6.2, 0.7, MAT.coverAlu, 0, 21.1, 0, cyl);
    for (const z of [-1.6, 0, 1.6]) rbox(6.4, 0.35, 0.5, 0.15, MAT.coverAlu, 0, 23.35, z, cyl);
    rbox(6.6, 18.4, 2.5, 0.55, MAT.finPaint, 0, 15.0, -4.05, cyl);                // terowongan rantai keteng
    for (const sx of [-1, 1]) {                                                    // tutup setelan klep
      const c = mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.9, 40), MAT.coverAlu, cyl); c.rotation.z = Math.PI / 2; c.position.set(sx * 4.55, 20.5, 0);
      const hx = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 6), MAT.boltH, cyl); hx.rotation.z = Math.PI / 2; hx.position.set(sx * 5.2, 20.5, 0);
    }
    for (const [x, z] of [[-3.5, 2.5], [3.5, 2.5], [-3.5, -2.5], [3.5, -2.5]]) bolt(x, 23.45, z, null, cyl);
    const cc = mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 40), MAT.coverAlu, cyl); cc.rotation.x = Math.PI / 2; cc.position.set(0, 20.9, -5.55);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bolt(Math.cos(a) * 1.85, 20.9 + Math.sin(a) * 1.85, -5.85, '-z', cyl); }
    // flens saluran masuk (atas) dan buang (bawah)
    const fin = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 28), MAT.headAlu, cyl); fin.rotation.z = Math.PI / 2; fin.position.set(-4.5, 16.4, 0);
    const fex = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.45, 28), MAT.boltH, cyl); fex.rotation.z = Math.PI / 2; fex.position.set(4.6, 16.3, 0);
    for (const s of [-1, 1]) { bolt(4.85, 16.3 + s * 1.15, 0, 'x', cyl, MAT.boltH, 0.8); }
  }

  /* ===== bagian bergerak (koordinat silinder) ===== */
  const gasMat = new THREE.MeshBasicMaterial({ color: 0x4c8cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const gas = mesh(new THREE.CylinderGeometry(2.46, 2.46, 1, 40), gasMat, cyl, false); gas.renderOrder = 2;
  const piston = new THREE.Group(); cyl.add(piston);
  {
    const prof = [V2(2.3, -2.6), V2(2.47, -2.6), V2(2.47, 2.0), V2(2.2, 2.2), V2(0.001, 2.2)];
    mesh(new THREE.LatheGeometry(prof, 48), MAT.steel, piston);
    for (const y of [1.65, 1.25, 0.85]) { const ring = mesh(new THREE.TorusGeometry(2.47, 0.07, 6, 48), MAT.steelDark, piston); ring.rotation.x = Math.PI / 2; ring.position.y = y; }
    zCyl(0.62, 4.4, MAT.steelDark, 0, 0, 0, piston);
    for (const z of [-1.2, 1.2]) zCyl(0.95, 0.5, MAT.steel, 0, 0, z, piston, 24);
  }
  const crank = new THREE.Group(); cyl.add(crank);
  {
    const s = new THREE.Shape();
    s.moveTo(1.45, CR); s.absarc(0, CR, 1.45, 0, Math.PI, false);
    const a0 = (200 * Math.PI) / 180, a1 = (340 * Math.PI) / 180;
    s.lineTo(3.5 * Math.cos(a0), 3.5 * Math.sin(a0)); s.absarc(0, 0, 3.5, a0, a1, false); s.lineTo(1.45, CR);
    for (const z of [-1.35, 1.35]) {
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 32 });
      g.translate(0, 0, z - 0.45); mesh(g, MAT.steelDark, crank);
    }
    zCyl(0.85, 2.2, MAT.steel, 0, CR, 0, crank);
    zCyl(1.15, 4.6, MAT.steel, 0, 0, -4.1, crank);
    zCyl(1.0, 6.2, MAT.steel, 0, 0, 4.9, crank);
    const sp = mesh(sprocketGeo(1.35, 14, 0.5), MAT.chain, crank); sp.position.z = -4.2;
    // rotor magnet (roda gila) di dalam tutup kiri
    const rot = mesh(new THREE.CylinderGeometry(5.3, 5.3, 1.8, 64, 1, true).rotateX(Math.PI / 2), MAT.steelDark, crank); rot.position.z = -7.0;
    zCyl(5.3, 0.3, MAT.steelDark, 0, 0, -7.85, crank, 64);
    zCyl(1.6, 0.6, MAT.steel, 0, 0, -8.1, crank);
    box(0.5, 2.6, 0.12, MAT.accent, 0, 3.7, -8.03, crank);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; box(1.6, 0.9, 1.6, MAT.black, Math.cos(a) * 4.7, Math.sin(a) * 4.7, -7.0, crank).rotation.z = a + Math.PI / 2; }
  }
  // stator spul di dalam rotor (diam)
  {
    const st = new THREE.Group(); st.position.z = -7.0; engine.add(st);
    zCyl(2.2, 1.4, MAT.steelDark, 0, 0, 0, st, 24);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const c = box(1.2, 1.4, 1.2, MAT.brass, Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0, st); c.rotation.z = a; }
  }
  const rodG = new THREE.Group(); cyl.add(rodG);
  {
    mesh(new THREE.TorusGeometry(1.25, 0.42, 12, 32), MAT.steel, rodG);
    mesh(new THREE.TorusGeometry(0.85, 0.3, 10, 24), MAT.steel, rodG).position.y = ROD;
    mesh(new THREE.BoxGeometry(0.8, ROD - 2.4, 0.7), MAT.steel, rodG).position.y = ROD / 2 + 0.2;
    box(1.2, ROD - 3.2, 0.35, MAT.steel, 0, ROD / 2 + 0.1, 0, rodG);
    box(3.4, 0.45, 0.9, MAT.steelDark, 0, -1.55, 0, rodG);
  }

  /* klep, pegas, kem, pelatuk */
  const T = (18 * Math.PI) / 180, STEM = 5.2, CAM_C = V3(0, 20.9, 0), CAM_BASE = 0.95;
  const valves = [
    { seat: V3(-1.25, 15.05, 0), dir: V3(-Math.sin(T), Math.cos(T), 0), lift: intakeLift, pivot: V3(-1.75, 21.55, 0.55), camAng: (125 * Math.PI) / 180, peak: (105 * Math.PI) / 180, sign: 1, z: 0.55 },
    { seat: V3(1.25, 15.05, 0), dir: V3(Math.sin(T), Math.cos(T), 0), lift: exhaustLift, pivot: V3(1.75, 21.55, -0.55), camAng: (55 * Math.PI) / 180, peak: (615 * Math.PI) / 180, sign: -1, z: -0.55 },
  ];
  const camshaft = new THREE.Group(); camshaft.position.copy(CAM_C); cyl.add(camshaft);
  zCyl(0.45, 5.8, MAT.steel, 0, 0, -1.6, camshaft);
  mesh(sprocketGeo(2.7, 28, 0.5), MAT.chain, camshaft).position.z = -4.2;
  box(0.3, 2.2, 0.08, MAT.accent, 0, 1.4, -3.92, camshaft);
  for (const v of valves) {
    const g = new THREE.Group(); cyl.add(g);
    mesh(new THREE.CylinderGeometry(0.95, 0.75, 0.22, 32), MAT.steel, g);
    mesh(new THREE.CylinderGeometry(0.17, 0.17, STEM, 12), MAT.steel, g).position.y = STEM / 2;
    mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.22, 20), MAT.steelDark, g).position.y = STEM - 0.35;
    g.quaternion.setFromUnitVectors(Y_AXIS, v.dir); v.group = g;
    v.top = v.seat.clone().addScaledVector(v.dir, STEM);
    const sp = mesh(helixGeo(6, 0.48, 0.07), MAT.spring, cyl);
    sp.quaternion.setFromUnitVectors(Y_AXIS, v.dir); sp.position.copy(v.seat.clone().addScaledVector(v.dir, 2.35)); v.spring = sp;
    const s = new THREE.Shape();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2, k = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const lobe = k < 1.05 ? Math.pow(Math.cos((k / 1.05) * Math.PI / 2), 2) : 0, rr = CAM_BASE + 0.42 * lobe;
      i === 0 ? s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const lg = new THREE.ExtrudeGeometry(s, { depth: 0.75, bevelEnabled: false }); lg.translate(0, 0, v.z - 0.375);
    const lw = new THREE.Group(); mesh(lg, MAT.steel, lw); camshaft.add(lw); v.lobe = lw;
    const rk = new THREE.Group(); rk.position.copy(v.pivot); cyl.add(rk);
    const camEnd = V3(Math.cos(v.camAng) * CAM_BASE, Math.sin(v.camAng) * CAM_BASE, 0).add(CAM_C).setZ(v.z);
    const valveEnd = v.top.clone().addScaledVector(v.dir, 0.12).setZ(v.z), P = v.pivot;
    bar(V3(0, 0, 0), camEnd.clone().sub(P), 0.5, 0.6, MAT.steelDark, rk);
    bar(V3(0, 0, 0), valveEnd.clone().sub(P), 0.5, 0.6, MAT.steelDark, rk);
    mesh(new THREE.BoxGeometry(0.5, 0.3, Math.abs(v.z) * 2 + 0.4), MAT.steelDark, rk).position.copy(valveEnd.clone().sub(P)).setZ(-v.z);
    zCyl(0.32, 1.0, MAT.steel, 0, 0, 0, rk, 16);
    v.rocker = rk; v.lever = valveEnd.distanceTo(P);
    zCyl(0.2, 6.4, MAT.steelDark, P.x, P.y, -1.0, cyl, 12);
  }
  const camChain = chainLoop(V2(0, 0), 1.5, V2(CAM_C.x, CAM_C.y), 2.85, -4.2, cyl);
  // penegang rantai
  bar(V3(1.9, 4.0, -4.2), V3(2.9, 17.5, -4.2), 0.4, 0.7, MAT.black, cyl);

  /* ===== kopling sentrifugal & gigi primer (kanan) ===== */
  const clutch = new THREE.Group(); engine.add(clutch);
  const drum = new THREE.Group(); drum.position.z = Z_R + 1.7; clutch.add(drum);
  {
    const prof = [V2(0.9, 2.4), V2(4.1, 2.4), V2(4.1, 2.0), V2(3.85, 1.9), V2(3.85, -0.2), V2(4.1, -0.2), V2(4.1, -0.5), V2(0.9, -0.5)].reverse();
    const g = new THREE.LatheGeometry(prof, 64, Math.PI * 0.55, Math.PI * 1.75); g.rotateX(Math.PI / 2);
    mesh(g, MAT.gearSteel, drum);
    const pg = mesh(gearGeo(1.32, 17, 0.9), MAT.gearSteel, drum); pg.position.z = -1.3;
  }
  const shoes = [];
  const shoeGroup = new THREE.Group(); shoeGroup.position.z = Z_R + 2.4; clutch.add(shoeGroup);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.rotation.z = (i / 3) * Math.PI * 2; shoeGroup.add(g);
    const s = new THREE.Shape(); s.absarc(0, 0, 3.75, -0.85, 0.85, false); s.absarc(0, 0, 2.6, 0.85, -0.85, true);
    const sg = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false, curveSegments: 12 }); sg.translate(0, 0, -0.75);
    const shoe = new THREE.Group(); g.add(shoe);
    mesh(sg, MAT.steelDark, shoe);
    const lin = new THREE.Shape(); lin.absarc(0, 0, 3.82, -0.8, 0.8, false); lin.absarc(0, 0, 3.72, 0.8, -0.8, true);
    const lg = new THREE.ExtrudeGeometry(lin, { depth: 1.4, bevelEnabled: false, curveSegments: 12 }); lg.translate(0, 0, -0.7);
    mesh(lg, MAT.red, shoe);
    const spring = mesh(helixGeo(7, 0.22, 0.05, 2.2), MAT.spring, g); spring.rotation.z = Math.PI / 2 + 1.05; spring.position.set(Math.cos(1.05) * 2.5, Math.sin(1.05) * 2.5, 0);
    shoes.push(shoe);
  }
  zCyl(2.4, 0.5, MAT.steel, 0, 0, Z_R + 1.3, shoeGroup.parent, 40);
  // gigi primer besar dan kopling manual di poros utama
  const mainR = new THREE.Group(); mainR.position.set(MAIN.x, MAIN.y, Z_R + 0.4); clutch.add(mainR);
  mesh(gearGeo(PRIMARY_D * 69 / 86, 69, 0.9, 0.5), MAT.gearSteel, mainR);
  const basket = mesh(new THREE.CylinderGeometry(3.3, 3.3, 2.6, 48, 1, true).rotateX(Math.PI / 2), MAT.gearSteel, mainR); basket.position.z = 1.9;
  for (let i = 0; i < 5; i++) zCyl(3.1, 0.18, i % 2 ? MAT.red : MAT.steel, 0, 0, 1.0 + i * 0.45, mainR, 40);
  zCyl(3.2, 0.35, MAT.steel, 0, 0, 3.3, mainR, 40);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; mesh(helixGeo(5, 0.32, 0.06, 1.1).rotateX(Math.PI / 2), MAT.spring, mainR).position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 2.0); }

  /* ===== transmisi 4 percepatan (terlihat di tampilan potong) ===== */
  const gearbox = new THREE.Group(); engine.add(gearbox);
  const mainShaft = new THREE.Group(); mainShaft.position.set(MAIN.x, MAIN.y, 0); gearbox.add(mainShaft);
  const counterShaft = new THREE.Group(); counterShaft.position.set(COUNTER.x, COUNTER.y, 0); gearbox.add(counterShaft);
  zCyl(0.6, 11.5, MAT.steel, 0, 0, -0.2, mainShaft);
  zCyl(0.7, 13.6, MAT.steel, 0, 0, -1.4, counterShaft);
  const GZ = [-3.4, -1.95, -0.5, 0.95];
  const pairs = [];
  for (let g = 1; g <= 4; g++) {
    const ratio = GEARBOX.ratios[g], tm = [13, 18, 22, 24][g - 1], tc = [34, 28, 25, 22][g - 1];
    const rm = GEAR_D * tm / (tm + tc), rc = GEAR_D * tc / (tm + tc);
    const gm = new THREE.Group(); gm.position.z = GZ[g - 1]; mainShaft.add(gm);
    const gc = new THREE.Group(); gc.position.set(COUNTER.x, COUNTER.y, GZ[g - 1]); gearbox.add(gc);
    const mm = mesh(gearGeo(rm, tm, 0.95, 0.3), MAT.gearSteel, gm);
    const mc = mesh(gearGeo(rc, tc, 0.95, 0.22), MAT.gearSteel, gc);
    // gigi anjing (dog) di sisi gigi
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; box(0.35, 0.35, 0.3, MAT.steelDark, Math.cos(a) * rc * 0.45, Math.sin(a) * rc * 0.45, 0.6, gc); }
    pairs.push({ ratio, gm, gc, mm, mc, tm, tc });
  }
  // gigi geser (sliding dog) di poros output
  const slider = new THREE.Group(); counterShaft.add(slider);
  mesh(gearGeo(1.6, 20, 0.7, 0.4), MAT.engaged, slider);
  const counterSprocket = mesh(sprocketGeo(1.43, 14, 0.6), MAT.chain, counterShaft); counterSprocket.position.z = -6.6;
  // tromol pemindah gigi dan garpu
  const drumPos = V3(-8.2, -4.3, 0);
  const shiftDrum = new THREE.Group(); shiftDrum.position.copy(drumPos); gearbox.add(shiftDrum);
  zCyl(0.85, 8.0, MAT.steelDark, 0, 0, -1.3, shiftDrum, 24);
  for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.86, 0.09, 6, 24), MAT.steel, shiftDrum); t.position.z = GZ[i] + 0.3; t.rotation.z = i; }
  const fork = new THREE.Group(); gearbox.add(fork);
  bar(V3(drumPos.x, drumPos.y, 0), V3(COUNTER.x + 0.2, COUNTER.y - 1.7, 0), 0.5, 0.25, MAT.brass, fork);
  zCyl(0.25, 9.0, MAT.steel, -9.6, -3.0, -1.3, gearbox, 12);

  /* ===== saluran masuk & karburator (dunia) ===== */
  const intakePort = toWorld(-4.75, 16.4);
  const carbAt = V3(9.6, 11.4, 0);
  {
    const path = new THREE.CatmullRomCurve3([intakePort, intakePort.clone().add(V3(-0.25, 1.4, 0)), V3(13.6, 11.0, 0), V3(11.6, 11.4, 0)]);
    mesh(new THREE.TubeGeometry(path, 24, 1.05, 20, false), MAT.rubberH, engine);
    for (const t of [0.12, 0.9]) { const p = path.getPointAt(t), tg = path.getTangentAt(t); const c = mesh(new THREE.TorusGeometry(1.12, 0.12, 6, 24), MAT.steel, engine); c.position.copy(p); c.quaternion.setFromUnitVectors(V3(0, 0, 1), tg); }
    const body = mesh(new THREE.CylinderGeometry(1.35, 1.35, 3.6, 28), MAT.carbBody, engine); body.rotation.z = Math.PI / 2; body.position.copy(carbAt);
    const tower = mesh(new THREE.CylinderGeometry(1.2, 1.3, 2.8, 28), MAT.carbBody, engine); tower.position.set(carbAt.x, carbAt.y + 2.0, 0);
    mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 6), MAT.carbBody, engine).position.set(carbAt.x, carbAt.y + 3.6, 0);
    const bowl = mesh(new THREE.CylinderGeometry(1.45, 1.4, 1.8, 28), MAT.carbBody, engine); bowl.position.set(carbAt.x - 0.2, carbAt.y - 2.0, 0);
    bolt(carbAt.x - 0.2, carbAt.y - 2.95, 0, '-y', engine, MAT.boltH, 0.7);
    // tuas choke
    const choke = new THREE.Group(); choke.position.set(carbAt.x - 1.2, carbAt.y + 0.5, 1.5); engine.add(choke);
    box(0.25, 1.8, 0.3, MAT.black, 0, 0.8, 0, choke); box(0.8, 0.5, 0.4, MAT.red, 0, 1.7, 0, choke);
    parts.chokeLever = choke;
    // skep kuningan
    const slide = new THREE.Group(); slide.position.set(carbAt.x, carbAt.y, 0); engine.add(slide);
    mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.4, 24), MAT.brass, slide).position.y = 0.4;
    mesh(new THREE.CylinderGeometry(0.1, 0.04, 2.0, 8), MAT.steel, slide).position.y = -1.6;
    parts.slide = slide;
    // kabel gas
    const cable = new THREE.CatmullRomCurve3([V3(carbAt.x, carbAt.y + 3.9, 0), V3(carbAt.x, carbAt.y + 6, 0), V3(carbAt.x - 2, carbAt.y + 8, -2), V3(carbAt.x - 6, carbAt.y + 8.5, -5)]);
    mesh(new THREE.TubeGeometry(cable, 30, 0.2, 8, false), MAT.black, engine);
    // corong dan selang ke saringan udara
    const hose = new THREE.CatmullRomCurve3([V3(carbAt.x - 1.8, carbAt.y, 0), V3(carbAt.x - 3.4, carbAt.y + 0.3, 0), V3(4.9, 12.4, 0)]);
    mesh(new THREE.TubeGeometry(hose, 16, 1.35, 20, false), MAT.rubberH, engine);
    rbox(7.0, 4.4, 7.4, 1.0, MAT.black, 1.2, 12.9, -0.6, engine);
    rbox(5.4, 0.3, 5.8, 0.12, MAT.accent, 1.2, 15.15, -0.6, engine);
    for (const [x, z] of [[-1.6, -3.4], [4.0, -3.4], [-1.6, 2.2], [4.0, 2.2]]) bolt(x, 15.1, z, null, engine, MAT.steel, 0.55);
  }
  parts.carbBowl = V3(carbAt.x - 0.2, carbAt.y - 2.0, 0);

  /* ===== knalpot (dunia): leher turun di depan, lewat bawah, peredam di kanan ===== */
  const exPort = toWorld(4.85, 16.3);
  const header = new THREE.CatmullRomCurve3([exPort, exPort.clone().add(V3(0.6, -2.6, 0)), V3(15.6, -7.8, 1.2), V3(9, -9.8, 3.4), V3(0, -10.2, 6.0), V3(-6.5, -9.6, 8.4), V3(-9.5, -9.0, 8.6)]);
  mesh(new THREE.TubeGeometry(header, 90, 0.85, 18, false), MAT.exhaust, engine);
  const MUF_START = -9.0, MUF_END = -33.5, MUF_Y0 = -9.0, MUF_Y1 = -6.0, MUF_Z = 8.6;
  const mufAxis = V3(MUF_END - MUF_START, MUF_Y1 - MUF_Y0, 0).normalize();
  const mufMid = V3((MUF_START + MUF_END) / 2, (MUF_Y0 + MUF_Y1) / 2, MUF_Z);
  const mufLen = Math.hypot(MUF_END - MUF_START, MUF_Y1 - MUF_Y0);
  {
    const prof = [V2(0.001, -mufLen / 2 - 0.4), V2(0.9, -mufLen / 2 - 0.4), V2(2.1, -mufLen / 2 + 3.0), V2(2.25, -mufLen / 2 + 5), V2(2.25, mufLen / 2 - 3), V2(2.0, mufLen / 2 - 0.6), V2(1.4, mufLen / 2), V2(0.001, mufLen / 2)];
    const muff = mesh(new THREE.LatheGeometry(prof, 40), MAT.exhaust, engine);
    muff.position.copy(mufMid); muff.quaternion.setFromUnitVectors(Y_AXIS, mufAxis);
    const shieldMat = housingMat({ color: 0xe9ebe8, metalness: 1, roughness: 0.16, alphaMap: perforation(6, 2), alphaTest: 0.5 }, 0);
    const shield = mesh(new THREE.CylinderGeometry(2.6, 2.6, mufLen * 0.55, 40, 1, true, Math.PI * 0.1, Math.PI * 1.1), shieldMat, engine);
    shield.position.copy(mufMid).addScaledVector(mufAxis, -mufLen * 0.12); shield.quaternion.setFromUnitVectors(Y_AXIS, mufAxis);
    const tip = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 20), MAT.chromeH, engine);
    tip.position.copy(mufMid).addScaledVector(mufAxis, mufLen / 2 + 0.6); tip.quaternion.setFromUnitVectors(Y_AXIS, mufAxis);
    parts.tail = mufMid.clone().addScaledVector(mufAxis, mufLen / 2 + 1.6);
    parts.tailDir = mufAxis.clone().negate().multiplyScalar(-1);
    // braket peredam ke baut pivot
    bar(V3(-13.6, 1.6, 5.2), mufMid.clone().addScaledVector(mufAxis, -2).add(V3(0, 2.0, 0)), 0.7, 0.35, MAT.steelDark, engine);
    const fl = mesh(new THREE.TorusGeometry(1.0, 0.25, 8, 24), MAT.boltH, engine); fl.position.copy(exPort.clone().add(V3(0.15, -0.5, 0))); fl.rotation.x = Math.PI / 2;
  }

  engine.traverse((o) => { if (o.isMesh && o.material !== gasMat && o !== parts.oil) { o.castShadow = true; o.receiveShadow = true; } });

  /* ===== update per frame ===== */
  const STEP = Math.PI * 2;
  let drumAng = 0, mainAng = 0, outAng = 0, shiftVis = 0, pedalKick = 0, lastGear = 0;
  function update(st, dt) {
    const th = st.phi, c = ((th % CYCLE) + CYCLE) % CYCLE;
    const pinY = pinHeight(th) * 100;
    crank.rotation.z = -th;
    piston.position.set(0, pinY, 0);
    const cx = CR * Math.sin(th), cy = CR * Math.cos(th);
    rodG.position.set(cx, cy, 0); rodG.rotation.z = Math.atan2(cx, pinY - cy);
    for (const v of valves) {
      const lift = v.lift(c) * 100;
      v.group.position.copy(v.seat).addScaledVector(v.dir, -lift);
      v.spring.scale.set(1, Math.max(0.3, STEM - 0.45 - 2.35 - lift), 1);
      v.lobe.rotation.z = v.camAng + v.peak / 2 - c / 2;
      v.rocker.rotation.z = v.sign * (lift / v.lever);
    }
    camChain.update(-th * 1.5);
    parts.slide.position.y = carbAt.y + st.throttle * 1.0;
    parts.chokeLever.rotation.z = st.choke ? 0.6 : -0.2;

    // gas di silinder
    const crown = pinY + 2.2, top = 14.95;
    gas.scale.y = Math.max(0.05, top - crown); gas.position.y = (crown + top) / 2;
    const barP = st.p / 1e5, stroke = Math.floor(c / Math.PI);
    if (stroke === 0) gasMat.color.setRGB(0.18, 0.42, 1.0).multiplyScalar(0.2 + 0.5 * (st.pMan / 101325));
    else if (stroke === 1) { const k = clamp((barP - 1) / 18, 0, 1); gasMat.color.setRGB(0.25 + 0.45 * k, 0.4 - 0.1 * k, 1.0 - 0.3 * k).multiplyScalar(0.35 + 0.4 * k); }
    else if (stroke === 2) {
      if (st.burnQ > 0) { const k = clamp(barP / 45, 0, 1); gasMat.color.setRGB(1.0, 0.35 + 0.5 * k, 0.08 + 0.35 * k * k).multiplyScalar(0.25 + 0.85 * k); }
      else gasMat.color.setRGB(0.3, 0.35, 0.6).multiplyScalar(0.3);
    } else { const k = clamp((barP - 1) * 2, 0, 1); gasMat.color.setRGB(0.55, 0.45, 0.38).multiplyScalar(0.18 + 0.25 * k); }

    // kopling & transmisi
    drumAng += st.drum * dt; outAng += st.out * dt;
    mainAng = drumAng / GEARBOX.primary;
    drum.rotation.z = -drumAng;
    shoeGroup.rotation.z = -th;
    const fling = clamp((st.rpm - 1600) / 1400, 0, 1);
    for (const s of shoes) s.position.x = 0.12 * fling - 0.05;
    mainR.rotation.z = mainAng;
    mainShaft.rotation.z = mainAng;
    for (const p of pairs) { p.gc.rotation.z = -mainAng * (p.tm / p.tc); }
    counterShaft.rotation.z = -outAng;
    const g = st.shiftT > 0 ? 0 : st.gear;
    const target = g > 0 ? GZ[g - 1] + 0.75 : -4.9;
    shiftVis += (target - shiftVis) * (1 - Math.exp(-dt * 14));
    slider.position.z = shiftVis;
    fork.position.z = shiftVis;
    const drumTarget = (st.shiftT > 0 ? st.pendingGear : st.gear) * (Math.PI * 2 / 5);
    shiftDrum.rotation.z += (drumTarget - shiftDrum.rotation.z) * (1 - Math.exp(-dt * 12));
    for (const p of pairs) { const on = g > 0 && p === pairs[g - 1]; p.mc.material = on ? MAT.engaged : MAT.gearSteel; p.mm.material = on ? MAT.engaged : MAT.gearSteel; }
    const tg = st.shiftT > 0 ? st.pendingGear : st.gear;
    if (tg !== lastGear) { pedalKick = tg > lastGear || (lastGear === 4 && tg === 0) ? 1 : -1; lastGear = tg; }
    pedalKick *= Math.exp(-dt * 7);
    parts.pedal.rotation.z = pedalKick * 0.28;
  }

  return {
    group: engine, cyl, parts, tilt: TILT, gas, gasMat, clutch, gearbox, toWorld, update,
    counter: COUNTER, counterSprocketZ: -6.6, carbBowl: parts.carbBowl,
  };
}
