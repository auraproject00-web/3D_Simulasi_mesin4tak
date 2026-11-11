// Material dan alat bantu geometri bersama. Satuan dunia: sentimeter. Sumbu z = sumbu kruk as.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const Y_AXIS = V3(0, 1, 0);

// bidang potong: tampilan "Potong" menyimpan z <= 0 dan membuang sisi kanan mesin
export const cutPlane = new THREE.Plane(V3(0, 0, -1), 0);
export const sectioned = [];   // material rumah mesin yang ikut terpotong

function castShader(m, grain, hatch) {
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
      .replace('#include <color_fragment>', `#include <color_fragment>
      float castN = vn(vWPos * 2.4) * 0.5 + vn(vWPos * 8.0) * 0.3 + vn(vWPos * 29.0) * 0.2;
      diffuseColor.rgb *= 1.0 + (castN - 0.5) * 0.18 * ${grain.toFixed(2)};
      ${hatch ? `if (!gl_FrontFacing) {
        float hh = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0));
        diffuseColor.rgb = mix(vec3(0.95, 0.66, 0.08), vec3(0.42, 0.25, 0.02), hh * 0.75);
      }` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (castN - 0.5) * 0.3 * ${grain.toFixed(2)}, 0.05, 1.0);`);
  };
  m.customProgramCacheKey = () => `cast${grain}${hatch}`;
}
// material rumah mesin: butiran cor + arsiran kuning di bidang potong
export function housingMat(params, grain = 1, hatch = true) {
  const m = new THREE.MeshStandardMaterial(params);
  m.side = THREE.DoubleSide;
  castShader(m, grain, hatch);
  sectioned.push(m);
  return m;
}
export function castMat(params, grain = 1) { const m = new THREE.MeshStandardMaterial(params); castShader(m, grain, false); return m; }
const std = (o) => new THREE.MeshStandardMaterial(o);

export const MAT = {
  caseAlu: housingMat({ color: 0xc3c7c2, metalness: 0.55, roughness: 0.46 }, 1),
  coverAlu: housingMat({ color: 0xd9dcd7, metalness: 0.75, roughness: 0.26 }, 0.45),
  finPaint: housingMat({ color: 0x24282a, metalness: 0.35, roughness: 0.55 }, 0.7),
  machined: housingMat({ color: 0xe4e6e2, metalness: 0.95, roughness: 0.22 }, 0.2),
  headAlu: housingMat({ color: 0xc9ccc7, metalness: 0.6, roughness: 0.4 }, 1),
  exhaust: housingMat({ color: 0x3b3a37, metalness: 0.75, roughness: 0.42 }, 0.5, false),
  chromeH: housingMat({ color: 0xe9ebe8, metalness: 1.0, roughness: 0.12 }, 0, false),
  rubberH: housingMat({ color: 0x1d201f, metalness: 0.1, roughness: 0.82 }, 0.4, false),
  rubberS: housingMat({ color: 0x1d201f, metalness: 0.1, roughness: 0.82 }, 0.4),
  boltH: housingMat({ color: 0xa4a9a4, metalness: 0.9, roughness: 0.28 }, 0),
  steel: std({ color: 0xd9dcd8, metalness: 0.92, roughness: 0.24 }),
  steelDark: std({ color: 0x5c615e, metalness: 0.85, roughness: 0.36 }),
  gearSteel: std({ color: 0xaab0ad, metalness: 0.9, roughness: 0.3 }),
  black: std({ color: 0x1f2321, metalness: 0.3, roughness: 0.6 }),
  rubber: std({ color: 0x1c1d1d, metalness: 0.05, roughness: 0.85 }),
  chain: std({ color: 0x3a3f3c, metalness: 0.8, roughness: 0.4 }),
  brass: std({ color: 0xc89b45, metalness: 0.85, roughness: 0.3 }),
  spring: std({ color: 0x4d7a57, metalness: 0.6, roughness: 0.4 }),
  porcelain: std({ color: 0xf1efe8, metalness: 0, roughness: 0.25 }),
  nickel: std({ color: 0xbdb8ab, metalness: 0.95, roughness: 0.32 }),
  zinc: std({ color: 0xdadcd4, metalness: 0.92, roughness: 0.2 }),
  chrome: std({ color: 0xe9ebe8, metalness: 1, roughness: 0.1 }),
  frame: castMat({ color: 0x2f5a46, metalness: 0.25, roughness: 0.55 }, 0.35),
  dyno: castMat({ color: 0x23453a, metalness: 0.3, roughness: 0.5 }, 0.4),
  floor: std({ color: 0x8a918c, metalness: 0.4, roughness: 0.62 }),
  accent: std({ color: 0xe2a20c, metalness: 0.2, roughness: 0.5 }),
  red: std({ color: 0xb2341c, metalness: 0.1, roughness: 0.45 }),
  hose: new THREE.MeshPhysicalMaterial({ color: 0xd8c18a, metalness: 0, roughness: 0.15, transmission: 0.55, thickness: 0.3, transparent: true, opacity: 0.85 }),
  fuel: std({ color: 0xc98a1a, metalness: 0, roughness: 0.2, emissive: 0x2a1500 }),
  carbBody: castMat({ color: 0xb9bcb6, metalness: 0.6, roughness: 0.38 }, 0.8),
  engaged: std({ color: 0xe2a20c, metalness: 0.6, roughness: 0.3, emissive: 0x3a2400 }),
};

