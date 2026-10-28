import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/*SIM*/

const $ = (id) => document.getElementById(id);
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CR = SPEC.stroke * 50;           // jari-jari engkol, cm
const ROD = SPEC.rod * 100;            // panjang stang seher, cm
const CYCLE = Math.PI * 4;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const sim = createSim();
const st = sim.state;

/* ---------- renderer & scene ---------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.6;
controls.enablePan = true;
const VIEW_DIR = V3(0.42, 0.27, 0.87).normalize();
function resetView() {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  const dist = aspect < 0.8 ? 112 : aspect < 1.2 ? 92 : 74;
  controls.target.set(2.5, 7, 0);
  camera.position.copy(controls.target).addScaledVector(VIEW_DIR, dist);
  controls.update();
}

scene.environmentIntensity = 0.85;
scene.fog = new THREE.Fog(0xd7dfd8, 190, 380);
scene.add(new THREE.HemisphereLight(0xf4f8f2, 0x3d4a42, 0.45));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.6);
sun.position.set(22, 44, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 34, bottom: -34, near: 1, far: 150 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe4efff, 0.55);
fill.position.set(-26, 10, 34);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xcfe3ff, 1.1);
rim.position.set(-30, 18, -25);
scene.add(rim);

/* ---------- tekstur prosedural ---------- */
function perforation() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#000';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 4.6, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3);
  return t;
}
function nameplate(mat) {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 120;
  const draw = () => {
    const x = c.getContext('2d');
    x.fillStyle = '#1b2620'; x.fillRect(0, 0, 1600, 120);
    x.strokeStyle = '#d99a06'; x.lineWidth = 6; x.strokeRect(10, 10, 1580, 100);
    x.fillStyle = '#e8b52a'; x.font = '800 62px "Big Shoulders Display", "Arial Narrow", sans-serif'; x.textBaseline = 'middle';
    x.fillText('MEJA UJI · MESIN 1 SILINDER 109 CC', 46, 62);
    x.font = '500 30px "Martian Mono", monospace'; x.textAlign = 'right'; x.fillStyle = '#c9d2cc';
    x.fillText('4-TAK · SOHC · No. 03', 1554, 62);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  mat.map = tex; mat.needsUpdate = true;
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
}

/* ---------- materials ---------- */
const cutPlane = new THREE.Plane(V3(0, 0, -1), 0);   // simpan z <= 0
const housing = [];
function sectioned(params) {
  const m = new THREE.MeshStandardMaterial();
  m.side = THREE.DoubleSide;
  const grain = params.grain ?? 1; delete params.grain;
  m.setValues(params);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (castN - 0.5) * 0.32 * ${grain.toFixed(2)}, 0.06, 1.0);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float castN = vn(vWPos * 2.6) * 0.55 + vn(vWPos * 9.0) * 0.3 + vn(vWPos * 31.0) * 0.15;
      diffuseColor.rgb *= 1.0 + (castN - 0.5) * 0.16 * ${grain.toFixed(2)};
      if (!gl_FrontFacing) {
        float h = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0));
        diffuseColor.rgb = mix(vec3(0.95, 0.66, 0.08), vec3(0.42, 0.25, 0.02), h * 0.75);
      }`);
  };
  housing.push(m);
  return m;
}
const alu = sectioned({ color: 0xcdd0ca, metalness: 0.62, roughness: 0.42 });
const aluDark = sectioned({ color: 0xb3b8b2, metalness: 0.7, roughness: 0.3, grain: 0.6 });
const aluCase = sectioned({ color: 0x626a66, metalness: 0.45, roughness: 0.55, grain: 0.8 });
const coverMat = sectioned({ color: 0xd8dbd6, metalness: 0.85, roughness: 0.2, grain: 0.35 });
const boltMat = sectioned({ color: 0x9aa09b, metalness: 0.9, roughness: 0.28, grain: 0 });
const rubberSec = sectioned({ color: 0x1d201f, metalness: 0.1, roughness: 0.8, grain: 0.4 });
const steel = new THREE.MeshStandardMaterial({ color: 0xd9dcd8, metalness: 0.9, roughness: 0.24 });
const steelDark = new THREE.MeshStandardMaterial({ color: 0x5d625f, metalness: 0.85, roughness: 0.35 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x1f2321, metalness: 0.3, roughness: 0.6 });
const chainMat = new THREE.MeshStandardMaterial({ color: 0x3a3f3c, metalness: 0.8, roughness: 0.4 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc89b45, metalness: 0.85, roughness: 0.3 });
const springMat = new THREE.MeshStandardMaterial({ color: 0x4d7a57, metalness: 0.6, roughness: 0.4 });
const porcelain = new THREE.MeshStandardMaterial({ color: 0xf1efe8, metalness: 0.0, roughness: 0.25 });
const benchMat = new THREE.MeshStandardMaterial({ color: 0x46604f, metalness: 0.2, roughness: 0.62 });
const benchTop = new THREE.MeshStandardMaterial({ color: 0x7b8780, metalness: 0.75, roughness: 0.38 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8e6, metalness: 1.0, roughness: 0.12 });
const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x40403c, metalness: 0.7, roughness: 0.42 });
const discMat = new THREE.MeshStandardMaterial({ color: 0xa9aca8, metalness: 0.9, roughness: 0.3, emissive: 0x000000 });
const discHole = new THREE.MeshStandardMaterial({ color: 0x222524, metalness: 0.5, roughness: 0.6 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0xe2a20c, metalness: 0.2, roughness: 0.5 });
const gasMat = new THREE.MeshBasicMaterial({ color: 0x4c8cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function mesh(geo, mat, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = shadow;
  parent.add(m);
  return m;
}
// silinder sepanjang sumbu z
function zCyl(r, len, mat, x, y, z, parent = scene, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  const m = mesh(g, mat, parent); m.position.set(x, y, z);
  return m;
}
function box(w, h, d, mat, x, y, z, parent = scene) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat, parent); m.position.set(x, y, z);
  return m;
}
function rbox(w, h, d, r, mat, x, y, z, parent = scene) {
  const m = mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat, parent); m.position.set(x, y, z);
  return m;
}
// sirip pendingin persegi dengan lubang bulat, tebal t ke arah +y
function finPlate(y, t, hx, zf, zb, holeR, mat, rr = 0.9) {
  const s = new THREE.Shape();
  const x0 = -hx, x1 = hx, y0 = -zf, y1 = -zb; // sy = -z
  s.moveTo(x0 + rr, y0); s.lineTo(x1 - rr, y0); s.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - rr); s.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x0 + rr, y1); s.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + rr); s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 1, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return mesh(g, mat, engine);
}
function bolt(x, y, z, axis, parent) {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.42, 6);
  if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  const m = mesh(g, boltMat, parent || engine); m.position.set(x, y, z);
  return m;
}
// batang di antara dua titik
function bar(a, b, w, d, mat, parent) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.BoxGeometry(w, len, d), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function gear(r, teeth, depth, mat) {
  const s = new THREE.Shape();
  const n = teeth * 2;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.88;
    const p = [Math.cos(a) * rr, Math.sin(a) * rr];
    i === 0 ? s.moveTo(...p) : s.lineTo(...p);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.35, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

/* ---------- crankcase, barrel, head ---------- */
const engine = new THREE.Group();
scene.add(engine);

{ // bak mesin
  // dinding berbentuk U (terbuka ke atas untuk lubang silinder), lalu dua tutup samping
  const oa = Math.atan2(2.0, 5.9), ia = Math.atan2(1.8, 5.3);
  const wall = new THREE.Shape();
  wall.moveTo(-2.6, 4.8); wall.lineTo(-4.0, 4.8); wall.lineTo(-5.9, 2.0);
  wall.absarc(0, 0, 6.25, Math.PI - oa, oa, false);
  wall.lineTo(4.0, 4.8); wall.lineTo(2.6, 4.8); wall.lineTo(3.6, 4.2); wall.lineTo(5.3, 1.8);
  wall.absarc(0, 0, 5.65, ia, Math.PI - ia, true);
  wall.lineTo(-3.6, 4.2); wall.lineTo(-2.6, 4.8);
  const wg = new THREE.ExtrudeGeometry(wall, { depth: 8.55, bevelEnabled: false, curveSegments: 48 });
  wg.translate(0, 0, -5.4);
  mesh(wg, aluCase, engine);
  const s = new THREE.Shape();
  s.moveTo(-4.0, 4.8); s.lineTo(4.0, 4.8); s.lineTo(5.9, 2.0);
  s.absarc(0, 0, 6.25, oa, Math.PI - oa, true);
  s.lineTo(-4.0, 4.8);
  for (const z of [-5.4, 2.55]) {
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 48 });
    g.translate(0, 0, z);
    mesh(g, aluCase, engine);
  }
  // bak transmisi di belakang kruk as
  const gb = mesh(new THREE.CylinderGeometry(3.9, 3.9, 8.0, 56), aluCase, engine);
  gb.rotation.x = Math.PI / 2; gb.position.set(-8.6, -1.9, -0.9);
  rbox(3.6, 7.4, 8.0, 0.6, aluCase, -7.0, -1.6, -0.9, engine);
  // tutup kopling (kanan, menghadap depan)
  const cs = new THREE.Shape(); cs.absarc(0, 0, 4.7, 0, Math.PI * 2, false);
  const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.55, bevelSegments: 5, curveSegments: 64 });
  const clutch = mesh(cg, coverMat, engine); clutch.position.set(-2.4, -0.9, 3.25);
  const ks = new THREE.Shape(); ks.absarc(0, 0, 2.2, 0, Math.PI * 2, false);
  const kg = new THREE.ExtrudeGeometry(ks, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 40 });
  mesh(kg, coverMat, engine).position.set(-8.6, -1.9, 3.15);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; bolt(-2.4 + Math.cos(a) * 4.45, -0.9 + Math.sin(a) * 4.45, 4.55, 'z'); }
  // tuas selah (kick starter)
  const kick = new THREE.Group(); kick.position.set(-8.6, -1.9, 4.2); kick.rotation.z = -0.55; engine.add(kick);
  mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 20).rotateX(Math.PI / 2), rubberSec, kick);
  rbox(0.9, 6.8, 0.6, 0.25, rubberSec, 0, -3.3, 0.35, kick);
  rbox(1.0, 1.0, 3.2, 0.3, rubberSec, 0, -6.6, 1.5, kick);
  // baut belahan bak mesin
  for (const [x, y] of [[-4.3, 3.6], [4.3, 3.6], [5.6, -1.2], [3.0, -5.0], [-12.2, -1.9], [-8.6, 1.9], [-8.6, -5.7]]) bolt(x, y, 3.3, 'z');
  // dudukan mesin
  rbox(1.8, 2.6, 4.0, 0.3, steelDark, -2.6, -6.9, -0.7, engine);
  rbox(1.8, 2.6, 4.0, 0.3, steelDark, 3.4, -6.9, -0.7, engine);
  rbox(1.8, 3.2, 4.0, 0.3, steelDark, -9.6, -6.6, -0.9, engine);
}

const FIN_SKIP = 0.62; // celah sirip untuk terowongan rantai di belakang
function ringLathe(r0, r1, y0, y1, mat, partial = true) {
  const pts = [V2(r0, y0), V2(r1, y0 + 0.04), V2(r1, y1 - 0.04), V2(r0, y1)];
  const g = partial
    ? new THREE.LatheGeometry(pts, 52, Math.PI + FIN_SKIP, Math.PI * 2 - FIN_SKIP * 2)
    : new THREE.LatheGeometry(pts, 52);
  return mesh(g, mat, engine);
}
{ // blok silinder
  const ri = 2.5, ro = 3.15, yb = 4.6, yt = 14.2;
  const wall = [V2(ri, yb), V2(ro + 0.45, yb), V2(ro + 0.45, yb + 0.55), V2(ro, yb + 0.85), V2(ro, yt - 0.4), V2(ro + 0.45, yt - 0.3), V2(ro + 0.45, yt), V2(ri, yt), V2(ri, yb)];
  mesh(new THREE.LatheGeometry(wall, 56), alu, engine);
  for (let y = 5.8, i = 0; y < 13.5; y += 0.84, i++) {
    const k = Math.sin((i / 9) * Math.PI);
    finPlate(y, 0.3, 4.7 + 0.7 * k, 4.2 + 0.5 * k, -2.95, ro - 0.05, alu, 0.8);
  }
  // gasket
  const gk = [V2(ri, 14.2), V2(4.4, 14.2), V2(4.4, 14.35), V2(ri, 14.35), V2(ri, 14.2)];
  mesh(new THREE.LatheGeometry(gk, 56), aluDark, engine);
}
{ // kepala silinder dengan ruang bakar kubah
  const pts = [V2(2.5, 14.35), V2(4.3, 14.35), V2(4.3, 19.2), V2(0.001, 19.2), V2(0.001, 15.25)];
  for (let a = 4; a <= 90; a += 4) { const t = (a * Math.PI) / 180; pts.push(V2(2.5 * Math.sin(t), 14.35 + 0.9 * Math.cos(t))); }
  mesh(new THREE.LatheGeometry(pts, 56), alu, engine);
  for (let y = 14.85, i = 0; y < 18.8; y += 0.8, i++) finPlate(y, 0.3, 5.6 - i * 0.12, 5.0 - i * 0.1, -2.95, 4.25, alu, 1.0);
  // tutup klep & terowongan rantai
  rbox(8.6, 4.3, 6.2, 0.7, coverMat, 0, 21.1, 0, engine);
  for (const z of [-1.6, 0, 1.6]) rbox(6.4, 0.35, 0.5, 0.15, coverMat, 0, 23.35, z, engine);
  rbox(6.6, 19.8, 2.5, 0.55, aluCase, 0, 14.4, -4.05, engine);
  // tutup setelan klep bulat di kiri-kanan
  for (const sx of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.9, 40), coverMat, engine);
    cap.rotation.z = Math.PI / 2; cap.position.set(sx * 4.55, 20.5, 0);
    const hex = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 6), boltMat, engine);
    hex.rotation.z = Math.PI / 2; hex.position.set(sx * 5.2, 20.5, 0);
  }
  // baut kepala
  for (const [x, z] of [[-3.5, 2.5], [3.5, 2.5], [-3.5, -2.5], [3.5, -2.5]]) bolt(x, 23.45, z, 'y');
  // tutup sprocket kem di belakang
  const cc = mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 40), coverMat, engine);
  cc.rotation.x = Math.PI / 2; cc.position.set(0, 20.9, -5.55);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; bolt(Math.cos(a) * 1.85, 20.9 + Math.sin(a) * 1.85, -5.9, 'z'); }
}

/* ---------- moving parts ---------- */
// gas di dalam silinder
const gasGeo = new THREE.CylinderGeometry(2.46, 2.46, 1, 40);
const gas = mesh(gasGeo, gasMat, engine, false);
gas.renderOrder = 2;

const piston = new THREE.Group(); engine.add(piston);
{
  const g = new THREE.CylinderGeometry(2.47, 2.47, 4.8, 48);
  const p = mesh(g, steel, piston); p.position.y = -0.2;
  for (const y of [1.65, 1.25, 0.85]) {
    const ring = mesh(new THREE.TorusGeometry(2.47, 0.07, 6, 48), steelDark, piston); ring.rotation.x = Math.PI / 2; ring.position.y = y;
  }
  zCyl(0.62, 4.4, steelDark, 0, 0, 0, piston);
}

const crank = new THREE.Group(); engine.add(crank);
{
  const s = new THREE.Shape();
  s.moveTo(1.45, CR); s.absarc(0, CR, 1.45, 0, Math.PI, false);
  const a0 = (200 * Math.PI) / 180, a1 = (340 * Math.PI) / 180;
  s.lineTo(3.5 * Math.cos(a0), 3.5 * Math.sin(a0));
  s.absarc(0, 0, 3.5, a0, a1, false);
  s.lineTo(1.45, CR);
  for (const z of [-1.35, 1.35]) {
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 32 });
    g.translate(0, 0, z - 0.45);
    mesh(g, steelDark, crank);
  }
  zCyl(0.85, 2.2, steel, 0, CR, 0, crank);           // pena engkol
  zCyl(1.15, 5.6, steel, 0, 0, -4.5, crank);          // poros kiri
  zCyl(1.15, 2.2, steel, 0, 0, 2.9, crank);           // poros kanan
  zCyl(0.9, 13.6, steel, 0, 0, 4.0, crank);            // poros keluaran
  const sp = gear(1.35, 14, 0.5, chainMat); sp.position.z = -4.2; crank.add(sp);
  // magnet roda gila
  const fw = zCyl(5.4, 1.5, steelDark, 0, 0, -6.8, crank, 64);
  const ring = mesh(new THREE.TorusGeometry(5.0, 0.22, 8, 64), steel, crank); ring.position.z = -7.58;
  zCyl(1.6, 0.6, steel, 0, 0, -7.7, crank);
  box(0.5, 2.6, 0.12, accentMat, 0, 3.7, -7.62, crank); // tanda T (TMA)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const h = zCyl(0.55, 0.3, blackMat, Math.cos(a) * 2.9, Math.sin(a) * 2.9, -7.6, crank, 16);
  }
  fw.receiveShadow = true;
  // gir depan & cakram rem dinamo
  const front = gear(2.0, 15, 0.55, chainMat); front.position.z = 5.6; crank.add(front);
  const disc = zCyl(4.9, 0.38, discMat, 0, 0, 7.2, crank, 72);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    zCyl(0.32, 0.5, blackMat, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 7.2, crank, 12);
    zCyl(0.42, 0.42, discHole, Math.cos(a + 0.39) * 2.6, Math.sin(a + 0.39) * 2.6, 7.2, crank, 12);
  }
}

const rod = new THREE.Group(); engine.add(rod);
{
  const big = mesh(new THREE.TorusGeometry(1.25, 0.42, 12, 32), steel, rod);
  const small = mesh(new THREE.TorusGeometry(0.85, 0.3, 10, 24), steel, rod); small.position.y = ROD;
  const beam = mesh(new THREE.BoxGeometry(0.8, ROD - 2.4, 0.7), steel, rod); beam.position.y = ROD / 2 + 0.2;
  box(1.2, ROD - 3.2, 0.35, steel, 0, ROD / 2 + 0.1, 0, rod);
  box(3.4, 0.45, 0.9, steelDark, 0, -1.55, 0, rod);
}

/* ---------- klep, pegas, kem, pelatuk ---------- */
const TILT = (18 * Math.PI) / 180;
const valveDef = [
  { name: 'in', seat: V3(-1.25, 15.05, 0), dir: V3(-Math.sin(TILT), Math.cos(TILT), 0), lift: intakeLift, pivot: V3(-1.75, 21.55, 0.55), camAng: (125 * Math.PI) / 180, peak: (107.5 * Math.PI) / 180, sign: 1, z: 0.55 },
  { name: 'ex', seat: V3(1.25, 15.05, 0), dir: V3(Math.sin(TILT), Math.cos(TILT), 0), lift: exhaustLift, pivot: V3(1.75, 21.55, -0.55), camAng: (55 * Math.PI) / 180, peak: (615 * Math.PI) / 180, sign: -1, z: -0.55 },
];
const STEM = 5.2;
const CAM_C = V3(0, 20.9, 0);
const CAM_BASE = 0.95;

function helix(turns, radius, wire, height = 1) {
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) {
    const t = i / (turns * 24), a = t * turns * Math.PI * 2;
    pts.push(V3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, wire, 6, false);
}
const yAxis = V3(0, 1, 0);
const camshaft = new THREE.Group(); camshaft.position.copy(CAM_C); engine.add(camshaft);
zCyl(0.45, 5.8, steel, 0, 0, -1.6, camshaft);
{
  const sp = gear(2.7, 28, 0.5, chainMat); sp.position.z = -4.2; camshaft.add(sp);
  box(0.3, 2.2, 0.08, accentMat, 0, 1.4, -3.92, camshaft);
}
for (const v of valveDef) {
  const g = new THREE.Group(); engine.add(g);
  const head = mesh(new THREE.CylinderGeometry(0.95, 0.75, 0.22, 32), steel, g); head.position.y = 0.0;
  const stem = mesh(new THREE.CylinderGeometry(0.17, 0.17, STEM, 12), steel, g); stem.position.y = STEM / 2;
  const ret = mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.22, 20), steelDark, g); ret.position.y = STEM - 0.35;
  g.quaternion.setFromUnitVectors(yAxis, v.dir);
  v.group = g;
  v.top = v.seat.clone().addScaledVector(v.dir, STEM);
  // pegas
  const sp = mesh(helix(6, 0.48, 0.07), springMat, engine);
  sp.quaternion.setFromUnitVectors(yAxis, v.dir);
  v.springBase = v.seat.clone().addScaledVector(v.dir, 2.35);
  sp.position.copy(v.springBase);
  v.spring = sp;
  // lobe kem: hidung menghadap +x lokal
  const s = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const k = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    const lobe = k < 1.05 ? Math.pow(Math.cos((k / 1.05) * Math.PI / 2), 2) : 0;
    const r = CAM_BASE + 0.42 * lobe;
    const p = [Math.cos(a) * r, Math.sin(a) * r];
    i === 0 ? s.moveTo(...p) : s.lineTo(...p);
  }
  const lg = new THREE.ExtrudeGeometry(s, { depth: 0.75, bevelEnabled: false });
  lg.translate(0, 0, v.z - 0.375);
  const lobe = new THREE.Mesh(lg, steel); lobe.castShadow = true;
  const lw = new THREE.Group(); lw.add(lobe); camshaft.add(lw);
  v.lobe = lw;
  // pelatuk (rocker)
  const rk = new THREE.Group(); rk.position.copy(v.pivot); engine.add(rk);
  const camEnd = V3(Math.cos(v.camAng) * CAM_BASE, Math.sin(v.camAng) * CAM_BASE, 0).add(CAM_C).setZ(v.z);
  const valveEnd = v.top.clone().addScaledVector(v.dir, 0.12).setZ(v.z);
  const P = v.pivot;
  bar(V3(0, 0, 0), camEnd.clone().sub(P), 0.5, 0.6, steelDark, rk);
  bar(V3(0, 0, 0), valveEnd.clone().sub(P), 0.5, 0.6, steelDark, rk);
  const pad = mesh(new THREE.BoxGeometry(0.5, 0.3, Math.abs(v.z) * 2 + 0.4), steelDark, rk);
  pad.position.copy(valveEnd.clone().sub(P)).setZ(-v.z);
  zCyl(0.32, 1.0, steel, 0, 0, 0, rk, 16);
  v.rocker = rk;
  v.lever = valveEnd.distanceTo(P);
  zCyl(0.2, 6.4, steelDark, P.x, P.y, -1.0, engine, 12);
}

/* ---------- rantai keteng ---------- */
const chain = (() => {
  const raw = [];
  const add = (cx, cy, r) => { for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; raw.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  add(0, 0, 1.35 + 0.15); add(CAM_C.x, CAM_C.y, 2.7 + 0.15);
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of raw) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = raw.length - 1; i >= 0; i--) { const p = raw[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  const seg = []; let total = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push({ a, b, l, s: total }); total += l;
  }
  const count = Math.round(total / 0.62);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.56, 0.22, 0.5), chainMat, count);
  im.castShadow = true; engine.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = V3(0, 0, 0), sc = V3(1, 1, 1);
  function at(s) {
    s = ((s % total) + total) % total;
    let lo2 = 0, hi = seg.length - 1;
    while (lo2 < hi) { const m = (lo2 + hi + 1) >> 1; if (seg[m].s <= s) lo2 = m; else hi = m - 1; }
    const g = seg[lo2], t = (s - g.s) / g.l;
    return { x: g.a[0] + (g.b[0] - g.a[0]) * t, y: g.a[1] + (g.b[1] - g.a[1]) * t, ang: Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) };
  }
  return {
    update(theta) {
      const off = -theta * 1.5;
      for (let i = 0; i < count; i++) {
        const p = at(off + (i / count) * total);
        pos.set(p.x, p.y, -4.2); q.setFromAxisAngle(V3(0, 0, 1), p.ang);
        m4.compose(pos, q, sc); im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
})();

/* ---------- busi ---------- */
const PLUG_DIR = V3(-0.85, 0.42, -0.32).normalize();
const PLUG_TIP = V3(0, 15.0, -1.3);          // dasar ulir, rata dengan kubah ruang bakar
const GAP_TOP = -0.3, GAP_BOT = -0.6;        // ujung elektroda tengah dan elektroda massa (lokal busi)
const GAP_WORLD = PLUG_TIP.clone().addScaledVector(PLUG_DIR, (GAP_TOP + GAP_BOT) / 2);
const plug = new THREE.Group(); engine.add(plug);
plug.position.copy(PLUG_TIP); plug.quaternion.setFromUnitVectors(yAxis, PLUG_DIR);
const nickel = new THREE.MeshStandardMaterial({ color: 0xbdb8ab, metalness: 0.95, roughness: 0.32 });
const zinc = new THREE.MeshStandardMaterial({ color: 0xdadcd4, metalness: 0.92, roughness: 0.2 });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x2a2523, metalness: 0.05, roughness: 0.55 });
{
  // elektroda tengah dan hidung isolator
  mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.8, 14), nickel, plug).position.y = GAP_TOP + 0.4;
  mesh(new THREE.CylinderGeometry(0.11, 0.26, 0.62, 24), porcelain, plug).position.y = 0.1;
  // elektroda massa berbentuk L, dilas ke ujung badan
  box(0.15, 0.82, 0.26, nickel, 0.43, -0.31, 0, plug);
  box(0.58, 0.14, 0.26, nickel, 0.16, GAP_BOT - 0.07, 0, plug);
  // badan berulir
  mesh(new THREE.CylinderGeometry(0.43, 0.43, 3.6, 28), zinc, plug).position.y = 1.8;
  mesh(helix(15, 0.45, 0.06, 3.3), zinc, plug).position.y = 0.15;
  mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 28), zinc, plug).position.y = 0.0;
  // cincin perapat
  const gk = mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 36), zinc, plug); gk.rotation.x = Math.PI / 2; gk.position.y = 3.7;
  // segi enam kunci busi dan lipatan
  const hx = [V2(0.001, 3.8), V2(0.86, 3.8), V2(0.92, 3.9), V2(0.92, 4.5), V2(0.84, 4.64), V2(0.001, 4.64)];
  mesh(new THREE.LatheGeometry(hx, 6), zinc, plug);
  const cr = [V2(0.001, 4.64), V2(0.66, 4.64), V2(0.7, 4.72), V2(0.62, 4.86), V2(0.66, 4.98), V2(0.55, 5.06), V2(0.001, 5.06)];
  mesh(new THREE.LatheGeometry(cr, 36), zinc, plug);
  // isolator keramik bergerigi
  const pts = [V2(0.001, 5.0), V2(0.56, 5.0), V2(0.53, 5.22)];
  for (let i = 0; i < 5; i++) { const y = 5.3 + i * 0.34; pts.push(V2(0.46, y), V2(0.53, y + 0.08), V2(0.53, y + 0.17), V2(0.46, y + 0.25)); }
  pts.push(V2(0.43, 7.1), V2(0.36, 7.42), V2(0.22, 7.62), V2(0.001, 7.62));
  mesh(new THREE.LatheGeometry(pts, 48), porcelain, plug);
  // pita merah di leher isolator
  const band = mesh(new THREE.CylinderGeometry(0.565, 0.565, 0.12, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xb2341c, roughness: 0.4 }), plug);
  band.position.y = 5.12;
  // batang & mur terminal
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 14), nickel, plug).position.y = 7.85;
  const tn = [V2(0.001, 8.05), V2(0.3, 8.05), V2(0.35, 8.16), V2(0.24, 8.3), V2(0.35, 8.44), V2(0.3, 8.58), V2(0.001, 8.58)];
  mesh(new THREE.LatheGeometry(tn, 28), nickel, plug);
  // cop busi karet, setengah terpasang supaya isolator terlihat
  const bt = [V2(0.001, 8.25), V2(0.66, 8.25), V2(0.72, 8.7), V2(0.7, 9.6), V2(0.56, 10.3), V2(0.38, 10.6), V2(0.001, 10.6)];
  mesh(new THREE.LatheGeometry(bt, 36), bootMat, plug);
  for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 36), bootMat, plug); r.rotation.x = Math.PI / 2; r.position.y = 8.85 + i * 0.3; }
  const wire = new THREE.CatmullRomCurve3([V3(0, 10.4, 0), V3(0, 12.0, 0.3), V3(1.4, 13.6, 1.6), V3(4.2, 14.2, 3.6)]);
  mesh(new THREE.TubeGeometry(wire, 28, 0.24, 10, false), bootMat, plug);
}
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const additive = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
// loncatan api listrik di celah elektroda
const arcCoreMat = additive(0xf2f8ff), arcGlowMat = additive(0x4f9bff);
const arcCore = new THREE.Mesh(new THREE.BufferGeometry(), arcCoreMat);
const arcGlow = new THREE.Mesh(new THREE.BufferGeometry(), arcGlowMat);
const arcFork = new THREE.Mesh(new THREE.BufferGeometry(), arcCoreMat);
for (const m of [arcCore, arcGlow, arcFork]) { m.renderOrder = 4; m.frustumCulled = false; plug.add(m); }
function rebuildArc() {
  const n = 8, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : Math.sin(t * Math.PI);
    pts.push(V3((Math.random() - 0.5) * 0.16 * j, GAP_TOP + (GAP_BOT - GAP_TOP) * t, (Math.random() - 0.5) * 0.16 * j));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
  arcCore.geometry.dispose(); arcGlow.geometry.dispose(); arcFork.geometry.dispose();
  arcCore.geometry = new THREE.TubeGeometry(curve, 24, 0.022, 5, false);
  arcGlow.geometry = new THREE.TubeGeometry(curve, 24, 0.075, 8, false);
  const k = 2 + Math.floor(Math.random() * 4), p0 = pts[k];
  const f1 = p0.clone().add(V3((Math.random() - 0.5) * 0.22, -0.06 - Math.random() * 0.08, (Math.random() - 0.5) * 0.22));
  const f2 = f1.clone().add(V3((Math.random() - 0.5) * 0.14, -0.04, (Math.random() - 0.5) * 0.14));
  arcFork.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, f1, f2]), 8, 0.012, 4, false);
}
const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fd0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
spark.scale.set(1.3, 1.3, 1); spark.position.set(0, (GAP_TOP + GAP_BOT) / 2, 0); spark.renderOrder = 4; plug.add(spark);
const sparkLight = new THREE.PointLight(0xa9d2ff, 0, 7, 2); sparkLight.position.copy(spark.position); plug.add(sparkLight);
// percikan bunga api kecil
const EMB = 28;
const embGeo = new THREE.BufferGeometry();
embGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMB * 3), 3));
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ color: 0xffe6a8, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
embers.frustumCulled = false; embers.renderOrder = 4; plug.add(embers);
const embVel = new Float32Array(EMB * 3);
let embLife = 1;
function burstEmbers() {
  const p = embGeo.attributes.position.array;
  for (let i = 0; i < EMB; i++) {
    p[i * 3] = (Math.random() - 0.5) * 0.08; p[i * 3 + 1] = GAP_TOP + (GAP_BOT - GAP_TOP) * Math.random(); p[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2.6;
    embVel[i * 3] = Math.cos(a) * sp; embVel[i * 3 + 1] = -0.4 - Math.random() * 1.6; embVel[i * 3 + 2] = Math.sin(a) * sp;
  }
  embGeo.attributes.position.needsUpdate = true; embLife = 0;
}
function updateEmbers(dt) {
  if (embLife >= 1) { embers.material.opacity = 0; return; }
  embLife += dt / 0.35;
  const p = embGeo.attributes.position.array;
  for (let i = 0; i < EMB * 3; i++) { p[i] += embVel[i] * dt * 0.35; embVel[i] *= 1 - dt * 4; }
  embGeo.attributes.position.needsUpdate = true;
  embers.material.opacity = Math.max(0, 1 - embLife);
}
// inti nyala api yang merambat dari busi ke seluruh ruang bakar
const kernelGeo = new THREE.IcosahedronGeometry(1, 3);
{ const p = kernelGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(0.85 + 0.3 * Math.abs(Math.sin(v.x * 7.1) * Math.cos(v.y * 5.3 + v.z * 3.7))); p.setXYZ(i, v.x, v.y, v.z); } kernelGeo.computeVertexNormals(); }
const kernelMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const kernel = new THREE.Mesh(kernelGeo, kernelMat); kernel.renderOrder = 3; engine.add(kernel);
const kernelCore = new THREE.Mesh(kernelGeo, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
kernelCore.renderOrder = 3; engine.add(kernelCore);
const CHAMBER_C = V3(0, 14.55, 0);
const flameLight = new THREE.PointLight(0xffa35a, 0, 18, 1.6);
flameLight.position.set(0, 14.6, 0.4); engine.add(flameLight);

/* ---------- karburator & saringan udara ---------- */
const slide = new THREE.Group(); engine.add(slide);
{
  const intake = new THREE.CatmullRomCurve3([V3(-3.6, 16.4, 0), V3(-5.0, 16.2, 0), V3(-6.6, 16.0, 0)]);
  mesh(new THREE.TubeGeometry(intake, 12, 1.05, 20, false), aluDark, engine);
  const body = mesh(new THREE.CylinderGeometry(1.35, 1.35, 3.4, 28), alu, engine);
  body.rotation.z = Math.PI / 2; body.position.set(-8.3, 16.0, 0);
  const bell = mesh(new THREE.CylinderGeometry(1.15, 1.25, 3.0, 28), alu, engine); bell.position.set(-8.3, 18.0, 0);
  mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.2, 28), aluDark, engine).position.set(-8.3, 13.9, 0);
  const sv = mesh(new THREE.CylinderGeometry(0.82, 0.82, 2.4, 24), brass, slide); sv.position.y = 0;
  mesh(new THREE.CylinderGeometry(0.12, 0.05, 2.0, 8), steel, slide).position.y = -2.0;
  slide.position.set(-8.3, 16.5, 0);
  const sk = mesh(new THREE.CylinderGeometry(1.4, 1.2, 1.6, 28), blackMat, engine); sk.rotation.z = Math.PI / 2; sk.position.set(-10.6, 16.0, 0);
  rbox(4.6, 5.8, 6.4, 0.8, blackMat, -13.4, 16.6, 0, engine);
  const cable = new THREE.CatmullRomCurve3([V3(-8.3, 19.5, 0), V3(-8.3, 21.5, 0), V3(-9.5, 24.5, -1.5), V3(-13, 26, -3)]);
  mesh(new THREE.TubeGeometry(cable, 30, 0.2, 8, false), blackMat, engine);
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 16), boltMat, engine).position.set(-8.3, 19.75, 0);
  for (let i = 0; i < 6; i++) box(0.12, 4.4, 5.0, accentMat, -15.65, 16.6, -2.5 + i, engine).scale.set(1, 1, 0.18);
}

/* ---------- knalpot ---------- */
const TAIL = V3(21.6, -1.4, 3.2);
{
  const path = new THREE.CatmullRomCurve3([V3(3.9, 16.3, 0), V3(6.6, 16.6, 0.6), V3(8.6, 13.0, 1.6), V3(9.4, 7.0, 2.6), V3(10.0, 1.4, 3.2), V3(12.0, -1.0, 3.2), V3(13.2, -1.4, 3.2)]);
  mesh(new THREE.TubeGeometry(path, 64, 0.85, 18, false), exhaustMat, engine);
  const muff = mesh(new THREE.CylinderGeometry(2.0, 2.0, 7.4, 32), exhaustMat, engine); muff.rotation.z = Math.PI / 2; muff.position.set(17.0, -1.4, 3.2);
  const cone = mesh(new THREE.CylinderGeometry(2.0, 0.85, 1.6, 32), exhaustMat, engine); cone.rotation.z = Math.PI / 2; cone.position.set(12.6, -1.4, 3.2);
  const end = mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.6, 32), chrome, engine); end.rotation.z = -Math.PI / 2; end.position.set(21.0, -1.4, 3.2);
  const tip = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 20), chrome, engine); tip.rotation.z = Math.PI / 2; tip.position.set(21.2, -1.4, 3.2);
  rbox(1.0, 6.4, 1.0, 0.2, steelDark, 16.5, -5.6, 3.2, engine);
  const perf = perforation();
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0xe9ebe8, metalness: 1.0, roughness: 0.16, alphaMap: perf, alphaTest: 0.5, side: THREE.DoubleSide });
  const hs = mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.4, 48, 1, true, -Math.PI / 2, Math.PI), shieldMat, engine);
  hs.rotation.z = Math.PI / 2; hs.position.set(17.2, -1.4, 3.2);
  const hpath = new THREE.CatmullRomCurve3([V3(8.75, 12.0, 1.75), V3(9.4, 7.0, 2.6), V3(9.9, 2.4, 3.1)]);
  const hm = shieldMat.clone(); hm.alphaMap = perforation(); hm.alphaMap.repeat.set(6, 3);
  mesh(new THREE.TubeGeometry(hpath, 24, 1.25, 20, false), hm, engine);
  const flange = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.45, 24), boltMat, engine);
  flange.rotation.z = Math.PI / 2; flange.position.set(4.6, 16.35, 0.05);
}

/* ---------- meja uji & dinamo ---------- */
{
  rbox(48, 1.6, 24, 0.35, benchMat, 1, -9.1, 1.5);
  rbox(46, 0.3, 22, 0.12, benchTop, 1, -8.2, 1.5);
  for (const z of [-6, 1.5, 9]) box(44, 0.05, 0.55, blackMat, 1, -8.03, z);
  for (const [x, z] of [[-21.5, -8.8], [23.5, -8.8], [-21.5, 11.8], [23.5, 11.8]]) {
    const b = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 6), steel); b.position.set(x, -7.95, z);
  }
  // plat nama
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.2), new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.35 }));
  plate.position.set(1, -9.1, 13.52); scene.add(plate);
  nameplate(plate.material);
  // dudukan dinamo & bantalan
  rbox(1.6, 7.0, 1.6, 0.25, steelDark, 0, -4.8, 10.3);
  rbox(3.6, 2.8, 2.6, 0.4, steelDark, 0, 0, 10.3);
  // kaliper rem
  rbox(2.4, 2.8, 1.8, 0.4, accentMat, 0, 5.35, 7.2);
  rbox(1.4, 14.2, 1.4, 0.25, steelDark, 6.4, -1.6, 7.2);
  rbox(6.6, 0.9, 1.4, 0.25, steelDark, 3.3, 5.4, 7.2);
  // bayangan lantai
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -9.9; floor.receiveShadow = true; scene.add(floor);
}
engine.traverse((o) => { if (o.isMesh && o.material !== gasMat) { o.castShadow = true; o.receiveShadow = true; } });

/* ---------- asap knalpot ---------- */
const smoke = [];
const smokeMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x9a9d98, transparent: true, depthWrite: false, opacity: 0 });
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(smokeMat.clone()); s.visible = false; scene.add(s);
  smoke.push({ s, life: 0, max: 1, v: V3(0, 0, 0), a: 0 });
}
let smokeIdx = 0;
function puff(amount, dark) {
  const p = smoke[smokeIdx++ % smoke.length];
  p.s.visible = true; p.life = 0; p.max = 0.9 + Math.random() * 0.8;
  p.s.position.copy(TAIL).add(V3(0.6, 0, 0));
  p.v.set(8 + Math.random() * 6 + st.rpm * 0.002, 1.2 + Math.random() * 2, (Math.random() - 0.5) * 2);
  p.a = amount; p.s.material.color.setHex(dark ? 0x3e3f3c : 0xb7bab4);
}
function updateSmoke(dt) {
  for (const p of smoke) {
    if (!p.s.visible) continue;
    p.life += dt;
    const t = p.life / p.max;
    if (t >= 1) { p.s.visible = false; continue; }
    p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.6); p.v.y += dt * 2.4;
    const size = 1.2 + t * 6;
    p.s.scale.set(size, size, 1);
    p.s.material.opacity = p.a * (1 - t) * (1 - t);
  }
}

/* ---------- mode tampilan ---------- */
let mode = 'potong';
function setMode(m) {
  mode = m;
  for (const mat of housing) {
    mat.clippingPlanes = m === 'potong' ? [cutPlane] : [];
    mat.transparent = m === 'tembus';
    mat.opacity = m === 'tembus' ? 0.14 : 1;
    mat.depthWrite = m !== 'tembus';
    mat.needsUpdate = true;
  }
  gasMat.clippingPlanes = m === 'potong' ? [cutPlane] : [];
  gasMat.needsUpdate = true;
  gas.visible = m !== 'utuh';
  flameLight.visible = m !== 'utuh';
  sparkLight.visible = m !== 'utuh';
  kernelMat.clippingPlanes = kernelCore.material.clippingPlanes = m === 'potong' ? [cutPlane] : [];
  kernelMat.needsUpdate = kernelCore.material.needsUpdate = true;
  kernel.visible = kernelCore.visible = m !== 'utuh';
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === m)));
}

/* ---------- update model ---------- */
const tmpQ = new THREE.Quaternion();
const gasColor = new THREE.Color();
function updateModel() {
  const th = st.phi;
  const c = ((th % CYCLE) + CYCLE) % CYCLE;
  const pinY = pinHeight(th) * 100;
  crank.rotation.z = -th;
  piston.position.set(0, pinY, 0);
  const cx = CR * Math.sin(th), cy = CR * Math.cos(th);
  rod.position.set(cx, cy, 0);
  rod.rotation.z = Math.atan2(cx, pinY - cy);
  camshaft.rotation.z = 0;
  for (const v of valveDef) {
    const lift = v.lift(c) * 100;
    v.group.position.copy(v.seat).addScaledVector(v.dir, -lift);
    const len = STEM - 0.45 - 2.35 - lift;
    v.spring.scale.set(1, Math.max(0.3, len), 1);
    v.lobe.rotation.z = v.camAng + v.peak / 2 - c / 2;
    v.rocker.rotation.z = v.sign * (lift / v.lever);
  }
  chain.update(th);
  slide.position.y = 16.2 + st.throttle * 1.15;

  // gas
  const crown = pinY + 2.2;
  const top = 14.95;
  gas.scale.y = Math.max(0.05, top - crown);
  gas.position.y = (crown + top) / 2;
  const bar = st.p / 1e5;
  const stroke = Math.floor(c / Math.PI);
  let o = 0.5;
  if (stroke === 0) { gasColor.setRGB(0.18, 0.42, 1.0).multiplyScalar(0.25 + 0.5 * (st.pIvc / 101325)); }
  else if (stroke === 1) { const k = clamp((bar - 1) / 18, 0, 1); gasColor.setRGB(0.25 + 0.45 * k, 0.4 - 0.1 * k, 1.0 - 0.3 * k).multiplyScalar(0.35 + 0.4 * k); }
  else if (stroke === 2) {
    if (st.burnQ > 0) { const k = clamp(bar / 45, 0, 1); gasColor.setRGB(1.0, 0.35 + 0.5 * k, 0.08 + 0.35 * k * k).multiplyScalar(0.25 + 0.85 * k); }
    else gasColor.setRGB(0.3, 0.35, 0.6).multiplyScalar(0.3);
  } else { const k = clamp((bar - 1) * 2, 0, 1); gasColor.setRGB(0.55, 0.45, 0.38).multiplyScalar(0.18 + 0.25 * k); }
  gasMat.color.copy(gasColor); gasMat.opacity = o;
  const burning = stroke === 2 || (stroke === 1 && st.xb > 0.01);
  flameLight.intensity = st.burnQ > 0 && burning ? clamp(bar / 40, 0, 1) * 120 : 0;
  // percikan busi: tampil selama ~16° engkol setelah titik pengapian
  const ignC = Math.PI * 2 - (st.advance * Math.PI) / 180;
  const since = c - ignC, win = (16 * Math.PI) / 180;
  let arcK = st.fuel && st.burnQ > 0 && since >= 0 && since < win ? 1 - (since / win) * 0.55 : 0;
  arcK = Math.max(arcK, sparkFlash);
  if (arcK > 0.03) {
    if (arcPrev <= 0.03) burstEmbers();
    if (!slow || (arcTick++ % 3 === 0)) rebuildArc();
    const flick = 0.75 + Math.random() * 0.25;
    arcCoreMat.opacity = arcK * flick; arcGlowMat.opacity = arcK * 0.55 * flick;
    spark.material.opacity = arcK * 0.9; sparkLight.intensity = arcK * 22;
  } else { arcCoreMat.opacity = arcGlowMat.opacity = 0; spark.material.opacity = 0; sparkLight.intensity = 0; }
  arcPrev = arcK;
  // inti nyala api
  const xb = st.burnQ > 0 && c > ignC && c < Math.PI * 2 + (90 * Math.PI) / 180 ? st.xb : 0;
  if (xb > 0.0005 || (st.burnQ > 0 && since > 0.02 && since < 0.5)) {
    const grow = Math.max(0.12, Math.pow(xb, 0.45));
    const r = 0.18 + 2.35 * grow;
    kernel.position.copy(GAP_WORLD).lerp(CHAMBER_C, Math.min(1, grow * 0.75));
    kernel.scale.setScalar(r); kernelCore.position.copy(kernel.position); kernelCore.scale.setScalar(r * 0.55);
    kernel.rotation.set(Math.random() * 6, Math.random() * 6, 0); kernelCore.rotation.copy(kernel.rotation);
    const fade = Math.pow(1 - xb, 0.8);
    kernelMat.opacity = 0.75 * fade; kernelCore.material.opacity = 0.6 * fade * fade;
  } else { kernelMat.opacity = 0; kernelCore.material.opacity = 0; }
  // cakram rem
  const glow = clamp((st.brakeTemp - 140) / 420, 0, 1);
  discMat.emissive.setRGB(glow * 1.0, glow * 0.22, glow * 0.03);
}

/* ---------- suara ---------- */
const audio = { ctx: null, on: false, master: null };
function audioInit() {
  if (audio.ctx) return true;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return false;
  const ctx = new C();
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 4; }
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  const muffler = ctx.createBiquadFilter(); muffler.type = 'lowpass'; muffler.frequency.value = 2400; muffler.Q.value = 0.7;
  muffler.connect(master);
  const loop = (type, f, q, g) => {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ctx.createGain(); gn.gain.value = g;
    src.connect(fl).connect(gn).connect(master); src.start();
    return { fl, gn };
  };
  const intake = loop('bandpass', 700, 1.4, 0);
  const mech = loop('highpass', 3200, 0.7, 0);
  const st0 = ctx.createOscillator(); st0.type = 'sawtooth'; st0.frequency.value = 220;
  const stf = ctx.createBiquadFilter(); stf.type = 'lowpass'; stf.frequency.value = 1400;
  const stg = ctx.createGain(); stg.gain.value = 0;
  st0.connect(stf).connect(stg).connect(master); st0.start();
  Object.assign(audio, { ctx, noise, master, muffler, intake, mech, starter: { osc: st0, g: stg } });
  return true;
}
function pulse(t, amp, rpm) {
  const { ctx, noise, muffler } = audio;
  const dur = clamp(0.012 + 8 / Math.max(rpm, 250), 0.02, 0.09);
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + 1100 * st.throttle + rpm * 0.09; f.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.0025); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(muffler);
  src.start(t, Math.random() * 1.5, dur + 0.03);
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + dur);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(amp * 1.1, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.2);
  o.connect(og).connect(muffler); o.start(t); o.stop(t + dur * 1.2 + 0.02);
}
function setSound(on) {
  if (on && !audioInit()) on = false;
  audio.on = on;
  if (audio.ctx) {
    if (on && audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.master.gain.setTargetAtTime(on ? 0.7 : 0, audio.ctx.currentTime, 0.05);
  }
  $('sound').setAttribute('aria-pressed', String(on));
  $('sound').textContent = on ? 'Suara: nyala' : 'Nyalakan suara';
}
function updateAudio(scale) {
  if (!audio.ctx || !audio.on) return;
  const t = audio.ctx.currentTime, rpm = st.rpm;
  const run = st.fuel && rpm > 100 ? 1 : 0;
  audio.intake.gn.gain.setTargetAtTime(run * (0.004 + 0.05 * st.throttle) * clamp(rpm / 6000, 0.1, 1.2), t, 0.05);
  audio.intake.fl.frequency.setTargetAtTime(500 + rpm * 0.12, t, 0.05);
  audio.mech.gn.gain.setTargetAtTime(clamp(rpm / 9000, 0, 1) * 0.02 * (scale < 1 ? 0.3 : 1), t, 0.05);
  audio.starter.g.gain.setTargetAtTime(st.starter ? 0.05 : 0, t, 0.02);
  audio.starter.osc.frequency.setTargetAtTime(160 + rpm * 0.55, t, 0.03);
}

/* ---------- instrumen ---------- */
let tokens = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['ink', 'muted', 'line', 'accent', 'hot', 'panel', 'stage', 'intake', 'exhaust']) tokens[k] = cs.getPropertyValue('--' + k).trim();
  if (tokens.stage) {
    const c = new THREE.Color(tokens.stage);
    scene.background = c; scene.fog.color.copy(c);
  }
}
readTokens();
{ const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', readTokens); else if (mq.addListener) mq.addListener(readTokens); }
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function fit(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [x, w, h];
}
const MONO = '500 10px "Martian Mono", ui-monospace, monospace';
function drawTach(rpmShown) {
  const [x, w, h] = fit($('tach'));
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.5, R = Math.min(w * 0.42, h * 0.46);
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5, max = 10000;
  const ang = (v) => a0 + (v / max) * sweep;
  x.lineCap = 'butt';
  x.lineWidth = 6; x.strokeStyle = tokens.line; x.beginPath(); x.arc(cx, cy, R, a0, a0 + sweep); x.stroke();
  x.strokeStyle = tokens.hot; x.beginPath(); x.arc(cx, cy, R, ang(9000), ang(10000)); x.stroke();
  x.strokeStyle = tokens.accent; x.beginPath(); x.arc(cx, cy, R, a0, ang(clamp(rpmShown, 0, max))); x.stroke();
  x.font = MONO; x.fillStyle = tokens.muted; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let v = 0; v <= max; v += 500) {
    const a = ang(v), major = v % 1000 === 0;
    x.strokeStyle = v >= 9000 ? tokens.hot : tokens.ink; x.lineWidth = major ? 1.6 : 1;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); x.lineTo(cx + Math.cos(a) * (R - (major ? 16 : 12)), cy + Math.sin(a) * (R - (major ? 16 : 12))); x.stroke();
    if (major) x.fillText(String(v / 1000), cx + Math.cos(a) * (R - 25), cy + Math.sin(a) * (R - 25));
  }
  const a = ang(clamp(rpmShown, 0, max * 1.02));
  x.strokeStyle = tokens.hot; x.lineWidth = 2.2;
  x.beginPath(); x.moveTo(cx - Math.cos(a) * 8, cy - Math.sin(a) * 8); x.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); x.stroke();
  x.fillStyle = tokens.ink; x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.fill();
  x.fillStyle = tokens.muted; x.fillText('×1000', cx, cy + R * 0.5); x.fillText('rpm', cx, cy + R * 0.5 + 12);
}
function drawCycle() {
  const [x, w, h] = fit($('cycle'));
  x.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
  const toA = (deg) => -Math.PI / 2 + (deg / 720) * Math.PI * 2;
  const names = ['HISAP', 'KOMPRESI', 'USAHA', 'BUANG'];
  const letters = ['H', 'K', 'U', 'B'];
  const colors = [tokens.intake, tokens.accent, tokens.hot, tokens.exhaust];
  const c = ((st.phi % CYCLE) + CYCLE) % CYCLE;
  const deg = (c * 180) / Math.PI;
  const cur = Math.floor(c / Math.PI);
  x.lineCap = 'butt';
  for (let i = 0; i < 4; i++) {
    x.lineWidth = i === cur ? 10 : 6;
    x.strokeStyle = i === cur ? colors[i] : tokens.line;
    x.beginPath(); x.arc(cx, cy, R, toA(i * 180) + 0.04, toA((i + 1) * 180) - 0.04); x.stroke();
    const mid = toA(i * 180 + 90);
    x.font = (i === cur ? '600 ' : '500 ') + '10px "Martian Mono", ui-monospace, monospace';
    x.fillStyle = i === cur ? tokens.ink : tokens.muted; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letters[i], cx + Math.cos(mid) * (R + 15), cy + Math.sin(mid) * (R + 15));
  }
  // bukaan klep di dalam cincin
  x.lineWidth = 2.5;
  x.strokeStyle = tokens.intake; x.beginPath(); x.arc(cx, cy, R - 10, toA(-10), toA(225)); x.stroke();
  x.strokeStyle = tokens.exhaust; x.beginPath(); x.arc(cx, cy, R - 15, toA(495), toA(735)); x.stroke();
  // titik pengapian
  const ig = toA(360 - st.advance);
  x.fillStyle = tokens.hot; x.beginPath(); x.arc(cx + Math.cos(ig) * (R + 9), cy + Math.sin(ig) * (R + 9), 2.6, 0, Math.PI * 2); x.fill();
  // penanda posisi di cincin
  const a = toA(deg);
  const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
  x.fillStyle = tokens.panel; x.strokeStyle = tokens.ink; x.lineWidth = 2;
  x.beginPath(); x.arc(px, py, 5.5, 0, Math.PI * 2); x.fill(); x.stroke();
  // teks tengah: langkah sekarang dan sudutnya
  x.fillStyle = tokens.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const fs = Math.max(11, Math.min(16, R * 0.27));
  x.font = '800 ' + fs + 'px "Big Shoulders Display", "Arial Narrow", sans-serif';
  x.fillText(names[cur], cx, cy + 2);
  x.font = '500 9.5px "Martian Mono", ui-monospace, monospace'; x.fillStyle = tokens.muted; x.textBaseline = 'top';
  x.fillText(Math.floor(deg) + '°', cx, cy + 6);
}
function drawPV() {
  const [x, w, h] = fit($('pv'));
  x.clearRect(0, 0, w, h);
  const ml = 34, mr = 10, mt = 10, mb = 24;
  const pw = w - ml - mr, ph = h - mt - mb;
  const vx = (v) => ml + ((v - 0.0) / 1.15) * pw;
  const lp0 = Math.log(0.1), lp1 = Math.log(80);
  const py = (p) => mt + ph - ((Math.log(clamp(p, 0.1, 80)) - lp0) / (lp1 - lp0)) * ph;
  x.font = MONO; x.fillStyle = tokens.muted; x.textAlign = 'right'; x.textBaseline = 'middle';
  x.lineWidth = 1;
  for (const p of [0.2, 0.5, 1, 2, 5, 10, 20, 50]) {
    x.strokeStyle = tokens.line; x.beginPath(); x.moveTo(ml, py(p)); x.lineTo(ml + pw, py(p)); x.stroke();
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
  draw(st.pvLast, tokens.hot, 1.6);
  draw(st.pv, tokens.accent, 1.4);
  if (st.pv.length >= 2) {
    const i = st.pv.length - 2;
    x.fillStyle = tokens.ink; x.beginPath(); x.arc(vx(st.pv[i]), py(st.pv[i + 1]), 3.2, 0, Math.PI * 2); x.fill();
  }
}

/* ---------- UI ---------- */
const ui = { rpm: $('v-rpm'), hp: $('v-hp'), tq: $('v-tq'), peak: $('v-peak'), adv: $('v-adv'), fuel: $('v-fuel'), disc: $('v-disc'), state: $('state'), strokeTag: $('stroke-tag'), run: $('run'), note: $('note') };
const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let smooth = { rpm: 0, hp: 0, tq: 0, fuel: 0 };
let starterTime = 0;
function phase() {
  if (st.starter) return 'starter';
  if (st.running) return st.misfire ? 'limiter' : 'hidup';
  if (st.rpm > 5) return 'berhenti';
  return 'mati';
}
const STROKE_TEXT = {
  hisap: 'Hisap: klep masuk terbuka, seher turun menarik campuran bensin dan udara.',
  kompresi: 'Kompresi: kedua klep tertutup, seher naik memampatkan campuran.',
  usaha: 'Usaha: busi memercik, ledakan mendorong seher turun dan memutar kruk as.',
  buang: 'Buang: klep buang terbuka, seher naik mendorong gas sisa ke knalpot.',
};
let uiTick = 0, lastStroke = '';
function updateUI(dt) {
  const k = 1 - Math.exp(-dt * 8);
  const hp = (st.brakeTorque * st.omega) / 745.7;
  smooth.rpm += (st.rpm - smooth.rpm) * k;
  smooth.hp += (hp - smooth.hp) * k;
  smooth.tq += (st.brakeTorque - smooth.tq) * k;
  smooth.fuel += (st.fuelLph - smooth.fuel) * k;
  uiTick += dt;
  const sname = strokeName(st.phi);
  const readable = slow || st.rpm < 250;          // di kecepatan normal langkah berganti puluhan kali per detik
  const tag = readable ? sname : '4 langkah';
  if (tag !== lastStroke) { lastStroke = tag; ui.strokeTag.textContent = tag; ui.strokeTag.dataset.stroke = readable ? sname : 'siklus'; }
  if (uiTick > 0.1) {
    uiTick = 0;
    ui.rpm.textContent = nf0.format(Math.round(smooth.rpm / 10) * 10);
    ui.hp.textContent = nf1.format(Math.max(0, smooth.hp));
    ui.tq.textContent = nf1.format(Math.max(0, smooth.tq));
    const turning = st.rpm > 60;
    ui.peak.textContent = nf0.format(turning ? st.lastPeak / 1e5 : 0);
    ui.adv.textContent = nf0.format(st.advance);
    ui.fuel.textContent = nf2.format(turning && st.fuel ? Math.max(0, smooth.fuel) : 0);
    ui.disc.textContent = nf0.format(st.brakeTemp);
    const ph = phase();
    ui.state.textContent = { starter: 'Starter berputar', hidup: 'Hidup', limiter: 'Pembatas putaran', berhenti: 'Berhenti', mati: 'Mati' }[ph];
    ui.state.dataset.state = ph;
    ui.run.textContent = ph === 'hidup' || ph === 'limiter' ? 'Matikan mesin' : ph === 'starter' ? 'Menyalakan…' : 'Hidupkan mesin';
    ui.run.dataset.on = String(st.fuel);
    let note;
    if (stallNote && !st.fuel) note = stallNote;
    else if (readable && st.rpm > 1) note = STROKE_TEXT[sname];
    else if (ph === 'starter') note = 'Motor starter memutar kruk as sampai campuran pertama terbakar.';
    else if (ph === 'mati' || ph === 'berhenti') note = 'Mesin mati. Tekan Hidupkan mesin untuk menyalakan.';
    else if (ph === 'limiter') note = 'Pembatas putaran memotong pengapian di 9.500 rpm. Tambah beban atau kurangi gas.';
    else if (st.load < 0.02) note = 'Tarik beban dinamo untuk mengukur tenaga dan torsi. Tekan Lambat untuk melihat tiap langkah.';
    else note = 'Dinamo menahan poros. Tenaga = torsi × putaran. Cakram rem memanas dan mulai membara di atas 140 °C.';
    if (ui.note.textContent !== note) ui.note.textContent = note;
  }
  drawTach(smooth.rpm);
  drawCycle();
  drawPV();
}

let stallNote = '';
function toggleEngine() {
  if (st.running || st.starter) { sim.stop(); stallNote = ''; return false; }
  sim.stop(); sim.key(); starterTime = 0; stallNote = '';
  return true;
}
ui.run.addEventListener('click', () => { const starting = toggleEngine(); if (starting && !audio.ctx && audio.wanted !== false) setSound(true); });
$('gas').addEventListener('input', (e) => { sim.setThrottle(e.target.value / 100); $('gas-out').textContent = e.target.value + '%'; });
$('load').addEventListener('input', (e) => { sim.setLoad(e.target.value / 100); $('load-out').textContent = e.target.value + '%'; });
$('sound').addEventListener('click', () => { audio.wanted = !audio.on; setSound(!audio.on); });
let slow = false;
function setSlow(v) { slow = v; $('slow').setAttribute('aria-pressed', String(v)); }
$('slow').addEventListener('click', () => setSlow(!slow));
$('reset').addEventListener('click', () => flyTo(null));
$('plug-view').addEventListener('click', () => { setMode('potong'); setSlow(true); flyTo('plug'); });
let fly = null;
function flyTo(where) {
  let tgt, pos;
  if (where === 'plug') {
    tgt = GAP_WORLD.clone();
    pos = tgt.clone().addScaledVector(V3(0.25, -0.12, 1).normalize(), stage.clientWidth < 500 ? 11 : 8.5);
  } else {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    const dist = aspect < 0.8 ? 112 : aspect < 1.2 ? 92 : 74;
    tgt = V3(2.5, 7, 0); pos = tgt.clone().addScaledVector(VIEW_DIR, dist);
  }
  if (reduceMotion) { controls.target.copy(tgt); camera.position.copy(pos); controls.update(); return; }
  fly = { t: 0, t0: controls.target.clone(), p0: camera.position.clone(), t1: tgt, p1: pos };
}
function updateFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / 1.1);
  const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - Math.pow(-2 * fly.t + 2, 3) / 2;
  controls.target.lerpVectors(fly.t0, fly.t1, e);
  camera.position.lerpVectors(fly.p0, fly.p1, e);
  if (fly.t >= 1) fly = null;
}
renderer.domElement.addEventListener('pointerdown', () => { fly = null; });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.view)));
function nudge(id, d) { const el = $(id); el.value = clamp(+el.value + d, 0, 100); el.dispatchEvent(new Event('input')); }
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.key === ' ') { e.preventDefault(); toggleEngine(); }
  else if (e.metaKey || e.ctrlKey || e.altKey) return;
  else if (e.key === 'ArrowUp' && e.target.tagName !== 'INPUT') { e.preventDefault(); nudge('gas', 10); }
  else if (e.key === 'ArrowDown' && e.target.tagName !== 'INPUT') { e.preventDefault(); nudge('gas', -10); }
  else if (e.key === '1') setMode('utuh');
  else if (e.key === '2') setMode('potong');
  else if (e.key === '3') setMode('tembus');
  else if (e.key === 's' || e.key === 'S') setSlow(!slow);
  else if (e.key === 'b' || e.key === 'B') { setMode('potong'); setSlow(true); flyTo('plug'); }
});

/* ---------- loop ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize(); resetView(); setMode('potong'); setSound(false);
sim.setThrottle(0); sim.setLoad(0);
setTimeout(() => { if (!st.fuel) { sim.key(); starterTime = 0; } }, 700);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const scale = slow ? 1 / 20 : 1;
  const sdt = dt * scale;
  const t0 = st.time;
  if (st.starter) {
    starterTime += sdt;
    if (st.running || starterTime > 3.5) {
      sim.release();
      if (!st.running) { sim.stop(); stallNote = st.load > 0.25 ? 'Mesin gagal hidup: beban dinamo terlalu berat. Turunkan beban lalu coba lagi.' : 'Mesin gagal hidup. Coba lagi.'; }
    }
  } else if (st.fuel && !st.running && st.rpm < 60) {
    sim.stop();
    stallNote = st.load > 0.25 ? 'Mesin mati karena beban dinamo terlalu berat. Turunkan beban lalu hidupkan lagi.' : 'Mesin mati.';
  }
  sim.step(sdt);
  const at = audio.ctx && audio.on ? audio.ctx.currentTime + 0.05 : 0;
  for (const ev of st.events) {
    const delay = (ev.t - t0) / scale;
    if (ev.type === 'exhaust') {
      if (at) pulse(at + delay, ev.lit ? clamp(0.25 + ev.k * 0.6, 0.05, 0.95) * (0.55 + 0.45 * st.throttle) : 0.04, st.rpm);
      if (!reduceMotion && Math.random() < (slow ? 1 : clamp(500 / Math.max(st.rpm, 1), 0.08, 1))) puff(ev.lit ? 0.16 + 0.2 * st.throttle : 0.05, false);
    } else if (ev.type === 'spark') {
      sparkFlash = 1;
    } else if (ev.type === 'caught') {
      for (let i = 0; i < 6; i++) puff(0.5, true);
    }
  }
  sim.clearEvents();
  sparkFlash = Math.max(0, sparkFlash - dt * (slow ? 3 : 18));
  updateEmbers(dt * (slow ? 0.3 : 1));
  updateAudio(scale);
  updateModel();
  updateSmoke(dt * (slow ? 0.25 : 1));
  updateUI(dt);
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
let sparkFlash = 0, arcPrev = 0, arcTick = 0;
requestAnimationFrame(frame);
window.__mesin = { sim, setMode };
