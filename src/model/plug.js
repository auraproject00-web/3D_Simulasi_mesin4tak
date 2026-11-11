// Busi, percikan listrik di celah elektroda, bunga api, dan inti nyala api yang merambat di ruang bakar.
import * as THREE from 'three';
import { V2, V3, Y_AXIS, MAT, mesh, box, helixGeo, glowTex } from '../kit.js';
import { CYCLE, clamp } from '../sim/engine.js';

export const PLUG_DIR = V3(-0.25, 0.3, -0.92).normalize();
export const PLUG_TIP = V3(0, 15.0, -1.25);
const GAP_TOP = -0.3, GAP_BOT = -0.6;

export function buildPlug(cyl) {
  const plug = new THREE.Group(); cyl.add(plug);
  plug.position.copy(PLUG_TIP); plug.quaternion.setFromUnitVectors(Y_AXIS, PLUG_DIR);
  const gapLocal = PLUG_TIP.clone().addScaledVector(PLUG_DIR, (GAP_TOP + GAP_BOT) / 2);
  mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.8, 14), MAT.nickel, plug).position.y = GAP_TOP + 0.4;
  mesh(new THREE.CylinderGeometry(0.11, 0.26, 0.62, 24), MAT.porcelain, plug).position.y = 0.1;
  box(0.15, 0.82, 0.26, MAT.nickel, 0.43, -0.31, 0, plug);
  box(0.58, 0.14, 0.26, MAT.nickel, 0.16, GAP_BOT - 0.07, 0, plug);
  mesh(new THREE.CylinderGeometry(0.43, 0.43, 3.6, 28), MAT.zinc, plug).position.y = 1.8;
  mesh(helixGeo(15, 0.45, 0.06, 3.3), MAT.zinc, plug).position.y = 0.15;
  const gk = mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 36), MAT.zinc, plug); gk.rotation.x = Math.PI / 2; gk.position.y = 3.7;
  mesh(new THREE.LatheGeometry([V2(0.001, 3.8), V2(0.86, 3.8), V2(0.92, 3.9), V2(0.92, 4.5), V2(0.84, 4.64), V2(0.001, 4.64)], 6), MAT.zinc, plug);
  mesh(new THREE.LatheGeometry([V2(0.001, 4.64), V2(0.66, 4.64), V2(0.7, 4.72), V2(0.62, 4.86), V2(0.66, 4.98), V2(0.55, 5.06), V2(0.001, 5.06)], 36), MAT.zinc, plug);
  const pts = [V2(0.001, 5.0), V2(0.56, 5.0), V2(0.53, 5.22)];
  for (let i = 0; i < 5; i++) { const y = 5.3 + i * 0.34; pts.push(V2(0.46, y), V2(0.53, y + 0.08), V2(0.53, y + 0.17), V2(0.46, y + 0.25)); }
  pts.push(V2(0.43, 7.1), V2(0.36, 7.42), V2(0.22, 7.62), V2(0.001, 7.62));
  mesh(new THREE.LatheGeometry(pts, 48), MAT.porcelain, plug);
  mesh(new THREE.CylinderGeometry(0.565, 0.565, 0.12, 40, 1, true), MAT.red, plug).position.y = 5.12;
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 14), MAT.nickel, plug).position.y = 7.85;
  mesh(new THREE.LatheGeometry([V2(0.001, 8.05), V2(0.3, 8.05), V2(0.35, 8.16), V2(0.24, 8.3), V2(0.35, 8.44), V2(0.3, 8.58), V2(0.001, 8.58)], 28), MAT.nickel, plug);
  mesh(new THREE.LatheGeometry([V2(0.001, 8.25), V2(0.66, 8.25), V2(0.72, 8.7), V2(0.7, 9.6), V2(0.56, 10.3), V2(0.38, 10.6), V2(0.001, 10.6)], 36), MAT.rubber, plug);
  for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 36), MAT.rubber, plug); r.rotation.x = Math.PI / 2; r.position.y = 8.85 + i * 0.3; }

  const add = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = add(0xf2f8ff), glowMat = add(0x4f9bff);
  const arcCore = new THREE.Mesh(new THREE.BufferGeometry(), coreMat), arcGlow = new THREE.Mesh(new THREE.BufferGeometry(), glowMat), arcFork = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
  for (const m of [arcCore, arcGlow, arcFork]) { m.renderOrder = 4; m.frustumCulled = false; plug.add(m); }
  function rebuildArc() {
    const n = 8, p = [];
    for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : Math.sin(t * Math.PI); p.push(V3((Math.random() - 0.5) * 0.16 * j, GAP_TOP + (GAP_BOT - GAP_TOP) * t, (Math.random() - 0.5) * 0.16 * j)); }
    const curve = new THREE.CatmullRomCurve3(p, false, 'catmullrom', 0.05);
    arcCore.geometry.dispose(); arcGlow.geometry.dispose(); arcFork.geometry.dispose();
    arcCore.geometry = new THREE.TubeGeometry(curve, 24, 0.022, 5, false);
    arcGlow.geometry = new THREE.TubeGeometry(curve, 24, 0.075, 8, false);
    const k = 2 + Math.floor(Math.random() * 4), p0 = p[k];
    const f1 = p0.clone().add(V3((Math.random() - 0.5) * 0.22, -0.06 - Math.random() * 0.08, (Math.random() - 0.5) * 0.22));
    const f2 = f1.clone().add(V3((Math.random() - 0.5) * 0.14, -0.04, (Math.random() - 0.5) * 0.14));
    arcFork.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, f1, f2]), 8, 0.012, 4, false);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fd0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.set(1.3, 1.3, 1); halo.position.set(0, (GAP_TOP + GAP_BOT) / 2, 0); halo.renderOrder = 4; plug.add(halo);
  const sparkLight = new THREE.PointLight(0xa9d2ff, 0, 7, 2); sparkLight.position.copy(halo.position); plug.add(sparkLight);

  const EMB = 28, embGeo = new THREE.BufferGeometry();
  embGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMB * 3), 3));
  const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ color: 0xffe6a8, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false; embers.renderOrder = 4; plug.add(embers);
  const embVel = new Float32Array(EMB * 3); let embLife = 1;
  function burst() {
    const p = embGeo.attributes.position.array;
    for (let i = 0; i < EMB; i++) {
      p[i * 3] = (Math.random() - 0.5) * 0.08; p[i * 3 + 1] = GAP_TOP + (GAP_BOT - GAP_TOP) * Math.random(); p[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2.6;
      embVel[i * 3] = Math.cos(a) * sp; embVel[i * 3 + 1] = -0.4 - Math.random() * 1.6; embVel[i * 3 + 2] = Math.sin(a) * sp;
    }
    embGeo.attributes.position.needsUpdate = true; embLife = 0;
  }

  // inti nyala api
  const kGeo = new THREE.SphereGeometry(1, 28, 20);
  { const p = kGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(0.92 + 0.08 * Math.sin(v.x * 5.1 + 1.3) * Math.cos(v.y * 4.3 + v.z * 3.1)); p.setXYZ(i, v.x, v.y, v.z); } kGeo.computeVertexNormals(); }
  const kernelMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const kernel = new THREE.Mesh(kGeo, kernelMat); kernel.renderOrder = 3; cyl.add(kernel);
  const coreK = new THREE.Mesh(kGeo, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreK.renderOrder = 3; cyl.add(coreK);
  const CHAMBER = V3(0, 14.55, 0);
  const flameLight = new THREE.PointLight(0xffa35a, 0, 18, 1.6); flameLight.position.set(0, 14.6, 0.4); cyl.add(flameLight);

  let flash = 0, prev = 0, tick = 0;
  function update(st, dt, slow) {
    const c = ((st.phi % CYCLE) + CYCLE) % CYCLE;
    const ignC = Math.PI * 2 - (st.advance * Math.PI) / 180;
    const since = c - ignC, win = (16 * Math.PI) / 180;
    let k = st.fuel && st.events !== undefined && st.burnQ > 0 && since >= 0 && since < win ? 1 - (since / win) * 0.55 : 0;
    k = Math.max(k, flash);
    flash = Math.max(0, flash - dt * (slow ? 3 : 18));
    if (k > 0.03) {
      if (prev <= 0.03) burst();
      if (!slow || tick++ % 3 === 0) rebuildArc();
      const fl = 0.75 + Math.random() * 0.25;
      coreMat.opacity = k * fl; glowMat.opacity = k * 0.55 * fl; halo.material.opacity = k * 0.9; sparkLight.intensity = k * 22;
    } else { coreMat.opacity = glowMat.opacity = 0; halo.material.opacity = 0; sparkLight.intensity = 0; }
    prev = k;
    if (embLife < 1) {
      embLife += (dt * (slow ? 0.3 : 1)) / 0.35;
      const p = embGeo.attributes.position.array, d = dt * (slow ? 0.3 : 1);
      for (let i = 0; i < EMB * 3; i++) { p[i] += embVel[i] * d * 0.35; embVel[i] *= 1 - d * 4; }
      embGeo.attributes.position.needsUpdate = true;
      embers.material.opacity = Math.max(0, 1 - embLife);
    } else embers.material.opacity = 0;
    const xb = st.burnQ > 0 && c > ignC && c < Math.PI * 2.5 ? st.xb : 0;
    if (xb > 0.0005 || (st.burnQ > 0 && since > 0.02 && since < 0.5)) {
      const grow = Math.max(0.12, Math.pow(xb, 0.45)), r = 0.18 + 2.35 * grow;
      kernel.position.copy(gapLocal).lerp(CHAMBER, Math.min(1, grow * 0.75));
      kernel.scale.setScalar(r); coreK.position.copy(kernel.position); coreK.scale.setScalar(r * 0.55);
      kernel.rotation.z += 0.07; kernel.rotation.y += 0.05; coreK.rotation.copy(kernel.rotation);
      kernel.scale.y = r * 0.8; coreK.scale.y = r * 0.45;
      const fade = Math.pow(1 - xb, 0.8); kernelMat.opacity = 0.42 * fade; coreK.material.opacity = 0.32 * fade * fade;
    } else { kernelMat.opacity = 0; coreK.material.opacity = 0; }
    const bar = st.p / 1e5, stroke = Math.floor(c / Math.PI);
    flameLight.intensity = st.burnQ > 0 && (stroke === 2 || (stroke === 1 && st.xb > 0.01)) ? clamp(bar / 40, 0, 1) * 120 : 0;
  }
  return {
    group: plug, gapLocal, update, spark() { flash = 1; },
    setVisible(v) { kernel.visible = coreK.visible = v; flameLight.visible = v; sparkLight.visible = v; },
    clipMats: [kernelMat, coreK.material],
  };
}
