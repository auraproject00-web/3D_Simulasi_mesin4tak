// Perlengkapan meja uji: rangka dudukan, dinamo arus eddy berantai, kipas pendingin, tangki bensin, koil.
import * as THREE from 'three';
import { V2, V3, MAT, mesh, box, rbox, zCyl, bar, rod, sprocketGeo, chainLoop, canvasTex } from '../kit.js';

export const FLOOR_Y = -15;
export const DYNO = V3(-38, -0.5, 0);

export function buildBench(root, eng) {
  const g = new THREE.Group(); root.add(g);

  // lantai: pelat besi dengan alur T
  const floor = rbox(110, 1.2, 60, 0.3, MAT.floor, -6, FLOOR_Y - 0.6, 0, g);
  floor.receiveShadow = true;
  for (let z = -24; z <= 24; z += 8) box(108, 0.06, 0.9, MAT.black, -6, FLOOR_Y + 0.01, z, g);

  // rangka dudukan mesin di sisi kiri (z = -12,5): dua tiang, rel dasar, penguat diagonal
  const T = 1.3, ZS = -12.5;
  box(T, 6.2 - FLOOR_Y + 1.2, T, MAT.frame, -2.4, (FLOOR_Y + 6.2) / 2 + 0.6, ZS, g);
  box(T, 1.6 - FLOOR_Y + 1.2, T, MAT.frame, -13.6, (FLOOR_Y + 1.6) / 2 + 0.6, ZS, g);
    bar(V3(-13.6, 1.6, ZS), V3(-2.4, 6.2, ZS), T, T, MAT.frame, g);
  bar(V3(-13.6, -8, ZS), V3(-2.4, -1, ZS), T * 0.8, T * 0.8, MAT.frame, g);
  for (const x of [-2.4, -13.6]) {
    box(T, T, 20, MAT.frame, x, FLOOR_Y + 0.65, ZS + 10 - T / 2, g);
    bar(V3(x, FLOOR_Y + 1.2, ZS + 8), V3(x, x === -2.4 ? 2 : -2, ZS + 0.6), T * 0.7, T * 0.7, MAT.frame, g);
  }
  box(14, T, T, MAT.frame, -8, FLOOR_Y + 0.65, ZS, g);
  for (const [x, y] of [[-2.4, 6.2], [-13.6, 1.6]]) {
    rbox(3.0, 3.0, 0.6, 0.2, MAT.steelDark, x, y, ZS + 0.95, g);
    const nut = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.6, 6).rotateX(Math.PI / 2), MAT.steel, g); nut.position.set(x, y, ZS - 0.95);
    const nut2 = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.6, 6).rotateX(Math.PI / 2), MAT.steel, g); nut2.position.set(x, y, 5.1);
  }
  for (const [x, z] of [[-2.4, ZS], [-13.6, ZS], [-2.4, ZS + 19], [-13.6, ZS + 19]]) box(3.0, 0.3, 3.0, MAT.steelDark, x, FLOOR_Y + 0.15, z, g);

  // dinamo arus eddy di belakang
  const dyno = new THREE.Group(); dyno.position.copy(DYNO); g.add(dyno);
  const body = mesh(new THREE.CylinderGeometry(7.4, 7.4, 9.0, 64).rotateX(Math.PI / 2), MAT.dyno, dyno); body.position.z = 1.0;
  for (let i = 0; i < 9; i++) { const f = mesh(new THREE.TorusGeometry(7.45, 0.18, 6, 64), MAT.dyno, dyno); f.position.z = -2.8 + i * 0.95; }
  rbox(13, 1.4, 12, 0.3, MAT.dyno, 0, -7.6, 1.0, dyno);
  for (const x of [-5, 5]) box(1.6, 6.6, 9, MAT.dyno, x, -11.6, 1.0, dyno);
  // lengan torsi dan sel beban
  bar(V3(0, 7.4, 1), V3(9.5, 7.4, 1), 1.0, 1.0, MAT.steelDark, dyno);
  box(1.4, 2.0, 1.4, MAT.accent, 9.5, 5.8, 1, dyno);
  rod(V3(9.5, 4.8, 1), V3(9.5, -10.8, 1), 0.25, MAT.steel, dyno);
  // rotor berventilasi yang terlihat di depan
  const rotor = new THREE.Group(); rotor.position.z = 5.9; dyno.add(rotor);
  zCyl(6.4, 0.5, MAT.gearSteel, 0, 0, 0, rotor, 72);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const v = box(2.4, 0.5, 0.56, MAT.black, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0.02, rotor); v.rotation.z = a; }
  zCyl(1.6, 0.9, MAT.steel, 0, 0, 0.3, rotor, 32);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }));
  label.position.set(0, 4.6, 5.52); dyno.add(label);
  label.material.map = canvasTex(720, 120, (x) => {
    x.fillStyle = '#16231d'; x.fillRect(0, 0, 720, 120); x.strokeStyle = '#e2a20c'; x.lineWidth = 6; x.strokeRect(6, 6, 708, 108);
    x.fillStyle = '#e8c45a'; x.font = '800 54px "Big Shoulders Display", "Arial Narrow", sans-serif'; x.textBaseline = 'middle'; x.fillText('DINAMO ARUS EDDY', 30, 62);
    x.fillStyle = '#c9d2cc'; x.font = '500 26px monospace'; x.textAlign = 'right'; x.fillText('400 N·m', 690, 62);
  });
  // poros, gir belakang 37T, rantai dari gir depan 14T
  zCyl(0.9, 10, MAT.steel, 0, 0, -3.6, dyno, 24);
  const sp = mesh(sprocketGeo(3.74, 37, 0.6), MAT.chain, dyno); sp.position.z = eng.counterSprocketZ;
  const rearHub = zCyl(1.4, 1.2, MAT.steelDark, 0, 0, eng.counterSprocketZ + 0.9, dyno, 24);
  const drive = chainLoop(V2(eng.counter.x, eng.counter.y), 1.6, V2(DYNO.x, DYNO.y), 3.9, eng.counterSprocketZ, g, 1.27, 0.6);

  // kipas pendingin di depan
  const fan = new THREE.Group(); fan.position.set(36, -1.5, 0); fan.rotation.y = -Math.PI / 2; g.add(fan);
  const blades = new THREE.Group(); fan.add(blades);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Shape(); s.moveTo(0.6, -0.8); s.quadraticCurveTo(5, -2.6, 7.6, -0.6); s.quadraticCurveTo(6.6, 1.9, 0.6, 0.8); s.closePath();
    const bg = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 10 });
    const b = mesh(bg, new THREE.MeshStandardMaterial({ color: 0x2b6a8a, metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide }), blades);
    b.rotation.set(0.35, 0, (i / 5) * Math.PI * 2);
  }
  zCyl(1.3, 1.6, MAT.black, 0, 0, -0.3, blades, 24);
  zCyl(2.4, 5.0, MAT.black, 0, 0, -3.6, fan, 32);
  const ringMat = MAT.chrome;
  for (const [r, z] of [[8.6, 1.2], [8.6, -1.4], [6.0, 1.4], [3.4, 1.45]]) mesh(new THREE.TorusGeometry(r, 0.08, 6, 64), ringMat, fan).position.z = z;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; rod(V3(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 1.5), V3(Math.cos(a) * 8.6, Math.sin(a) * 8.6, 1.2), 0.05, ringMat, fan, 4); }
  mesh(new THREE.TorusGeometry(8.6, 0.25, 8, 64), MAT.black, fan).position.z = 0.1;
  rod(V3(39.6, -3.8, 0), V3(39.6, FLOOR_Y + 0.6, 0), 0.7, MAT.black, g);
  const fanBase = mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.8, 40), MAT.black, g); fanBase.position.set(39.6, FLOOR_Y + 0.4, 0);

  // tangki bensin uji dan selang bening ke karbu
  const tank = new THREE.Group(); tank.position.set(-6, 22, -2); g.add(tank);
  rbox(10, 5.6, 7, 1.4, MAT.red, 0, 0, 0, tank);
  zCyl(1.1, 0.8, MAT.chrome, 2.4, 2.9, 0, tank, 24).rotation.x = 0;
  const capm = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 24), MAT.chrome, tank); capm.position.set(2.4, 3.0, 0);
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.6, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.4 }), tank).position.set(-4.0, 0, 3.55);
  box(0.6, 3.0, 0.4, MAT.fuel, -4.0, -0.7, 3.55, tank);
  box(1.2, 1.4, 1.2, MAT.chrome, -2.6, -3.4, 0, tank);
  rod(V3(-6, 19, -2), V3(-6, 11.5, -2), 0.5, MAT.frame, g);
  rod(V3(-6, 11.5, -2), V3(-2.4, 7.0, -2), 0.5, MAT.frame, g);
  const hp = new THREE.CatmullRomCurve3([V3(-8.6, 17.8, -2), V3(-8.4, 14.6, -5.8), V3(1, 9.4, -6.2), V3(6.8, 8.0, -3.4), V3(eng.carbBowl.x - 1.3, eng.carbBowl.y, -0.6)]);
  mesh(new THREE.TubeGeometry(hp, 60, 0.32, 10, false), MAT.hose, g);
  mesh(new THREE.TubeGeometry(hp, 60, 0.16, 6, false), MAT.fuel, g);

  // koil pengapian dan kabel busi
  const coil = new THREE.Group(); coil.position.set(-2.4, 1.0, -10.6); g.add(coil);
  rbox(2.6, 5.0, 2.6, 0.5, MAT.black, 0, 0, 0, coil);
  zCyl(0.6, 1.2, MAT.black, 0, 2.4, 1.0, coil, 16);
  box(0.4, 3.2, 1.6, MAT.steelDark, 0, 0, -1.5, coil);
  const boot = eng.plugBootWorld;
  const lead = new THREE.CatmullRomCurve3([V3(-2.4, 3.4, -9.6), V3(1, 7, -11), V3(boot.x - 2, boot.y + 1.5, boot.z - 3), boot]);
  mesh(new THREE.TubeGeometry(lead, 40, 0.24, 8, false), MAT.rubber, g);

  // plat nama di lantai depan
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.2), new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.35 }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(4, FLOOR_Y + 0.03, 21); g.add(plate);
  const drawPlate = (x) => {
    x.fillStyle = '#1b2620'; x.fillRect(0, 0, 1600, 136); x.strokeStyle = '#d99a06'; x.lineWidth = 6; x.strokeRect(8, 8, 1584, 120);
    x.fillStyle = '#e8b52a'; x.font = '800 66px "Big Shoulders Display", "Arial Narrow", sans-serif'; x.textBaseline = 'middle';
    x.fillText('MEJA UJI · MESIN BEBEK 109,1 CC', 44, 70);
    x.font = '500 30px monospace'; x.textAlign = 'right'; x.fillStyle = '#c9d2cc'; x.fillText('4-TAK · SOHC · 4 PERCEPATAN', 1556, 70);
  };
  plate.material.map = canvasTex(1600, 136, drawPlate);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { plate.material.map = canvasTex(1600, 136, drawPlate); plate.material.needsUpdate = true; });

  g.traverse((o) => { if (o.isMesh && o.material !== MAT.hose) { o.castShadow = true; o.receiveShadow = true; } });

  let rotAng = 0, fanAng = 0;
  return {
    group: g,
    update(st, dt) {
      rotAng += st.out * dt;
      rotor.rotation.z = -rotAng; sp.rotation.z = -rotAng; rearHub.rotation.z = -rotAng;
      drive.update(rotAng * 1.43 * -1);
      fanAng += dt * 24; blades.rotation.z = fanAng;
    },
  };
}