export function mesh(geo, mat, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
export function box(w, h, d, mat, x, y, z, parent) { const m = mesh(new THREE.BoxGeometry(w, h, d), mat, parent); m.position.set(x, y, z); return m; }
export function rbox(w, h, d, r, mat, x, y, z, parent) { const m = mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, parent); m.position.set(x, y, z); return m; }
export function zCyl(r, len, mat, x, y, z, parent, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2);
  const m = mesh(g, mat, parent); m.position.set(x, y, z); return m;
}
// batang kotak di antara dua titik
export function bar(a, b, w, d, mat, parent) {
  const m = mesh(new THREE.BoxGeometry(w, a.distanceTo(b), d), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize());
  return m;
}
// pipa bulat di antara dua titik
export function rod(a, b, r, mat, parent, seg = 16) {
  const m = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize());
  return m;
}
// roda gigi lurus dengan profil gigi trapesium, sumbu z, tebal `depth`
export function gearGeo(r, teeth, depth, hole = 0.35) {
  const s = new THREE.Shape(), root = r - Math.min(0.45, r * 0.12), n = teeth;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, w = (Math.PI * 2) / n;
    const pts = [[root, a0], [r, a0 + w * 0.22], [r, a0 + w * 0.48], [root, a0 + w * 0.7]];
    pts.forEach(([rr, a], k) => { const p = [Math.cos(a) * rr, Math.sin(a) * rr]; i === 0 && k === 0 ? s.moveTo(...p) : s.lineTo(...p); });
  }
  s.closePath();
  if (hole > 0) { const hp = new THREE.Path(); hp.absarc(0, 0, r * hole, 0, Math.PI * 2, true); s.holes.push(hp); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function sprocketGeo(r, teeth, depth) {
  const s = new THREE.Shape(), n = teeth, root = r - 0.42;
  for (let i = 0; i <= n * 6; i++) {
    const a = (i / (n * 6)) * Math.PI * 2, k = (i % 6) / 6;
    const rr = root + (r - root) * Math.pow(Math.sin(Math.PI * k), 0.6);
    const p = [Math.cos(a) * rr, Math.sin(a) * rr]; i === 0 ? s.moveTo(...p) : s.lineTo(...p);
  }
  const hp = new THREE.Path(); hp.absarc(0, 0, Math.min(1.0, r * 0.3), 0, Math.PI * 2, true); s.holes.push(hp);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}
export function helixGeo(turns, radius, wire, height = 1) {
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) { const t = i / (turns * 24), a = t * turns * Math.PI * 2; pts.push(V3(Math.cos(a) * radius, t * height, Math.sin(a) * radius)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, wire, 6, false);
}
// baut kepala segi enam dengan ring, menghadap `axis`
export function bolt(x, y, z, axis, parent, mat = MAT.boltH, size = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const head = mesh(new THREE.CylinderGeometry(0.34 * size, 0.34 * size, 0.36 * size, 6), mat, g); head.position.y = 0.3 * size;
  mesh(new THREE.CylinderGeometry(0.46 * size, 0.46 * size, 0.1 * size, 18), mat, g).position.y = 0.06 * size;
  if (axis === 'z') g.rotation.x = Math.PI / 2; else if (axis === '-z') g.rotation.x = -Math.PI / 2;
  else if (axis === 'x') g.rotation.z = -Math.PI / 2; else if (axis === '-x') g.rotation.z = Math.PI / 2; else if (axis === '-y') g.rotation.x = Math.PI;
  else if (axis && axis.isVector3) g.quaternion.setFromUnitVectors(Y_AXIS, axis.clone().normalize());
  if (parent) parent.add(g);
  return g;
}
// lembar sirip pendingin persegi dengan lubang bulat, dicat dengan tepi dibubut (dua material)
export function finPlate(y, t, hx, zFront, zBack, holeR, parent, rr = 0.9, mats = [MAT.finPaint, MAT.machined]) {
  const s = new THREE.Shape();
  const x0 = -hx, x1 = hx, y0 = -zFront, y1 = -zBack;
  s.moveTo(x0 + rr, y0); s.lineTo(x1 - rr, y0); s.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - rr); s.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x0 + rr, y1); s.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + rr); s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 1, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return mesh(g, mats, parent);
}
// kulit tipis dari dua garis luar (luar & dalam) yang dibuka di satu sisi, diekstrusi sepanjang z
export function shellWall(outer, inner, z0, z1, mat, parent) {
  const s = new THREE.Shape();
  outer.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  for (let i = inner.length - 1; i >= 0; i--) s.lineTo(inner[i].x, inner[i].y);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, z0);
  return mesh(g, mat, parent);
}
// tutup samping dari garis luar tertutup, dengan tepi membulat
export function plate(outline, z0, depth, bevel, mat, parent, holes = []) {
  const s = new THREE.Shape();
  outline.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  for (const h of holes) { const hp = new THREE.Path(); hp.absarc(h[0], h[1], h[2], 0, Math.PI * 2, true); s.holes.push(hp); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, z0);
  return mesh(g, mat, parent);
}
// selubung cembung dari kumpulan lingkaran [x, y, r] dan titik tambahan, berlawanan arah jarum jam
export function hullOf(circles, extra = [], seg = 72) {
  const raw = [];
  for (const [cx, cy, r] of circles) for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; raw.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  for (const p of extra) raw.push(p);
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of raw) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = raw.length - 1; i >= 0; i--) { const p = raw[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1)).map(([x, y]) => V2(x, y));
}
// rantai roller yang berjalan di sekeliling dua gir; update(s) menggeser rantai sejauh s (cm)
export function chainLoop(c1, r1, c2, r2, z, parent, pitch = 0.635, width = 0.55) {
  const hull = hullOf([[c1.x, c1.y, r1], [c2.x, c2.y, r2]], [], 120);
  const seg = []; let total = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], l = a.distanceTo(b);
    seg.push({ a, b, l, s: total }); total += l;
  }
  const count = Math.round(total / pitch);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(pitch * 0.92, 0.26, width), MAT.chain, count);
  im.castShadow = true; parent.add(im);
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, width + 0.16, 8).rotateX(Math.PI / 2), MAT.steel, count);
  parent.add(pins);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = V3(0, 0, 0), sc = V3(1, 1, 1), zAx = V3(0, 0, 1);
  function at(s) {
    s = ((s % total) + total) % total;
    let lo = 0, hi = seg.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (seg[m].s <= s) lo = m; else hi = m - 1; }
    const g = seg[lo], t = (s - g.s) / g.l;
    return [g.a.x + (g.b.x - g.a.x) * t, g.a.y + (g.b.y - g.a.y) * t, Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x)];
  }
  return {
    update(shift) {
      for (let i = 0; i < count; i++) {
        const [x, y, ang] = at(shift + (i / count) * total);
        pos.set(x, y, z); q.setFromAxisAngle(zAx, ang); m4.compose(pos, q, sc); im.setMatrixAt(i, m4);
        const [px, py] = at(shift + ((i + 0.5) / count) * total); pos.set(px, py, z); m4.compose(pos, q, sc); pins.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true; pins.instanceMatrix.needsUpdate = true;
    },
  };
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const glowTex = canvasTex(64, 64, (x) => {
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
});
export function perforation(rx = 5, ry = 3) {
  const t = canvasTex(128, 64, (x) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#000';
    for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 4.6, 0, Math.PI * 2); x.fill(); }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
