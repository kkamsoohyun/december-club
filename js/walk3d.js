/* 3D 눈길 장면 (three.js)
   - 밤하늘·달·별, 굽이진 눈길, 눈 덮인 전나무, 가로등, 출발점 표지판
   - 털모자·목도리 캐릭터: ←↑→↓ / WASD 로 걷기, 드래그로 시점 회전
   - 휴대폰: 화면 왼쪽을 끌면 조이스틱, 오른쪽을 끌면 시점 회전
   - 걸음마다 발자국과 "뽀득" 소리, 3D로 내리는 눈, 입김 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as letters from './letters.js';
import * as club from './club.js';
import { cardImages } from './cards.js';
import { crossStitch } from './stitch.js';
import { t as say } from './i18n.js';
import { connect as connectPresence, myId as myPresenceId } from './presence.js';

const canvas = document.querySelector('.scene');
const hint = document.querySelector('.hint--walk');
const joy = document.querySelector('.joy');
const joyKnob = document.querySelector('.joy__knob');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = {
  skyTop: '#000a2a',
  horizon: '#12306a',
  snow: 0xe6eef9,
  path: 0x7f95c0,
  print: 0x8496b8,
  pine: 0x1d4a3c,
  pineSnow: 0xf2f6fc,
  trunk: 0x4e3322,
  lampPole: 0x1a2440,
  lampLight: 0xffd29a,
  wood: 0x7a5236,
  coat: 0x2f6b55,
  pants: 0x3a2c33,
  boot: 0x5a3a28,
  skin: 0xf7d9c4,
  blush: 0xf08c8c,
  eye: 0x2a1e1e,
  red: 0xc8323a,
  knit: 0xf3ece0,
};

/* ───────── 렌더러 · 장면 · 카메라 ───────── */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.horizon, 40, 150);

// 하늘: 세로 그라디언트
{
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.55, '#001c5f');
  grad.addColorStop(1, COLORS.horizon);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 세로 화면에서는 시야를 넓혀 캐릭터 주변이 잘 보이게
  camera.fov = w < h ? 64 : 50;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ───────── 빛 ───────── */
scene.add(new THREE.HemisphereLight(0x5b7cc4, 0x1c2c55, 1.6));

const MOON_DIR = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
const moonLight = new THREE.DirectionalLight(0xc4d4ff, 1.5);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 });
moonLight.shadow.bias = -0.0005;
moonLight.shadow.normalBias = 0.03;
scene.add(moonLight, moonLight.target);

/* ───────── 텍스처 도우미 ───────── */
function radialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const dotTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64);

/* ───────── 달 · 별 ───────── */
{
  const pos = MOON_DIR.clone().multiplyScalar(220);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(7, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xf4efe0, fog: false }),
  );
  moon.position.copy(pos);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(244,239,224,0.45)', 'rgba(244,239,224,0)'),
    fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(70, 70, 1);
  glow.position.copy(pos);
  const sky = new THREE.Group();
  sky.add(moon, glow);

  const N = 900, arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(1 - Math.random() * 0.85);      // 위쪽 반구 위주
    arr[i * 3] = Math.sin(ph) * Math.cos(th) * 300;
    arr[i * 3 + 1] = Math.cos(ph) * 300;
    arr[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 300;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xffffff, size: 2, sizeAttenuation: false, map: dotTex, transparent: true, depthWrite: false, fog: false,
  }));
  sky.add(stars);
  scene.add(sky);
  scene.userData.sky = sky;       // 카메라를 따라다니게 (무한히 먼 하늘)
}

/* ───────── 길 (닫힌 곡선) ───────── */
const pathCurve = (() => {
  const pts = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 47 + Math.sin(a * 3 + 1) * 8 + Math.cos(a * 2) * 4;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
})();
const LOOP = pathCurve.getSpacedPoints(480).slice(0, -1);

// 출발점과 중앙의 집, 그리고 출발점에서 집 현관까지 이어지는 작은 길
const START_T = 0.02;
const START_P = pathCurve.getPointAt(START_T);
const HOUSE_ROT = Math.atan2(START_P.x, START_P.z);      // 집 정면(+z)이 출발점을 향하도록
const HOUSE_FRONT = new THREE.Vector3(Math.sin(HOUSE_ROT), 0, Math.cos(HOUSE_ROT));
// 트리 마당: 집 앞에 둥근 마당이 있고, 다섯 트리가 그 마당을 빙 둘러섬 (마당 중심 기준)
//   각도는 마당 중심에서 본 방향 — 0° 는 출발점 쪽, 180° 는 집 쪽
const PLAZA = { CENTER: 13.5, RING: 7, TREE_R: 11.5, ANGLES: [-110, -50, 0, 50, 110], ENTRY: 25 };
const HOUSE_SIDE = new THREE.Vector3(HOUSE_FRONT.z, 0, -HOUSE_FRONT.x);
const YARD = HOUSE_FRONT.clone().multiplyScalar(PLAZA.CENTER);
const yardAt = (deg, r) => {
  const a = THREE.MathUtils.degToRad(deg);
  return YARD.clone().addScaledVector(HOUSE_FRONT, Math.cos(a) * r).addScaledVector(HOUSE_SIDE, Math.sin(a) * r);
};
const line = (a, b) => {
  const out = [], n = Math.ceil(a.distanceTo(b) / 0.5);
  for (let i = 0; i <= n; i++) out.push(new THREE.Vector3().lerpVectors(a, b, i / n));
  return out;
};
// 현관 → 마당,  마당 → (트리 사이로 비스듬히) → 출발점
const SPUR_IN = line(HOUSE_FRONT.clone().multiplyScalar(4.6), yardAt(180, PLAZA.RING));
const SPUR_OUT = (() => {
  const c = new THREE.CatmullRomCurve3([yardAt(PLAZA.ENTRY, PLAZA.RING), yardAt(PLAZA.ENTRY + 3, PLAZA.TREE_R + 2.5), START_P]);
  return c.getSpacedPoints(Math.ceil(c.getLength() / 0.5));
})();
const SPUR = [...SPUR_IN, ...SPUR_OUT];
const PATH_SAMPLES = [...LOOP, ...SPUR];

function distToPath(x, z) {
  let best = Infinity;
  for (const p of PATH_SAMPLES) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 지형 높이: 길 근처는 평평, 멀어질수록 둔덕, 아주 멀리는 언덕으로 감쌈
function heightAt(x, z, d = distToPath(x, z)) {
  const bumps = Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.7 + Math.sin(x * 0.37 + z * 0.21) * 0.3 + Math.cos(z * 0.29 - x * 0.11) * 0.35;
  const r = Math.hypot(x, z);
  // 중앙(집과 큰 나무들이 있는 마당)은 평평하게
  return (bumps + 0.4) * smooth(3, 10, d) * smooth(28, 36, r) + Math.max(0, r - 95) ** 1.4 * 0.25;
}

/* ───────── 눈 덮인 땅 ───────── */
{
  const SIZE = 340, SEG = 210;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: COLORS.snow }));
  ground.receiveShadow = true;
  scene.add(ground);
}

let pathMat;                 // 길 재질 (가장자리가 부드럽게 사라짐) — 광장 길에서도 씀
// 길: 가장자리가 부드럽게 사라지는 띠
function ribbon(points, closed, width) {
  const N = points.length;
  const count = closed ? N + 1 : N;
  const pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const p = points[i % N];
    const a = closed || i > 0 ? points[(i - 1 + N) % N] : p;
    const b = closed || i < N - 1 ? points[(i + 1) % N] : p;
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
    const nx = tz / l, nz = -tx / l;
    if (i > 0) acc += p.distanceTo(points[(i - 1 + N) % N]);
    for (const side of [1, -1]) {
      pos.push(p.x + (nx * side * width) / 2, 0.02, p.z + (nz * side * width) / 2);
      uv.push(acc / 4, side > 0 ? 0 : 1);
    }
    if (i < count - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
{
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#000'); grad.addColorStop(0.25, '#fff'); grad.addColorStop(0.75, '#fff'); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  const alpha = new THREE.CanvasTexture(c);

  const mat = new THREE.MeshLambertMaterial({
    color: COLORS.path, alphaMap: alpha, transparent: true, opacity: 0.9, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  pathMat = mat;
  for (const geo of [ribbon(LOOP, true, 2.6), ribbon(SPUR_OUT, false, 2.0), ribbon(SPUR_IN, false, 2.0)]) {
    const path = new THREE.Mesh(geo, mat);
    path.receiveShadow = true;
    scene.add(path);
  }
}

/* ───────── 전나무 (하나의 형상을 인스턴스로 반복) ───────── */
const trees = [];            // 원형 충돌체 {x, z, r}
const boxes = [];            // 사각 충돌체 {x, z, rot, hw, hd}
let treeGeo;
{
  const parts = [];
  const tint = (geo, hex) => {
    const col = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  parts.push(tint(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8).translate(0, 0.35, 0), COLORS.trunk));
  for (let i = 0; i < 3; i++) {
    const r = 1.15 - i * 0.3, h = 1.35 - i * 0.15, y = 0.55 + i * 0.75;
    parts.push(tint(new THREE.ConeGeometry(r, h, 10).translate(0, y + h / 2, 0), COLORS.pine));
    parts.push(tint(new THREE.ConeGeometry(r * 0.62, h * 0.52, 10).translate(0, y + h * 0.74 + 0.02, 0), COLORS.pineSnow));
  }
  const geo = mergeGeometries(parts);
  treeGeo = geo;

  const rand = mulberry(7);
  const list = [];
  for (let tries = 0; tries < 3000 && list.length < 340; tries++) {
    const r = 33 + rand() * 75, a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const d = distToPath(x, z);
    if (d < 3.4) continue;
    if ((x - START_P.x) ** 2 + (z - START_P.z) ** 2 < 14 ** 2) continue;   // 출발점 주변은 비워 둠
    // 출발점 → 집 사이는 시야가 트이도록 넓게 비우고, 길 안쪽 마을 쪽은 듬성듬성
    const along = Math.max(0, Math.min(1, (x * START_P.x + z * START_P.z) / START_P.lengthSq()));
    if (Math.hypot(x - START_P.x * along, z - START_P.z * along) < 6 + along * 6) continue;
    if (r < 38 && rand() < 0.6) continue;
    const sc = 0.7 + rand() * 0.9;
    if (list.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (1.6 * (t.sc + sc)) ** 2)) continue;
    list.push({ x, z, sc, y: heightAt(x, z, d), rot: rand() * Math.PI });
  }
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  list.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    s.setScalar(t.sc);
    m.compose(new THREE.Vector3(t.x, t.y - 0.05, t.z), q, s);
    mesh.setMatrixAt(i, m);
    trees.push({ x: t.x, z: t.z, r: 0.55 * t.sc });
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ───────── 가로등 ───────── */
let makeLamp;
{
  const poleMat = new THREE.MeshLambertMaterial({ color: COLORS.lampPole });
  const bulbMat = new THREE.MeshBasicMaterial({ color: COLORS.lampLight });
  const capMat = new THREE.MeshLambertMaterial({ color: COLORS.pineSnow });
  const glowMat = new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,210,150,0.6)', 'rgba(255,210,150,0)'),
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  makeLamp = (x, z, power = 9) => {
    const lamp = new THREE.Group();
    lamp.position.set(x, heightAt(x, z), z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.7, 8), poleMat);
    pole.position.y = 1.35; pole.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.25, 8), poleMat);
    base.position.y = 0.12;
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), bulbMat);
    bulb.position.y = 2.86;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 4), poleMat);
    roof.position.y = 3.1; roof.rotation.y = Math.PI / 4;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 3.15; cap.scale.y = 0.5;
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(2.4, 2.4, 1); glow.position.y = 2.86;

    const light = new THREE.PointLight(COLORS.lampLight, power, 11, 1.4);
    light.position.y = 2.75;

    lamp.add(pole, base, bulb, roof, cap, glow, light);
    scene.add(lamp);
    trees.push({ x, z, r: 0.25 });
  };
  const COUNT = 11;
  for (let i = 0; i < COUNT; i++) {
    const t = (i + 0.5) / COUNT;
    const p = pathCurve.getPointAt(t);
    const tan = pathCurve.getTangentAt(t);
    const n = new THREE.Vector3(tan.z, 0, -tan.x).normalize().multiplyScalar(i % 2 ? 2 : -2);
    makeLamp(p.x + n.x, p.z + n.z);
  }
}

/* ───────── 트리 마을 광장: 집 앞 둥근 마당, 트리로 가는 오솔길, 가로등, 눈사람 ───────── */
{
  const mat = pathMat;
  const add = (pts, closed, w) => { const m = new THREE.Mesh(ribbon(pts, closed, w), mat); m.receiveShadow = true; scene.add(m); };
  // 마당을 도는 둥근 길
  const ring = [];
  for (let i = 0; i < 120; i++) ring.push(yardAt((i / 120) * 360, PLAZA.RING));
  add(ring, true, 2.2);
  // 다섯 트리로 이어지는 오솔길
  for (const deg of PLAZA.ANGLES) add(line(yardAt(deg, PLAZA.RING), yardAt(deg, PLAZA.TREE_R - 2.2)), false, 1.5);
  // 가로등: 트리 사이사이 + 집 쪽 양옆
  for (const deg of [-80, -25, 80, -150, 150]) {
    const p = yardAt(deg, PLAZA.RING + 1.7);
    makeLamp(p.x, p.z, 7);
  }

  // 눈사람
  const snowM = new THREE.MeshLambertMaterial({ color: COLORS.pineSnow });
  const coalM = new THREE.MeshLambertMaterial({ color: 0x1b1b22 });
  const carrotM = new THREE.MeshLambertMaterial({ color: 0xff8a2a });
  const scarfCols = [0xc8323a, 0x2f7d5b, 0x3b6bd1];
  [[-140, 14], [140, 14], [-25, 15.5]].forEach(([deg, rr], i) => {
    const { x, z } = yardAt(deg, rr);
    const sm = new THREE.Group();
    sm.position.set(x, 0, z);
    sm.rotation.y = Math.atan2(YARD.x - x, YARD.z - z) + (i - 1) * 0.4;   // 마당 쪽을 바라봄
    const ball = (r, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), snowM); m.position.y = y; m.castShadow = true; sm.add(m); return m; };
    ball(0.55, 0.45); ball(0.4, 1.15); ball(0.28, 1.68);
    for (const ex of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), coalM); e.position.set(ex, 1.74, 0.25); sm.add(e); }
    for (const by of [1.05, 1.22]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), coalM); b.position.set(0, by, 0.39); sm.add(b); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 8), carrotM);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.67, 0.36); sm.add(nose);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 20), new THREE.MeshLambertMaterial({ color: scarfCols[i] }));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.45; sm.add(scarf);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 14), coalM);
    hat.position.y = 2.02; sm.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 16), coalM);
    brim.position.y = 1.9; sm.add(brim);
    scene.add(sm);
    trees.push({ x, z, r: 0.55 });
  });
}

/* ───────── 출발점 표지판 ───────── */
const mailboxSpot = new THREE.Vector3();          // 음악 우체통 자리 (노래 추천 받을 때 씀)
const signHearts = [];          // 표지판 하트 전구 { mat, glow, base, phase, size }
{
  const p = pathCurve.getPointAt(START_T);
  const tan = pathCurve.getTangentAt(START_T);
  const n = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const sign = new THREE.Group();
  const toHouse = new THREE.Vector3(-p.x, 0, -p.z).normalize();
  const side = new THREE.Vector3(toHouse.z, 0, -toHouse.x);
  sign.position.set(p.x + toHouse.x * 3.2 + side.x * 2.1, 0, p.z + toHouse.z * 3.2 + side.z * 2.1);
  sign.rotation.y = Math.atan2(-toHouse.x, -toHouse.z) - 0.35;   // 집으로 향하는 길 옆에서 다가오는 사람을 바라봄

  const wood = new THREE.MeshLambertMaterial({ color: COLORS.wood });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), wood);
  post.position.y = 0.8; post.castShadow = true;

  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#7a5236'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = 'rgba(60,35,20,0.35)'; g.lineWidth = 3;
  for (let y = 18; y < 128; y += 26) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 2); g.stroke(); }
  g.fillStyle = '#f6ead2';
  g.font = 'italic 64px Georgia, "Times New Roman", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('December Club', 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const faceMat = new THREE.MeshLambertMaterial({ map: tex });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.48, 0.08), [wood, wood, wood, wood, faceMat, faceMat]);
  board.position.set(0, 1.45, 0.08); board.castShadow = true;
  const snowTop = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 0.14), new THREE.MeshLambertMaterial({ color: COLORS.pineSnow }));
  snowTop.position.set(0, 1.72, 0.08);
  sign.add(post, board, snowTop);

  // 하트 모양 꼬마전구: 표지판 둘레를 따라 빙 둘러 달고, 위쪽엔 큰 하트 하나
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.5);
  heart.bezierCurveTo(-0.15, -0.3, -0.62, -0.05, -0.55, 0.3);
  heart.bezierCurveTo(-0.5, 0.58, -0.12, 0.62, 0, 0.32);
  heart.bezierCurveTo(0.12, 0.62, 0.5, 0.58, 0.55, 0.3);
  heart.bezierCurveTo(0.62, -0.05, 0.15, -0.3, 0, -0.5);
  const heartGeo = new THREE.ShapeGeometry(heart, 10);
  const HEART_COLS = [0xff4f7a, 0xffb3c8, 0xffe2a8];
  const glowMat = (col) => new THREE.SpriteMaterial({ map: dotTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
  const addHeart = (x, y, size, col, phase, z = 0.135) => {
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const m = new THREE.Mesh(heartGeo, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    const gl = new THREE.Sprite(glowMat(col));
    gl.position.set(x, y, z + 0.02);
    gl.scale.setScalar(size * 3.3);
    sign.add(m, gl);
    signHearts.push({ mat, glow: gl, base: new THREE.Color(col), phase, size });
  };
  const BW = 1.9 / 2 + 0.07, BH = 0.48 / 2 + 0.06, BY = 1.45;
  const perim = [];
  const NX = 11, NY = 3;
  for (let i = 0; i <= NX; i++) perim.push([-BW + (i / NX) * BW * 2, BY + BH]);
  for (let i = 1; i < NY; i++) perim.push([BW, BY + BH - (i / NY) * BH * 2]);
  for (let i = NX; i >= 0; i--) perim.push([-BW + (i / NX) * BW * 2, BY - BH]);
  for (let i = NY - 1; i >= 1; i--) perim.push([-BW, BY + BH - (i / NY) * BH * 2]);
  perim.forEach(([x, y], i) => addHeart(x, y, 0.085, HEART_COLS[i % 3], -i * 0.55));
  addHeart(0, BY + BH + 0.2, 0.34, 0xff3d6e, 0, 0.09);               // 표지판 위에 얹은 큰 하트
  const heartLight = new THREE.PointLight(0xff8fb0, 4, 6, 1.4);
  heartLight.position.set(0, 1.5, 0.8);
  sign.add(heartLight);

  // 표지판 옆 빨간 빈티지 우체통 (연말에 듣고 싶은 노래를 추천받는 곳)
  const box = makeMailbox();
  box.position.set(1.55, 0, 0.35);
  box.rotation.y = -0.25;
  sign.add(box);

  scene.add(sign);
  trees.push({ x: sign.position.x, z: sign.position.z, r: 0.3 });
  sign.updateMatrixWorld(true);
  const bp = box.getWorldPosition(new THREE.Vector3());
  trees.push({ x: bp.x, z: bp.z, r: 0.42 });
  mailboxSpot.copy(bp);
}

/* 빈티지 우체통: 둥근 기둥형 몸통, 둥근 지붕, 투입구, 크림색 MUSIC 명판, 바랜 금색 테
   칠이 조금씩 벗겨진 빨간 페인트 느낌을 캔버스로 그려 입힘 */
function makeMailbox() {
  const g = new THREE.Group();
  const paintTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#b3161e'; x.fillRect(0, 0, 256, 256);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {                         // 얼룩·바랜 자국
      x.fillStyle = rnd() < 0.5 ? `rgba(90, 8, 12, ${0.05 + rnd() * 0.12})` : `rgba(230, 90, 80, ${0.03 + rnd() * 0.06})`;
      x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 6, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 40; i++) {                          // 벗겨진 칠 사이로 보이는 쇠
      x.fillStyle = `rgba(60, 40, 35, ${0.25 + rnd() * 0.3})`;
      x.beginPath(); x.ellipse(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 0.6 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2); x.fill();
    }
    const grad = x.createLinearGradient(0, 0, 0, 256);     // 아래쪽은 흙탕물에 살짝 어두움
    grad.addColorStop(0.7, 'rgba(40, 10, 10, 0)'); grad.addColorStop(1, 'rgba(40, 10, 10, 0.35)');
    x.fillStyle = grad; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const red = new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.55, metalness: 0.15, emissive: 0x3a0306, emissiveIntensity: 0.6 });
  const darkRed = new THREE.MeshStandardMaterial({ color: 0x6e0b10, roughness: 0.6, metalness: 0.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.45, metalness: 0.7, emissive: 0x2a1a00 });
  const black = new THREE.MeshStandardMaterial({ color: 0x140808, roughness: 0.8 });
  const snowM = new THREE.MeshLambertMaterial({ color: COLORS.pineSnow });
  const add = (geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true; o.receiveShadow = true;
    g.add(o);
    return o;
  };

  add(new THREE.CylinderGeometry(0.36, 0.38, 0.12, 32), darkRed, 0, 0.06, 0);           // 받침
  add(new THREE.CylinderGeometry(0.3, 0.32, 1.02, 32), red, 0, 0.63, 0);                // 몸통
  add(new THREE.TorusGeometry(0.31, 0.012, 8, 40), brass, 0, 0.2, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.335, 0.335, 0.07, 32), darkRed, 0, 1.17, 0);         // 지붕 테
  add(new THREE.TorusGeometry(0.335, 0.013, 8, 40), brass, 0, 1.2, 0).rotation.x = Math.PI / 2;
  const dome = add(new THREE.SphereGeometry(0.33, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 1.2, 0);
  dome.scale.y = 0.55;
  add(new THREE.SphereGeometry(0.05, 16, 12), brass, 0, 1.39, 0);                       // 꼭지
  const cap = add(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), snowM, 0.02, 1.25, -0.01);
  cap.scale.set(1, 0.42, 0.96);                                                           // 지붕에 쌓인 눈

  // 투입구: 검은 틈 + 금색 덮개
  add(new THREE.BoxGeometry(0.28, 0.045, 0.06), black, 0, 1.0, 0.285);
  add(new THREE.BoxGeometry(0.32, 0.02, 0.07), brass, 0, 1.035, 0.29);

  // 명판: 크림색 법랑판에 MUSIC
  const c = document.createElement('canvas');
  c.width = 256; c.height = 176;
  const x = c.getContext('2d');
  x.fillStyle = '#f1e4c6'; x.beginPath(); x.roundRect(6, 6, 244, 164, 22); x.fill();
  x.strokeStyle = '#8a1016'; x.lineWidth = 6; x.beginPath(); x.roundRect(16, 16, 224, 144, 16); x.stroke();
  x.fillStyle = '#9d121a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 54px Georgia, "Times New Roman", serif';
  x.fillText('MUSIC', 128, 74);
  x.font = 'italic 24px Georgia, serif';
  x.fillText('♪  song requests  ♪', 128, 124);
  const plateTex = new THREE.CanvasTexture(c);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;
  const plate = add(new THREE.CylinderGeometry(0.306, 0.306, 0.24, 32, 1, true, -0.62, 1.24),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.05, transparent: true, alphaTest: 0.3, emissive: 0xffffff, emissiveMap: plateTex, emissiveIntensity: 0.18 }), 0, 0.78, 0);
  plate.castShadow = false;

  // 수거 문(아래쪽 네모 문짝 + 열쇠 구멍)
  const door = add(new THREE.CylinderGeometry(0.304, 0.304, 0.3, 32, 1, true, -0.5, 1.0), darkRed, 0, 0.42, 0);
  door.material = darkRed.clone(); door.material.side = THREE.DoubleSide;
  add(new THREE.SphereGeometry(0.018, 10, 8), brass, 0, 0.47, 0.305);

  // 밤에도 보이게 따뜻한 빛 하나
  const glow = new THREE.PointLight(0xffb27a, 2.2, 4, 1.6);
  glow.position.set(0, 1.3, 0.9);
  g.add(glow);
  return g;
}

/* ───────── 반짝이는 전구 (점 두 겹: 작은 심지 + 번지는 빛) ───────── */
const twinkles = [];
function bulbs(pos, cols, { core = 0.14, glow = 0.9, speed = 2, chase = 0 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols.slice(), 3));
  const gg = g.clone();
  const coreP = new THREE.Points(g, new THREE.PointsMaterial({
    size: core, vertexColors: true, map: dotTex, transparent: true, depthWrite: false,
  }));
  const glowP = new THREE.Points(gg, new THREE.PointsMaterial({
    size: glow, vertexColors: true, map: dotTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.6,
  }));
  const n = pos.length / 3;
  // chase > 0 이면 순서대로 흐르듯 깜빡임, 아니면 제각각 반짝임
  const phase = Float32Array.from({ length: n }, (_, i) => (chase ? -i * chase : Math.random() * Math.PI * 2));
  twinkles.push({ glow: gg.attributes.color, core: g.attributes.color, base: Float32Array.from(cols), phase, speed });
  return [coreP, glowP];
}

const hexRGB = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

function woodTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.lineWidth = 3;
  for (let y = 0; y <= 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function labelSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = 'italic 84px Georgia, "Times New Roman", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 28;
  g.fillStyle = '#fff6e4';
  g.fillText(text, 256, 84);
  g.shadowBlur = 0;
  g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(4.2, 1.31, 1);
  return s;
}

/* ───────── 캔버스 텍스처 도우미 ───────── */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = mulberry(42);
const brickTex = (rx, ry) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#cfc4b6'; g.fillRect(0, 0, w, h);          // 줄눈
  const bh = 32, bw = 64;
  for (let row = 0; row < h / bh; row++) {
    for (let col = -1; col <= w / bw; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh, v = 0.8 + rnd() * 0.35;
      g.fillStyle = `rgb(${150 * v | 0},${60 * v | 0},${46 * v | 0})`;
      g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }
}, [rx, ry]);
const floorTex = canvasTex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 32) {
    for (let y = -64; y < h; y += 128) {
      const off = ((x / 32) % 2) * 64, v = 0.85 + rnd() * 0.25;
      g.fillStyle = `rgb(${138 * v | 0},${88 * v | 0},${52 * v | 0})`;
      g.fillRect(x, y + off, 32, 128);
      g.fillStyle = 'rgba(40,20,10,0.45)';
      g.fillRect(x, y + off, 1.5, 128);
      g.fillRect(x, y + off, 32, 1.5);
    }
  }
}, [5, 4]);
const wallpaperTex = (len) => canvasTex(256, 256, (g, w, h) => {
  const rail = h * 0.64;
  g.fillStyle = '#ecdfc6'; g.fillRect(0, 0, w, rail);                   // 크림색 줄무늬 벽지
  g.fillStyle = 'rgba(176,132,92,0.18)';
  for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, rail);
  g.fillStyle = 'rgba(160,60,50,0.22)';                                  // 작은 꽃무늬
  for (let y = 16; y < rail; y += 40) for (let x = 21; x < w; x += 32) { g.beginPath(); g.arc(x + ((y / 40) % 2) * 0, y, 2.2, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#f4efe4'; g.fillRect(0, rail, w, h - rail);             // 흰 판넬 벽 (웨인스코팅)
  g.strokeStyle = 'rgba(150,130,100,0.45)'; g.lineWidth = 3;
  for (let x = 8; x < w; x += 64) g.strokeRect(x, rail + 18, 48, h - rail - 34);
  g.fillStyle = '#7a5236'; g.fillRect(0, rail - 4, w, 9);                // 의자 높이 몰딩
  g.fillStyle = '#5c3b26'; g.fillRect(0, h - 10, w, 10);                 // 걸레받이
}, [len / 2.6, 1]);
const plankTex = (rx, ry) => { const t = woodTexture('#8a3b33', 'rgba(60,20,18,0.45)'); t.repeat.set(rx, ry); return t; };
const rugTex = canvasTex(256, 256, (g, w, h) => {
  const cols = ['#8e2b2b', '#e9dcc0', '#2f5d45', '#b8862f', '#8e2b2b', '#e9dcc0', '#2f5d45', '#8e2b2b'];
  cols.forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - i * 15, h / 2 - i * 15, 0, 0, Math.PI * 2); g.fill();
  });
});
const flameTex = canvasTex(64, 128, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h * 0.78, 2, w / 2, h * 0.62, h * 0.55);
  grad.addColorStop(0, 'rgba(255,250,210,1)');
  grad.addColorStop(0.25, 'rgba(255,200,80,0.95)');
  grad.addColorStop(0.6, 'rgba(255,110,30,0.6)');
  grad.addColorStop(1, 'rgba(200,40,10,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w / 2, 4);
  g.bezierCurveTo(w * 0.95, h * 0.5, w, h * 0.95, w / 2, h - 2);
  g.bezierCurveTo(0, h * 0.95, w * 0.05, h * 0.5, w / 2, 4);
  g.fill();
});
const paintingTex = canvasTex(160, 120, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0b1f5c'); sky.addColorStop(1, '#3d5c9c');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4efe0'; g.beginPath(); g.arc(w * 0.78, h * 0.25, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8eef8'; g.beginPath(); g.ellipse(w * 0.3, h * 1.05, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(w * 0.85, h * 1.1, w * 0.5, h * 0.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1d4a3c';
  for (const [x, s] of [[0.2, 1], [0.32, 0.7], [0.62, 0.9], [0.72, 0.6]]) {
    g.beginPath(); g.moveTo(w * x, h * (0.72 - 0.3 * s)); g.lineTo(w * x + 12 * s, h * 0.75); g.lineTo(w * x - 12 * s, h * 0.75); g.fill();
  }
  g.fillStyle = '#ffd27a'; g.fillRect(w * 0.47, h * 0.6, 10, 8);
});

/* ───────── 중앙의 집 (들어갈 수 있는 오두막) ───────── */
const smoke = [];
const stars = [];          // 천천히 도는 별 장식들
const HOUSE = { W: 10, D: 8, H: 3.4, T: 0.25 };
const house = {
  group: new THREE.Group(),
  roof: new THREE.Group(),
  walls: [],          // { group, n: 로컬 바깥쪽 법선, half }
  fire: [], fireLight: null, candles: [],
  inside: 0,          // 실내 전환 정도 0~1
};
// 집 로컬 좌표 → 월드 좌표
const houseToWorld = (lx, lz) => {
  const c = Math.cos(HOUSE_ROT), s = Math.sin(HOUSE_ROT);
  return [lx * c + lz * s, -lx * s + lz * c];
};
const houseBox = (lx, lz, hw, hd, rot = 0) => {
  const [x, z] = houseToWorld(lx, lz);
  boxes.push({ x, z, rot: HOUSE_ROT + rot, hw, hd });
};
{
  const { W, D, H, T } = HOUSE;
  const g = house.group;
  g.rotation.y = HOUSE_ROT;
  scene.add(g);
  g.add(house.roof);

  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const part = (geo, material, x, y, z, parent = g, shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const snowM = lam(COLORS.pineSnow);
  const trimM = lam(0xf1ead9);
  const woodM = lam(0x6b4429);
  const darkWoodM = lam(0x4a2e1c);

  /* ── 벽: 바깥은 붉은 판자, 안쪽은 벽지 ── */
  const wall = (n, half, pieces) => {
    const wg = new THREE.Group();
    g.add(wg);
    house.walls.push({ group: wg, n: new THREE.Vector3(n[0], 0, n[1]), half });
    for (const [w, h, d, x, y, z, len] of pieces) {
      const out = lam(0xffffff, { map: plankTex(Math.max(w, d) / 3.2, h / 2.6) });
      const inn = lam(0xffffff, { map: wallpaperTex(len ?? Math.max(w, d)) });
      inn.map.repeat.y = h / H;                       // 벽 높이 기준으로 벽지 무늬를 맞춤
      inn.map.offset.y = (y - h / 2) / H;
      // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z
      const mats = [out, out, out, out, out, out];
      if (n[0] === 1) mats[1] = inn; if (n[0] === -1) mats[0] = inn;
      if (n[1] === 1) mats[5] = inn; if (n[1] === -1) mats[4] = inn;
      part(new THREE.BoxGeometry(w, h, d), mats, x, y, z, wg);
    }
    return wg;
  };
  const DW = 1.8, DH = 2.5;                       // 현관 개구부
  const backW = wall([0, -1], D / 2, [[W, H, T, 0, H / 2, -D / 2 + T / 2]]);
  const leftW = wall([-1, 0], W / 2, [[T, H, D, -W / 2 + T / 2, H / 2, 0]]);
  const rightW = wall([1, 0], W / 2, [[T, H, D, W / 2 - T / 2, H / 2, 0]]);
  const sideLen = (W - DW) / 2;
  const frontW = wall([0, 1], D / 2, [
    [sideLen, H, T, -(DW / 2 + sideLen / 2), H / 2, D / 2 - T / 2],
    [sideLen, H, T, DW / 2 + sideLen / 2, H / 2, D / 2 - T / 2],
    [DW, H - DH, T, 0, DH + (H - DH) / 2, D / 2 - T / 2],
  ]);
  // 벽 충돌
  houseBox(0, -D / 2 + T / 2, W / 2, T / 2);
  houseBox(-W / 2 + T / 2, 0, T / 2, D / 2);
  houseBox(W / 2 - T / 2, 0, T / 2, D / 2);
  houseBox(-(DW / 2 + sideLen / 2), D / 2 - T / 2, sideLen / 2, T / 2);
  houseBox(DW / 2 + sideLen / 2, D / 2 - T / 2, sideLen / 2, T / 2);

  // 모서리 기둥 · 바닥 띠
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) part(new THREE.BoxGeometry(0.3, H, 0.3), trimM, x, H / 2, z);
  const baseM = lam(0x5d6680);                        // 바깥 기초 띠 (바닥을 덮지 않도록 테두리만)
  part(new THREE.BoxGeometry(W + 0.3, 0.3, 0.3), baseM, 0, 0.15, -D / 2);
  part(new THREE.BoxGeometry(0.3, 0.3, D + 0.3), baseM, -W / 2, 0.15, 0);
  part(new THREE.BoxGeometry(0.3, 0.3, D + 0.3), baseM, W / 2, 0.15, 0);
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(sideLen + 0.15, 0.3, 0.3), baseM, s * (DW / 2 + sideLen / 2 + 0.08), 0.15, D / 2, frontW);
  part(new THREE.BoxGeometry(DW + 0.4, 0.12, T + 0.3), trimM, 0, DH + 0.06, D / 2 - T / 2, frontW);
  for (const x of [-DW / 2 - 0.08, DW / 2 + 0.08]) part(new THREE.BoxGeometry(0.14, DH, T + 0.3), trimM, x, DH / 2, D / 2 - T / 2, frontW);

  /* ── 창문 (밖: 따뜻한 불빛 / 안: 밤하늘이 보이는 유리 + 커튼) ── */
  const winM = new THREE.MeshBasicMaterial({ color: 0xffcf7a });
  const nightM = new THREE.MeshBasicMaterial({ color: 0x1a3470 });
  const curtainM = lam(0x9c2f2c);
  const winGlow = new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,200,120,0.55)', 'rgba(255,200,120,0)'), depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const windowOn = (wg, x, y, z, ry) => {
    const w = new THREE.Group();
    w.position.set(x, y, z); w.rotation.y = ry;          // +z가 바깥
    wg.add(w);
    const o = T / 2 + 0.01;
    for (const side of [1, -1]) {                        // 1: 바깥면, -1: 안쪽면
      const f = new THREE.Group();
      f.position.z = side * o;
      if (side < 0) f.rotation.y = Math.PI;
      w.add(f);
      part(new THREE.PlaneGeometry(1.1, 1.3), side > 0 ? winM : nightM, 0, 0, 0.005, f, false);
      part(new THREE.BoxGeometry(1.3, 0.09, 0.07), trimM, 0, 0, 0.03, f, false);
      part(new THREE.BoxGeometry(0.09, 1.45, 0.07), trimM, 0, 0, 0.03, f, false);
      for (const sx of [-0.62, 0.62]) part(new THREE.BoxGeometry(0.09, 1.45, 0.07), trimM, sx, 0, 0.03, f, false);
      part(new THREE.BoxGeometry(1.34, 0.09, 0.07), trimM, 0, 0.7, 0.03, f, false);
      part(new THREE.BoxGeometry(1.45, 0.08, 0.2), side > 0 ? snowM : trimM, 0, -0.72, 0.1, f, false);
      if (side > 0) {
        const gl = new THREE.Sprite(winGlow);
        gl.scale.set(3, 3, 1); gl.position.z = 0.35;
        f.add(gl);
      } else {
        for (const cx of [-0.82, 0.82]) part(new THREE.BoxGeometry(0.3, 1.7, 0.06), curtainM, cx, -0.05, 0.08, f, false);
        part(new THREE.BoxGeometry(2.0, 0.06, 0.06), darkWoodM, 0, 0.92, 0.1, f, false);
      }
    }
  };
  const WY = 1.75, WO = D / 2 - T / 2, SO = W / 2 - T / 2;
  windowOn(frontW, -3.1, WY, WO, 0);
  windowOn(frontW, 3.1, WY, WO, 0);
  windowOn(leftW, -SO, WY, -1.6, -Math.PI / 2);
  windowOn(leftW, -SO, WY, 1.9, -Math.PI / 2);
  windowOn(rightW, SO, WY, -1.6, Math.PI / 2);
  windowOn(rightW, SO, WY, 1.9, Math.PI / 2);
  windowOn(backW, -3.3, WY, -WO, Math.PI);
  windowOn(backW, 3.3, WY, -WO, Math.PI);

  /* ── 지붕 (실내에 들어가면 숨김) ── */
  const RW = W / 2 + 0.5, RH = 3.0, RD = D + 1.0;
  const tri = new THREE.Shape();
  tri.moveTo(-RW, 0); tri.lineTo(RW, 0); tri.lineTo(0, RH); tri.closePath();
  part(new THREE.ExtrudeGeometry(tri, { depth: RD, bevelEnabled: false }).translate(0, 0, -RD / 2), lam(0x3b2a2a), 0, H, 0, house.roof);
  const slope = Math.atan2(RH, RW), sLen = Math.hypot(RH, RW);
  for (const side of [-1, 1]) {
    const sn = part(new THREE.BoxGeometry(sLen + 0.2, 0.28, RD + 0.15), snowM, side * RW / 2, H + RH / 2 + 0.14, 0, house.roof);
    sn.rotation.z = -side * slope;
  }
  const gableTex = woodTexture('#7d342d', 'rgba(60,20,18,0.45)');
  gableTex.repeat.set(1.2, 0.6);
  for (const z of [-RD / 2 - 0.01, RD / 2 + 0.01]) {
    const gm = part(new THREE.ShapeGeometry(tri), lam(0xffffff, { map: gableTex, side: THREE.DoubleSide }), 0, H, z, house.roof, false);
    gm.scale.set(0.88, 0.86, 1);
  }
  part(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0xffc66e }), 0, H + 1.15, RD / 2 + 0.03, house.roof, false);
  part(new THREE.TorusGeometry(0.47, 0.06, 6, 24), trimM, 0, H + 1.15, RD / 2 + 0.04, house.roof, false);

  // 굴뚝: 뒷벽 바깥쪽 벽돌 굴뚝 (벽난로와 이어짐)
  const chimM = lam(0xffffff, { map: brickTex(1, 5) });
  part(new THREE.BoxGeometry(1.3, H + RH + 1.3, 0.9), chimM, 0, (H + RH + 1.3) / 2, -D / 2 - 0.45);
  part(new THREE.BoxGeometry(1.45, 0.22, 1.05), snowM, 0, H + RH + 1.38, -D / 2 - 0.45);

  /* ── 현관: 닫힌 문 (문 열기 → 끼이익 하며 안쪽으로 열림), 문 위 리스, 현관등 ── */
  const hinge = new THREE.Group();
  hinge.position.set(-DW / 2 + 0.03, 0, D / 2 - T / 2);
  frontW.add(hinge);
  const doorM = lam(0x2f5d45);
  const panelW = DW - 0.06;
  const doorParts = [part(new THREE.BoxGeometry(panelW, DH - 0.05, 0.1), doorM, panelW / 2, (DH - 0.05) / 2, 0, hinge)];
  // 문판의 네모 장식(몰딩)과 손잡이 — 앞뒤 양쪽
  for (const sz of [1, -1]) {
    for (const [py, ph] of [[0.75, 0.95], [1.85, 0.75]]) {
      doorParts.push(part(new THREE.BoxGeometry(panelW * 0.66, ph, 0.03), lam(0x264d39), panelW / 2, py, sz * 0.055, hinge, false));
    }
    doorParts.push(part(new THREE.SphereGeometry(0.06, 10, 8), lam(0xd8b56a), panelW - 0.18, 1.1, sz * 0.09, hinge, false));
  }
  house.door = { hinge, open: false, angle: 0, meshes: doorParts, world: houseToWorld(0, D / 2 + 0.6) };
  // 닫혀 있을 땐 문도 벽처럼 막음
  {
    const [x, z] = houseToWorld(0, D / 2 - T / 2);
    house.door.box = { x, z, rot: HOUSE_ROT, hw: DW / 2, hd: T / 2, off: false };
    boxes.push(house.door.box);
  }
  // 리스는 문짝에 (문과 함께 열리도록 경첩에 붙임)
  {
    const wx = panelW / 2, wy = 1.85, wz = 0.09, R = 0.32;
    const wreath = part(new THREE.TorusGeometry(R, 0.1, 8, 22), lam(0x1f5a3a), wx, wy, wz, hinge, false);
    doorParts.push(wreath);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      part(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xe0303a }), wx + Math.cos(a) * R, wy + Math.sin(a) * R, wz + 0.09, hinge, false);
    }
    part(new THREE.SphereGeometry(0.08, 8, 6), lam(0xc8323a), wx, wy - R + 0.02, wz + 0.1, hinge, false);
  }

  // 문 위 큰 나무 간판: 빨간 글씨 'December Club'
  {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 250;
    const x = c.getContext('2d');
    // 나무판 (가로 널빤지 세 장 + 나뭇결)
    const planks = ['#e2bd86', '#d8b07a', '#e6c48f'];   // 밝은 소나무색 (빨간 벽과 구분되게)
    for (let i = 0; i < 3; i++) {
      x.fillStyle = planks[i]; x.fillRect(0, i * 83, 1024, 84);
      x.strokeStyle = 'rgba(90,55,30,0.22)'; x.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const y = i * 83 + 12 + k * 15 + Math.random() * 4;
        x.beginPath(); x.moveTo(0, y);
        x.bezierCurveTo(300, y + (Math.random() - 0.5) * 10, 700, y + (Math.random() - 0.5) * 10, 1024, y + (Math.random() - 0.5) * 6);
        x.stroke();
      }
      x.fillStyle = 'rgba(70,40,20,0.45)'; x.fillRect(0, i * 83 + 82, 1024, 3);
    }
    // 테두리 + 못
    x.strokeStyle = '#5a3420'; x.lineWidth = 18; x.strokeRect(9, 9, 1006, 232);
    x.fillStyle = '#4a3020';
    for (const [px, py] of [[32, 32], [992, 32], [32, 218], [992, 218]]) { x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill(); }
    // 글씨: 크림색 테두리 위에 빨간색
    let fs = 170;
    const font = () => `italic bold ${fs}px Georgia, "Times New Roman", serif`;
    x.font = font();
    while (x.measureText('December Club').width > 900 && fs > 60) { fs -= 4; x.font = font(); }   // 판 안에 꼭 맞게
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,244,226,0.9)'; x.lineWidth = 12;
    x.strokeText('December Club', 512, 132);
    x.fillStyle = '#c4161f';
    x.fillText('December Club', 512, 132);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const SW = 5.2, SH = SW * 250 / 1024;
    const woodSide = lam(0x8a5a34);
    const face = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x3a2a1c, emissiveMap: tex });   // 밤에도 글씨가 보이게 살짝 밝힘
    // 지붕 앞끝(벽보다 0.5m 앞)보다 더 앞에 걸어야 지붕에 묻히지 않음
    const sy = DH + 0.3 + SH / 2, sz = D / 2 + 0.62;
    const sign = part(new THREE.BoxGeometry(SW, SH, 0.14), [woodSide, woodSide, woodSide, woodSide, face, woodSide], 0, sy, sz, frontW);
    sign.castShadow = false;
    // 위에 소복이 쌓인 눈
    part(new THREE.BoxGeometry(SW + 0.08, 0.08, 0.22), snowM, 0, sy + SH / 2 + 0.04, sz, frontW, false);
    // 벽까지 이어 주는 나무 받침대
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.14, 0.14, sz - D / 2), lam(0x5a3420), sx * (SW / 2 - 0.5), sy - SH / 2 + 0.12, D / 2 + (sz - D / 2) / 2, frontW, false);
  }
  const porch = new THREE.PointLight(0xffc27a, 16, 13, 1.3);
  porch.position.set(0, 2.9, D / 2 + 1.4);
  g.add(porch);
  part(new THREE.BoxGeometry(1.6, 0.03, 0.9), lam(0x7a5236), 0, 0.03, D / 2 + 0.7, g, false);    // 현관 매트

  /* ── 지붕선 · 문틀 크리스마스 전구 ── */
  const PALETTE = ['#ff3b3b', '#ffd23f', '#3bd16f', '#3b8bff', '#ff7ad9', '#ff9a3b'].map(hexRGB);
  const lights = (parent, segs, opts) => {
    const pos = [], cols = [];
    for (const [a, b, step, sag] of segs) {
      const len = a.distanceTo(b), n = Math.max(2, Math.round(len / step));
      for (let i = 0; i < n; i++) {
        const f = i / n, droop = sag * Math.abs(Math.sin((f * len * Math.PI) / 1.1));
        pos.push(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f - droop, a.z + (b.z - a.z) * f);
        cols.push(...PALETTE[(pos.length / 3 - 1) % PALETTE.length]);
      }
    }
    parent.add(...bulbs(pos, cols, opts));
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ez = RD / 2 + 0.06;
  lights(house.roof, [
    [V(-RW, H - 0.05, ez), V(0, H + RH, ez), 0.3, 0], [V(0, H + RH, ez), V(RW, H - 0.05, ez), 0.3, 0],
    [V(-RW, H - 0.05, -ez), V(0, H + RH, -ez), 0.3, 0], [V(0, H + RH, -ez), V(RW, H - 0.05, -ez), 0.3, 0],
    [V(-RW, H - 0.08, -ez), V(-RW, H - 0.08, ez), 0.26, 0.15], [V(RW, H - 0.08, -ez), V(RW, H - 0.08, ez), 0.26, 0.15],
  ], { core: 0.16, glow: 0.85, speed: 3, chase: 0.45 });
  const dz = D / 2 + 0.1;
  lights(frontW, [
    [V(-DW / 2 - 0.2, 0.2, dz), V(-DW / 2 - 0.2, DH + 0.2, dz), 0.25, 0],
    [V(-DW / 2 - 0.2, DH + 0.2, dz), V(DW / 2 + 0.2, DH + 0.2, dz), 0.25, 0],
    [V(DW / 2 + 0.2, DH + 0.2, dz), V(DW / 2 + 0.2, 0.2, dz), 0.25, 0],
  ], { core: 0.15, glow: 0.8, speed: 3, chase: 0.45 });

  /* ── 실내: 미국식 거실 ── */
  const IW = W - 2 * T, ID = D - 2 * T;
  const floor = part(new THREE.PlaneGeometry(IW, ID), lam(0xffffff, { map: floorTex }), 0, 0.04, 0, g, false);
  floor.rotation.x = -Math.PI / 2;

  // 은은한 실내 조명 (천장등 대신)
  const room = new THREE.PointLight(0xffd9a8, 22, 14, 1.1);
  room.position.set(0, H - 0.3, 0.5);
  g.add(room);
  const room2 = new THREE.PointLight(0xffc890, 10, 9, 1.2);
  room2.position.set(0, 2.2, -1.2);
  g.add(room2);

  // 벽난로 (뒷벽 가운데, 벽돌)
  const fz = -D / 2 + T;                               // 뒷벽 안쪽 면
  const brickM = lam(0xffffff, { map: brickTex(2, 2) });
  const FW = 2.9, FD = 0.65, OW = 1.3, OH = 1.1, LOW = 1.75;
  const pil = (FW - OW) / 2;
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(pil, LOW, FD), brickM, s * (OW / 2 + pil / 2), LOW / 2, fz + FD / 2);
  part(new THREE.BoxGeometry(OW, LOW - OH, FD), brickM, 0, OH + (LOW - OH) / 2, fz + FD / 2);
  part(new THREE.BoxGeometry(2.3, H - LOW, 0.45), lam(0xffffff, { map: brickTex(1.5, 1.5) }), 0, LOW + (H - LOW) / 2, fz + 0.22);
  const sootM = new THREE.MeshBasicMaterial({ color: 0x140a06 });
  part(new THREE.BoxGeometry(OW, OH, 0.06), sootM, 0, OH / 2, fz + 0.06, g, false);
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.04, OH, FD - 0.1), sootM, s * (OW / 2 - 0.02), OH / 2, fz + FD / 2, g, false);
  part(new THREE.BoxGeometry(OW, 0.04, FD - 0.1), sootM, 0, OH - 0.02, fz + FD / 2, g, false);
  part(new THREE.BoxGeometry(3.3, 0.12, 1.1), lam(0x7d7a78), 0, 0.06, fz + 0.55);            // 화로 앞 돌판
  part(new THREE.BoxGeometry(3.3, 0.14, 0.55), woodM, 0, LOW + 0.07, fz + 0.3);              // 맨틀(선반)
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.12, 0.25, 0.4), woodM, s * 1.45, LOW - 0.1, fz + 0.3);
  // 장작
  for (const [x, y, r] of [[-0.18, 0.16, 0.25], [0.18, 0.16, -0.25], [0, 0.3, 0.05]]) {
    const log = part(new THREE.CylinderGeometry(0.09, 0.1, 0.9, 8), lam(0x5a3a22), x * 0.5, y, fz + 0.32, g, false);
    log.rotation.z = Math.PI / 2; log.rotation.y = r;
  }
  part(new THREE.BoxGeometry(0.9, 0.06, 0.4), lam(0x2a2220), 0, 0.09, fz + 0.32, g, false);
  // 불꽃 (스프라이트 여러 장이 일렁임)
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set((i - 2) * 0.17, 0.5, fz + 0.38);
    g.add(s);
    house.fire.push({ s, phase: rnd() * 10, w: 0.35 + rnd() * 0.15, h: 0.65 + rnd() * 0.3 });
  }
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,140,50,0.55)', 'rgba(255,140,50,0)'), depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  fireGlow.scale.set(3.2, 2.4, 1); fireGlow.position.set(0, 0.6, fz + 0.7);
  g.add(fireGlow);
  house.fireGlow = fireGlow;
  house.fireLight = new THREE.PointLight(0xff8a3c, 14, 11, 1.3);
  house.fireLight.position.set(0, 0.8, fz + 1.1);
  g.add(house.fireLight);
  houseBox(0, fz + 0.55, 1.65, 0.6);

  // 맨틀 위: 양말 3개, 초, 가랜드, 리스
  [-0.9, 0, 0.9].forEach((x, i) => {
    const st = new THREE.Group();
    st.position.set(x, LOW - 0.05, fz + 0.6);
    st.rotation.z = (i - 1) * 0.04;
    g.add(st);
    const c = [0xc8323a, 0x2f6b55, 0xc8323a][i];
    part(new THREE.BoxGeometry(0.24, 0.45, 0.07), lam(c), 0, -0.3, 0, st);
    part(new THREE.BoxGeometry(0.3, 0.16, 0.07), lam(c), 0.07, -0.52, 0, st);
    part(new THREE.BoxGeometry(0.28, 0.1, 0.09), trimM, 0, -0.08, 0, st);
  });
  const gpos = [], gcol = [];
  for (let i = 0; i <= 26; i++) {
    const x = -1.6 + (i / 26) * 3.2, y = LOW + 0.12 - Math.abs(Math.sin(i * 0.6)) * 0.12;
    part(new THREE.SphereGeometry(0.09, 6, 5), lam(0x1f5a3a), x, y, fz + 0.56, g, false);
    if (i % 2 === 0) { gpos.push(x, y + 0.02, fz + 0.62); gcol.push(...hexRGB('#ffd27a')); }
  }
  g.add(...bulbs(gpos, gcol, { core: 0.1, glow: 0.45, speed: 1.4 }));
  for (const x of [-1.3, 1.3]) {
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), lam(0xf3ece0), x, LOW + 0.29, fz + 0.3);
    const cf = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    cf.scale.set(0.07, 0.14, 1); cf.position.set(x, LOW + 0.5, fz + 0.3);
    g.add(cf);
    house.candles.push(cf);
  }
  const mw = part(new THREE.TorusGeometry(0.42, 0.13, 8, 22), lam(0x1f5a3a), 0, 2.7, fz + 0.48);
  mw.castShadow = false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xe0303a }), Math.cos(a) * 0.42, 2.7 + Math.sin(a) * 0.42, fz + 0.6, g, false);
  }

  // 러그 · 소파 · 안락의자 · 커피 테이블
  const rug = part(new THREE.CircleGeometry(1, 40), lam(0xffffff, { map: rugTex }), 0, 0.05, fz + 2.6, g, false);
  rug.rotation.x = -Math.PI / 2; rug.scale.set(2.2, 1.45, 1);

  const sofaM = lam(0x2f5d45), plaidM = lam(0x9c2f2c), cushionM = lam(0xe9dcc0);
  const sofa = new THREE.Group();
  sofa.position.set(0, 0, fz + 4.3);
  g.add(sofa);
  part(new THREE.BoxGeometry(2.8, 0.45, 0.95), sofaM, 0, 0.3, 0, sofa);
  part(new THREE.BoxGeometry(2.8, 0.7, 0.25), sofaM, 0, 0.8, 0.38, sofa);
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.25, 0.65, 0.95), sofaM, s * 1.42, 0.45, 0, sofa);
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(1.25, 0.14, 0.75), cushionM, s * 0.64, 0.6, -0.05, sofa);
  for (const s of [-1, 1]) { const p = part(new THREE.BoxGeometry(0.4, 0.4, 0.12), plaidM, s * 1.0, 0.85, 0.2, sofa); p.rotation.z = s * 0.15; }
  part(new THREE.BoxGeometry(0.9, 0.04, 0.7), plaidM, -0.55, 0.69, -0.02, sofa);                // 무릎 담요
  houseBox(0, fz + 4.3, 1.55, 0.5);

  const chair = (x, z, ry) => {
    const c = new THREE.Group();
    c.position.set(x, 0, z); c.rotation.y = ry;
    g.add(c);
    part(new THREE.BoxGeometry(0.95, 0.45, 0.9), plaidM, 0, 0.3, 0, c);
    part(new THREE.BoxGeometry(0.95, 0.95, 0.22), plaidM, 0, 0.95, 0.36, c);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.18, 0.62, 0.85), plaidM, s * 0.48, 0.5, 0, c);
    part(new THREE.BoxGeometry(0.7, 0.12, 0.65), cushionM, 0, 0.58, -0.05, c);
    houseBox(x, z, 0.55, 0.55, ry);
  };
  chair(-2.3, fz + 2.3, -2.4);
  chair(2.3, fz + 2.3, 2.4);

  const table = new THREE.Group();
  table.position.set(0, 0, fz + 2.9);
  g.add(table);
  part(new THREE.BoxGeometry(1.3, 0.08, 0.65), woodM, 0, 0.44, 0, table);
  for (const x of [-0.58, 0.58]) for (const z of [-0.26, 0.26]) part(new THREE.BoxGeometry(0.07, 0.42, 0.07), darkWoodM, x, 0.21, z, table);
  for (const [x, c] of [[-0.3, 0xc8323a], [0.05, 0xf3ece0]]) {
    part(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 12), lam(c), x, 0.54, 0.05, table);       // 코코아 머그
    part(new THREE.CircleGeometry(0.05, 12), lam(0x5a3420), x, 0.601, 0.05, table, false).rotation.x = -Math.PI / 2;
  }
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), trimM, 0.38, 0.49, -0.05, table);       // 쿠키 접시
  for (let i = 0; i < 4; i++) part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), lam(0xc8925a), 0.38 + Math.cos(i * 1.6) * 0.08, 0.51, -0.05 + Math.sin(i * 1.6) * 0.08, table, false);
  houseBox(0, fz + 2.9, 0.65, 0.33);

  // 실내 크리스마스트리 + 선물 상자
  const tx = W / 2 - T - 1.1, tz = -D / 2 + T + 1.1;
  const itree = new THREE.Group();
  itree.position.set(tx, 0, tz);
  itree.scale.setScalar(0.78);
  g.add(itree);
  const itm = new THREE.Mesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  itm.castShadow = true;
  itree.add(itm);
  const ip = [], ic = [];
  const IPAL = ['#ff3b3b', '#ffd23f', '#ffffff', '#3b8bff'].map(hexRGB);
  for (let i = 0; i < 70; i++) {
    const f = i / 70, y = 0.75 + f * 2.2, r = 1.15 * (1 - (y - 0.55) / 2.8) + 0.06, a = f * 6 * Math.PI * 2;
    ip.push(Math.cos(a) * r, y, Math.sin(a) * r);
    ic.push(...IPAL[i % IPAL.length]);
  }
  itree.add(...bulbs(ip, ic, { core: 0.12, glow: 0.6, speed: 2 }));
  const ist = new THREE.Mesh(starShape(), new THREE.MeshBasicMaterial({ color: 0xffd86b }));
  ist.position.y = 3.35; ist.scale.setScalar(0.55);
  itree.add(ist);
  stars.push(ist);
  [[0.9, 0.5, 0xc8323a], [0.5, 1.0, 0x2f6b55], [1.2, 0.0, 0x3b6bc8], [-0.2, 1.1, 0xd8b56a]].forEach(([ox, oz, c], i) => {
    const s = 0.3 + (i % 2) * 0.12;
    part(new THREE.BoxGeometry(s, s * 0.8, s), lam(c), tx - ox * 0.8, s * 0.4, tz + oz * 0.8, g);
    part(new THREE.BoxGeometry(s + 0.01, s * 0.8 + 0.01, 0.05), lam(0xf3ece0), tx - ox * 0.8, s * 0.4, tz + oz * 0.8, g, false);
  });
  houseBox(tx, tz, 0.85, 0.85);

  // 책장 (왼쪽 벽)
  const bx = -W / 2 + T + 0.22;
  const shelf = new THREE.Group();
  shelf.position.set(bx, 0, 0.15);
  g.add(shelf);
  part(new THREE.BoxGeometry(0.42, 2.3, 1.7), darkWoodM, 0, 1.15, 0, shelf);
  const BOOK = [0x8e2b2b, 0x2f5d45, 0xb8862f, 0x3b4f7a, 0xe9dcc0, 0x5a3a28];
  for (let row = 0; row < 4; row++) {
    const y = 0.25 + row * 0.55;
    part(new THREE.BoxGeometry(0.36, 0.04, 1.6), woodM, 0.04, y - 0.02, 0, shelf, false);
    let z = -0.75;
    while (z < 0.7) {
      const t = 0.05 + rnd() * 0.06, h = 0.32 + rnd() * 0.12;
      part(new THREE.BoxGeometry(0.28, h, t), lam(BOOK[Math.floor(rnd() * BOOK.length)]), 0.08, y + h / 2, z + t / 2, shelf, false);
      z += t + 0.01;
    }
  }
  houseBox(bx, 0.15, 0.25, 0.88);

  // 스탠드 조명 (소파 옆)
  const lx = 1.85, lz = fz + 4.6;
  part(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), darkWoodM, lx, 0.75, lz);
  part(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), darkWoodM, lx, 0.02, lz);
  part(new THREE.CylinderGeometry(0.16, 0.26, 0.3, 16, 1, true), lam(0xf3e2c0, { side: THREE.DoubleSide, emissive: 0x7a5a30 }), lx, 1.55, lz, g, false);
  const lampLight = new THREE.PointLight(0xffd29a, 5, 6, 1.4);
  lampLight.position.set(lx, 1.45, lz);
  g.add(lampLight);

  // 액자 (오른쪽 벽)
  const px = W / 2 - T - 0.03;
  for (const [z, s] of [[0.15, 1]]) {
    const fr = part(new THREE.BoxGeometry(0.06, 0.95 * s, 1.25 * s), lam(0xb8862f), px, 2.0, z, rightW, false);
    const pic = part(new THREE.PlaneGeometry(1.1 * s, 0.82 * s), lam(0xffffff, { map: paintingTex }), px - 0.035, 2.0, z, rightW, false);
    pic.rotation.y = -Math.PI / 2;
    fr.castShadow = false;
  }

  // 굴뚝 연기
  const [cx, cz] = houseToWorld(0, -D / 2 - 0.45);
  const chim = new THREE.Vector3(cx, H + RH + 1.6, cz);
  const smokeMat = new THREE.SpriteMaterial({ map: dotTex, color: 0xc9d3e6, transparent: true, depthWrite: false, opacity: 0 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(smokeMat.clone());
    scene.add(s);
    smoke.push({ s, origin: chim, life: (i / 14) * 5, max: 5 });
  }
}

// 캐릭터가 집 안에 있는지 (집 로컬 좌표로 판단)
function insideHouse(x, z, pad = 0) {
  const c = Math.cos(HOUSE_ROT), s = Math.sin(HOUSE_ROT);
  const lx = x * c - z * s, lz = x * s + z * c;
  return Math.abs(lx) < HOUSE.W / 2 - pad && Math.abs(lz) < HOUSE.D / 2 - pad;
}

function starShape() {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.22 : 0.5;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06);
}

/* ───────── 집을 둘러싼 다섯 그루의 큰 나무 ─────────
   카드가 많이 걸릴수록 조금씩 커지고 밝아짐 */
const BIG_TREES = [
  { name: 'Friends', glow: '#ffb347', colors: ['#ffd36b', '#ffb347', '#fff1c1'] },
  { name: 'Family',  glow: '#ff5a5a', colors: ['#ff4a4a', '#ffd36b', '#fff4ea'] },
  { name: 'Growth',  glow: '#7dff9a', colors: ['#9bf59b', '#e8fff0', '#ffd36b'] },
  { name: 'Feeling', glow: '#ff8fc7', colors: ['#ff8fc7', '#ffc2e0', '#ffffff'] },
  { name: 'Wish',    glow: '#8fb8ff', colors: ['#8fb8ff', '#c9a6ff', '#ffffff'] },
];
const TREE = { TOP: 3.1, BASE: 0.55, R0: 1.15, SCALE: 1.6, GROW: 1.2, GROW_N: 12, MAX_CARDS: 40 };
// 처음 몇 장은 눈에 띄게 쑥쑥, 많아질수록 천천히 (1장 +10%, 5장 +40%, 12장 +76%, 40장 약 2.2배 — 옆 트리와 닿지 않는 한도)
const treeScaleFor = (n) => TREE.SCALE * (1 + TREE.GROW * (1 - Math.exp(-n / TREE.GROW_N)));
{
  const RADIUS = PLAZA.TREE_R;
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const starGeo = starShape();
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd86b });
  const starGlowTex = radialTexture('rgba(255,220,130,0.7)', 'rgba(255,220,130,0)');
  const { TOP, BASE, R0 } = TREE;

  BIG_TREES.forEach((info, k) => {
    const { x, z } = yardAt(PLAZA.ANGLES[k], RADIUS);          // 마당을 빙 둘러섬
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);

    const mesh = new THREE.Mesh(treeGeo, treeMat);
    mesh.rotation.y = k * 1.3;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.info = info;
    group.add(mesh);

    // 나무 자체엔 조명을 달지 않음 — 걸린 카드만 빛남

    const st = new THREE.Mesh(starGeo, starMat);
    st.position.y = TOP + 0.2;
    st.scale.setScalar(0.4);
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: starGlowTex, depthWrite: false, blending: THREE.AdditiveBlending }));
    sg.position.copy(st.position);
    group.add(st, sg);
    stars.push(st);

    const light = new THREE.PointLight(new THREE.Color(info.glow), 0, 9, 1.4);   // 카드가 걸리면 그 빛이 주변을 물들임
    light.position.y = 1.2;
    group.add(light);

    const label = labelSprite(info.name, info.glow);
    scene.add(label);

    const count = 0;                                         // 서버에서 카드 목록을 받아 오면 채워짐
    const collider = { x, z, r: 0 };
    trees.push(collider);
    Object.assign(info, {
      x, z, group, mesh, light, starGlow: sg, label, collider,
      count, scale: treeScaleFor(count), top: TOP, base: BASE, r0: R0,
    });
    applyTreeLevel(info, 1);
  });
}

// 카드 수에 맞춰 크기·밝기를 목표값 쪽으로 (k=1 이면 즉시)
function applyTreeLevel(info, k) {
  info.scale += (treeScaleFor(info.count) - info.scale) * k;
  const boost = Math.min(info.count, TREE.MAX_CARDS) / TREE.MAX_CARDS;       // 0 ~ 1
  info.boost = (info.boost ?? boost) + (boost - (info.boost ?? boost)) * k;
  const b = info.boost;
  info.group.scale.setScalar(info.scale);
  info.collider.r = 0.55 * info.scale;
  const lit = Math.min(1, info.count);                                       // 카드가 하나라도 있으면
  info.litK = (info.litK ?? lit) + (lit - (info.litK ?? lit)) * k;
  info.light.intensity = info.litK * (3 + b * 26);
  info.light.distance = 7 + b * 9;
  info.starGlow.scale.setScalar(1.6 + b * 2.2);
  info.label.position.set(info.x, (TREE.TOP + 0.75) * info.scale + 0.3, info.z);
}

function animateDecor(dt, t) {
  // 표지판 하트 전구: 둘레를 따라 흐르듯 반짝, 큰 하트는 콩닥콩닥
  for (const h of signHearts) {
    const big = h.size > 0.2;
    const k = big ? 0.75 + 0.25 * Math.pow(Math.max(0, Math.sin(t * 3.2)), 6) : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + h.phase));
    h.mat.color.copy(h.base).multiplyScalar(0.55 + 0.6 * k);
    h.glow.material.opacity = 0.18 + 0.47 * k;
    if (big) h.glow.scale.setScalar(h.size * (3.6 + k * 1.4));
  }
  for (const tw of twinkles) {
    const { glow, core, base, phase, speed } = tw;
    const lift = tw.info ? 1 + tw.info.boost * 0.9 : 1;      // 카드가 많을수록 전구도 밝게
    for (let i = 0; i < phase.length; i++) {
      const k = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * speed + phase[i]))) * lift;
      for (let c = 0; c < 3; c++) {
        glow.array[i * 3 + c] = base[i * 3 + c] * k;
        core.array[i * 3 + c] = base[i * 3 + c] * Math.min(1.6, 0.55 + 0.45 * k);
      }
    }
    glow.needsUpdate = true;
    core.needsUpdate = true;
  }
  for (const st of stars) st.rotation.y += dt * 0.8;
  for (const info of BIG_TREES) applyTreeLevel(info, Math.min(1, dt * 2));

  // 굴뚝 연기
  for (const p of smoke) {
    p.life += dt;
    if (p.life > p.max) p.life -= p.max;
    const k = p.life / p.max;
    p.s.position.set(p.origin.x + k * 1.6 + Math.sin(t + k * 6) * 0.15, p.origin.y + k * 3.2, p.origin.z + k * 0.6);
    const sc = 0.5 + k * 1.8;
    p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = 0.38 * Math.sin(Math.PI * k);
  }

  // 벽난로 불꽃 일렁임
  for (const f of house.fire) {
    const n = Math.sin(t * 7.3 + f.phase) * 0.5 + Math.sin(t * 13.1 + f.phase * 2) * 0.3;
    f.s.scale.set(f.w * (1 + n * 0.12), f.h * (1 + n * 0.25), 1);
    f.s.position.y = 0.2 + f.h * (1 + n * 0.25) / 2;
    f.s.material.opacity = 0.75 + n * 0.2;
  }
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 4.3) * 0.4;
  house.fireLight.intensity = 14 + flick * 3;
  house.fireGlow.material.opacity = 0.8 + flick * 0.12;
  for (const c of house.candles) c.scale.y = 0.14 * (1 + Math.sin(t * 11 + c.position.x) * 0.15);
}

/* ───────── 마당 한가운데 모닥불 ───────── */
const campfire = { flames: [], embers: null, emberData: [], light: null, glow: null, seats: [] };
{
  const g = new THREE.Group();
  g.position.copy(YARD);
  scene.add(g);
  const rnd = mulberry(31);
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

  // 눈 위에 둥글게 놓은 돌
  const stoneGeo = new THREE.DodecahedronGeometry(0.26, 0);
  const stoneM = lam(0x8a8784), stoneSnow = lam(COLORS.pineSnow);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = new THREE.Mesh(stoneGeo, stoneM);
    st.position.set(Math.cos(a) * 1.05, 0.12, Math.sin(a) * 1.05);
    st.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    st.scale.set(1 + rnd() * 0.3, 0.7 + rnd() * 0.25, 1 + rnd() * 0.3);
    st.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), stoneSnow);
    cap.position.set(st.position.x * 1.06, 0.26, st.position.z * 1.06);
    cap.scale.y = 0.45;
    g.add(st, cap);
  }
  // 재와 숯
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), lam(0x2b2522));
  ash.rotation.x = -Math.PI / 2; ash.position.y = 0.02;
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0xff6a20 }));
  coals.rotation.x = -Math.PI / 2; coals.position.y = 0.03;
  g.add(ash, coals);
  campfire.coals = coals;
  // 원뿔(티피) 모양으로 세운 장작
  const logM = lam(0x6a4428), barkEnd = lam(0xc89a64);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.25, 7), [logM, barkEnd, barkEnd]);
    log.position.set(Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32);
    log.lookAt(0, 1.2, 0);
    log.rotateX(Math.PI / 2);
    log.castShadow = true;
    g.add(log);
  }
  // 바닥에 눕힌 굵은 장작 두 개
  for (const [a, y] of [[0.4, 0.1], [2.1, 0.12]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 1.3, 8), [logM, barkEnd, barkEnd]);
    log.rotation.z = Math.PI / 2; log.rotation.y = a; log.position.y = y;
    g.add(log);
  }
  // 불꽃
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = rnd() * Math.PI * 2, r = i === 0 ? 0 : 0.12 + rnd() * 0.22;
    s.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r);
    g.add(s);
    campfire.flames.push({ s, phase: rnd() * 10, w: (i === 0 ? 1.2 : 0.7 + rnd() * 0.35), h: (i === 0 ? 2.4 : 1.3 + rnd() * 0.8), x: s.position.x, z: s.position.z });
  }
  // 불빛 번짐 + 주변을 물들이는 빛
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,140,50,0.6)', 'rgba(255,140,50,0)'), depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(4.5, 3.6, 1); glow.position.y = 0.9;
  g.add(glow);
  campfire.glow = glow;
  const light = new THREE.PointLight(0xff8a3c, 26, 18, 1.3);
  light.position.y = 1.4;
  g.add(light);
  campfire.light = light;

  // 튀어 오르는 불티
  const N = 40;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    campfire.emberData.push({ life: rnd() * 2, max: 1.2 + rnd() * 1.4, x: 0, z: 0, vx: 0, vz: 0 });
    pos[i * 3 + 1] = -10;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  campfire.embers = new THREE.Points(eg, new THREE.PointsMaterial({
    size: 0.09, map: dotTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  g.add(campfire.embers);

  // 둘러앉는 통나무 의자
  for (const deg of [-60, 95, -150]) {
    const p = yardAt(deg, 2.7);
    const facing = Math.atan2(YARD.x - p.x, YARD.z - p.z);                   // 불 쪽
    const out = yardAt(deg, 3.5);                                             // 일어나면 의자 뒤로
    campfire.seats.push({ x: p.x, z: p.z, yaw: facing, out: { x: out.x, z: out.z } });
    const bench = new THREE.Group();
    bench.position.set(p.x, 0, p.z);
    bench.lookAt(YARD.x, 0, YARD.z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 1.7, 10), [logM, barkEnd, barkEnd]);
    body.rotation.z = Math.PI / 2; body.position.y = 0.25; body.castShadow = true;
    const snow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.26), lam(COLORS.pineSnow));
    snow.position.y = 0.5;
    bench.add(body, snow);
    scene.add(bench);
    boxes.push({ x: p.x, z: p.z, rot: Math.atan2(YARD.x - p.x, YARD.z - p.z), hw: 0.85, hd: 0.3 });
  }
  trees.push({ x: YARD.x, z: YARD.z, r: 1.25 });
}

function animateCampfire(dt, t) {
  for (const f of campfire.flames) {
    const n = Math.sin(t * 7.3 + f.phase) * 0.5 + Math.sin(t * 13.1 + f.phase * 2) * 0.3 + Math.sin(t * 3.1 + f.phase) * 0.2;
    const h = f.h * (1 + n * 0.25);
    f.s.scale.set(f.w * (1 + n * 0.12), h, 1);
    f.s.position.set(f.x + Math.sin(t * 2.3 + f.phase) * 0.04, 0.15 + h / 2, f.z);
    f.s.material.opacity = 0.8 + n * 0.18;
  }
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 4.3) * 0.4;
  campfire.light.intensity = 26 + flick * 5;
  campfire.glow.material.opacity = 0.85 + flick * 0.12;
  campfire.coals.material.color.setHSL(0.06, 1, 0.45 + flick * 0.05);
  const pos = campfire.embers.geometry.attributes.position;
  campfire.emberData.forEach((e, i) => {
    e.life += dt;
    if (e.life > e.max) {
      e.life = 0; e.max = 1.2 + Math.random() * 1.4;
      e.x = (Math.random() - 0.5) * 0.5; e.z = (Math.random() - 0.5) * 0.5;
      e.vx = (Math.random() - 0.5) * 0.35; e.vz = (Math.random() - 0.5) * 0.35;
    }
    const k = e.life / e.max;
    pos.setXYZ(i, e.x + e.vx * e.life + Math.sin(t * 3 + i) * 0.08, 0.5 + e.life * 1.5, e.z + e.vz * e.life);
  });
  pos.needsUpdate = true;
  campfire.embers.material.opacity = 0.9;

  // 가까이 갈수록 장작 타는 소리가 커짐
  if (window.Sound?.fire) {
    const d = Math.hypot(state.pos.x - YARD.x, state.pos.z - YARD.z);
    Sound.fire.level(house.inside > 0.5 ? 0 : Math.max(0, 1 - Math.max(0, d - 2) / 20) ** 1.6);
  }
}

/* ───────── 캐릭터 ───────── */
const mat = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#c8323a'; g.fillRect(0, 0, 64, 8);
  g.fillStyle = '#f3ece0';
  for (let x = 6; x < 64; x += 16) g.fillRect(x, 0, 5, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 캐릭터 모델 (나와 다른 접속자가 같이 씀) — 모자·코트 색은 멤버 번호마다 다르게
function makeHero() {
  const root = new THREE.Group();     // 발 위치
  const body = new THREE.Group();     // 통통 튀는 몸
  root.add(body);

  const coatM = mat(COLORS.coat), redM = mat(COLORS.red), knitM = mat(COLORS.knit, 1);
  const scarfM = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 1 });

  const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  // 다리 (엉덩이 축으로 회전)
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 0.42, 0);
    add(pivot, new THREE.CapsuleGeometry(0.085, 0.2, 4, 10), mat(COLORS.pants), 0, -0.2, 0);
    const boot = add(pivot, new THREE.SphereGeometry(0.12, 14, 10), mat(COLORS.boot, 0.7), 0, -0.36, 0.04);
    boot.scale.set(1, 0.72, 1.4);
    body.add(pivot);
    return pivot;
  });

  // 코트 (종 모양 회전체)
  const coatProfile = [
    [0, 0.3], [0.33, 0.3], [0.37, 0.34], [0.33, 0.55], [0.27, 0.82], [0.17, 0.94], [0, 0.95],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  add(body, new THREE.LatheGeometry(coatProfile, 28), coatM);
  add(body, new THREE.TorusGeometry(0.34, 0.035, 8, 28).rotateX(Math.PI / 2), mat(0x24543f), 0, 0.34, 0);
  for (const y of [0.48, 0.64]) add(body, new THREE.SphereGeometry(0.03, 8, 6), knitM, 0, y, 0.33 - (y - 0.48) * 0.2);

  // 팔 (어깨 축으로 회전)
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 0.82, 0);
    pivot.rotation.z = side * 0.35;
    add(pivot, new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), coatM, 0, -0.17, 0);
    add(pivot, new THREE.SphereGeometry(0.085, 12, 8), redM, 0, -0.35, 0);
    body.add(pivot);
    return pivot;
  });

  // 머리
  const head = new THREE.Group();
  head.position.y = 1.17;
  body.add(head);
  add(head, new THREE.SphereGeometry(0.3, 32, 20), mat(COLORS.skin, 0.8));
  const eyes = [-1, 1].map((side) => {
    const e = add(head, new THREE.SphereGeometry(0.035, 12, 8), mat(COLORS.eye, 0.4), side * 0.1, 0.02, 0.275);
    e.scale.set(1, 1.25, 0.6);
    return e;
  });
  for (const side of [-1, 1]) {
    const b = add(head, new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshStandardMaterial({ color: COLORS.blush, roughness: 1, transparent: true, opacity: 0.6 }), side * 0.17, -0.07, 0.235);
    b.scale.set(1, 0.6, 0.4);
    b.castShadow = false;
  }
  const mouth = add(head, new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI), mat(COLORS.eye, 0.5), 0, -0.07, 0.29);
  mouth.rotation.z = Math.PI;

  // 털모자
  const hat = new THREE.Group();
  hat.position.y = 0.05;
  head.add(hat);
  const dome = add(hat, new THREE.SphereGeometry(0.315, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), redM, 0, 0.02, 0);
  dome.scale.y = 1.08;
  for (let i = 0; i < 12; i++) {           // 니트 결
    const a = (i / 12) * Math.PI * 2;
    const rib = add(hat, new THREE.TorusGeometry(0.315, 0.008, 4, 24, Math.PI / 2), mat(0x9e2229), 0, 0.02, 0);
    rib.rotation.set(0, a, Math.PI / 2);
    rib.scale.set(1.08, 1, 1);
    rib.castShadow = false;
  }
  add(hat, new THREE.CylinderGeometry(0.33, 0.33, 0.11, 32), knitM, 0, 0.0, 0);
  const pom = add(hat, new THREE.SphereGeometry(0.1, 16, 12), knitM, 0, 0.36, 0);

  // 목도리
  const wrap = add(body, new THREE.TorusGeometry(0.19, 0.075, 10, 28).rotateX(Math.PI / 2), scarfM, 0, 0.93, 0);
  wrap.material.map.repeat.set(4, 1);
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0.1, 0.9, -0.2);
  body.add(tailRoot);
  const tailSegs = [];
  let parent = tailRoot;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    if (i > 0) seg.position.y = -0.12;
    const m = add(seg, new THREE.BoxGeometry(0.13, 0.13, 0.035), scarfM, 0, -0.06, 0);
    m.material = scarfM;
    parent.add(seg);
    tailSegs.push(seg);
    parent = seg;
  }
  // 술 장식
  for (const x of [-0.045, 0, 0.045]) add(parent, new THREE.CylinderGeometry(0.008, 0.008, 0.06, 4), redM, x, -0.15, 0);

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  scene.add(root);
  return { root, body, legs, arms, head, eyes, pom, tailSegs, coatM, redM };
}
const hero = makeHero();

// 멤버 번호마다 정해지는 모자(장갑)·코트 색 — 접속자끼리 구분되게
const OUTFITS = [
  [0xc8323a, 0x2f6b4f], [0x2f6fd8, 0x7a2b35], [0xe0a020, 0x2c3e66], [0x8a4fd0, 0xa0784a],
  [0xff6fa8, 0x7a808c], [0x20b5a3, 0x5a2a4a], [0x46b04a, 0x8b3a2b], [0xf2f2f2, 0x26262e],
];
function dressHero(h, no) {
  const [hat, coat] = OUTFITS[((Number(no) || 1) - 1) % OUTFITS.length];
  h.redM.color.setHex(hat);
  h.coatM.color.setHex(coat);
}

// 걷기·앉기 자세 (나와 다른 접속자 공통)
function poseHero(h, phase, speedF, t, sitK) {
  const { body, legs, arms, head, pom, tailSegs } = h;
  const sw = Math.sin(phase);
  body.position.y = Math.abs(sw) * 0.06 * speedF + Math.sin(t * 2.2) * 0.008 * (1 - speedF);
  body.rotation.x = 0.1 * speedF;
  body.rotation.z = sw * 0.04 * speedF;
  legs[0].rotation.x = sw * 0.75 * speedF;
  legs[1].rotation.x = -sw * 0.75 * speedF;
  arms[0].rotation.x = -sw * 0.65 * speedF;
  arms[1].rotation.x = sw * 0.65 * speedF;
  head.rotation.z = Math.sin(t * 1.3) * 0.03 * (1 - speedF);
  head.rotation.x = -0.05 * speedF;
  pom.position.z = -0.04 * speedF + Math.sin(t * 6) * 0.01;
  pom.position.y = 0.36 - Math.abs(sw) * 0.02 * speedF;
  // 의자에 앉은 자세: 엉덩이를 의자 위에, 다리는 앞으로, 두 손은 불 쪽으로 쬐기
  if (sitK > 0.001) {
    const mix = (a, b) => a + (b - a) * sitK;
    body.position.y = mix(body.position.y, 0.13);
    body.rotation.x = mix(body.rotation.x, -0.06);
    for (const l of legs) l.rotation.x = mix(l.rotation.x, -1.25);
    arms.forEach((a, i) => { a.rotation.x = mix(a.rotation.x, -1.0 + Math.sin(t * 1.6 + i) * 0.05); });
    head.rotation.x = mix(head.rotation.x, 0.08);
  }
  tailSegs.forEach((seg, i) => {
    seg.rotation.x = -(0.15 + 0.55 * speedF) * (i === 0 ? 1 : 0.35) + Math.sin(t * 7 - i * 0.9) * (0.08 + 0.18 * speedF);
    seg.rotation.z = Math.sin(t * 3 - i) * 0.08;
  });
}

/* 캐릭터 머리 위 이름표: 멤버 번호(Club Member 03) — 접속자가 여럿이라 번호로 구분 */
function makeNameTag(root) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 10;                                      // 나무 뒤에 있어도 이름은 보이게
  s.raycast = () => {};
  const top = new THREE.Box3().setFromObject(root).max.y - root.position.y;
  s.position.y = top + 0.32;
  root.add(s);
  return {
    set(text) {
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.font = 'italic 46px Georgia, "Times New Roman", serif';
      const w = Math.min(c.width - 8, g.measureText(text).width + 56);
      const x = (c.width - w) / 2, y = 30, h = 68;
      g.fillStyle = 'rgba(0, 20, 70, 0.55)';
      g.strokeStyle = 'rgba(255, 220, 160, 0.6)';
      g.lineWidth = 3;
      g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.stroke();
      g.fillStyle = '#fff3dc';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, c.width / 2, y + h / 2 + 2, c.width - 40);
      tex.needsUpdate = true;
      s.scale.set(2.3, 0.575, 1);
    },
  };
}

/* ───────── 다른 접속자 ─────────
   걸을 때만 0.3초마다 위치를 보내고, 멈춰 있으면 3초마다 '나 여기 있어'만 보냄
   받은 위치로 부드럽게 따라가며 걷는 자세를 만들고, 10초 동안 소식이 없으면 사라짐 */
const presence = (() => {
  let link = null, no = null, lastSent = 0, lastMsg = null, force = false;
  return {
    async start(memberNo) {
      no = memberNo;
      link = await connectPresence({
        no,
        onPos: (m) => receiveOther(m),
        onThrow: (m) => receiveThrow(m),
        onLeave: (id) => removeOther(id),
        onJoin: () => { force = true; },              // 새로 들어온 사람에게 내 위치를 바로 알려 줌
      });
    },
    send(state) {
      if (!link || document.hidden) return;
      const now = performance.now();
      const m = {
        id: myPresenceId, no,
        x: +state.pos.x.toFixed(2), y: +state.pos.y.toFixed(2), z: +state.pos.z.toFixed(2),
        yaw: +state.yaw.toFixed(2), sit: state.seat ? 1 : 0,
      };
      const changed = !lastMsg || Math.hypot(m.x - lastMsg.x, m.z - lastMsg.z) > 0.03
        || Math.abs(m.yaw - lastMsg.yaw) > 0.05 || m.sit !== lastMsg.sit || Math.abs(m.y - lastMsg.y) > 0.03;
      const due = force || (changed ? now - lastSent > 300 : now - lastSent > 3000);
      if (!due) return;
      link.send(m);
      lastSent = now; lastMsg = m; force = false;
    },
    throw(m) { link?.emit('throw', m); },
  };
})();

const others = new Map();     // 접속 id → { h, tag, target, yaw, phase, sitK, seen }
function receiveOther(m) {
  if (typeof m.x !== 'number' || typeof m.z !== 'number') return;
  let o = others.get(m.id);
  if (!o) {
    const h = makeHero();
    dressHero(h, m.no);
    const tag = makeNameTag(h.root);
    tag.set(club.memberName(m.no));
    h.root.position.set(m.x, m.y || 0, m.z);
    o = { h, tag, no: m.no, yaw: m.yaw || 0, phase: 0, sitK: m.sit ? 1 : 0, target: new THREE.Vector3(), seen: 0 };
    others.set(m.id, o);
  }
  o.target.set(m.x, m.y || 0, m.z);
  o.targetYaw = m.yaw || 0;
  o.sit = m.sit ? 1 : 0;
  o.seen = clock.elapsedTime;
}
function removeOther(id) {
  const o = others.get(id);
  if (!o) return;
  clearSplats(o.h);
  scene.remove(o.h.root);
  o.h.root.traverse((x) => {
    if (x.geometry) x.geometry.dispose();
    if (x.material) { x.material.map?.dispose?.(); x.material.dispose(); }
  });
  others.delete(id);
}
function updateOthers(dt, t) {
  for (const [id, o] of others) {
    if (t - o.seen > 10) { removeOther(id); continue; }
    const p = o.h.root.position;
    const before = p.clone();
    const far = p.distanceTo(o.target) > 6;              // 순간이동(문 통과 등)은 바로 옮김
    if (far) p.copy(o.target); else p.lerp(o.target, Math.min(1, dt * 7));
    const speed = far || dt <= 0 ? 0 : Math.hypot(p.x - before.x, p.z - before.z) / dt;
    const speedF = Math.min(1, speed / SPEED);
    o.yaw = lerpAngle(o.yaw, o.targetYaw, Math.min(1, dt * 8));
    o.h.root.rotation.y = o.yaw;
    o.phase += speed * dt * 2.9;
    if (speedF < 0.05) o.phase += (Math.round(o.phase / Math.PI) * Math.PI - o.phase) * Math.min(1, dt * 8);
    o.sitK += (o.sit - o.sitK) * Math.min(1, dt * 5);
    poseHero(o.h, o.phase, speedF, t, o.sitK);
    throwPose(o.h, t - (o.thrown ?? -10));
  }
}

/* ───────── 발자국 ───────── */
const PRINTS = 320;
const printMesh = (() => {
  const geo = new THREE.CircleGeometry(1, 14);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -4 }), PRINTS);
  m.receiveShadow = true;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < PRINTS; i++) { m.setMatrixAt(i, hidden); m.setColorAt(i, new THREE.Color(COLORS.snow)); }
  scene.add(m);
  return m;
})();
const printAge = new Float32Array(PRINTS).fill(-1);
let printNext = 0;
const snowCol = new THREE.Color(COLORS.snow), printCol = new THREE.Color(COLORS.print), tmpCol = new THREE.Color();

function addPrint(x, z, yaw) {
  const i = printNext; printNext = (printNext + 1) % PRINTS;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, heightAt(x, z) + 0.03, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(0.085, 1, 0.14),
  );
  printMesh.setMatrixAt(i, m);
  printMesh.instanceMatrix.needsUpdate = true;
  printAge[i] = 0;
}

function updatePrints(dt) {
  const LIFE = 22;
  let changed = false;
  for (let i = 0; i < PRINTS; i++) {
    if (printAge[i] < 0) continue;
    printAge[i] += dt;
    const k = Math.min(1, printAge[i] / LIFE);
    tmpCol.copy(printCol).lerp(snowCol, k * k);
    printMesh.setColorAt(i, tmpCol);
    if (k >= 1) printAge[i] = -1;
    changed = true;
  }
  if (changed) printMesh.instanceColor.needsUpdate = true;
}

/* ───────── 3D로 내리는 눈 ───────── */
const snow = (() => {
  const N = 2600, BOX = 44, H = 22;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N), phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX;
    pos[i * 3 + 1] = Math.random() * H;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    speed[i] = 0.6 + Math.random() * 0.9;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.11, map: dotTex, transparent: true, depthWrite: false, opacity: 0.95,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return {
    update(dt, t, cx, cz) {
      for (let i = 0; i < N; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        y -= speed[i] * dt;
        x += Math.sin(t * 0.8 + phase[i]) * 0.25 * dt;
        if (y < -1) y += H;
        // 카메라 주변 상자 안에서 순환
        if (x - cx > BOX / 2) x -= BOX; else if (x - cx < -BOX / 2) x += BOX;
        if (z - cz > BOX / 2) z -= BOX; else if (z - cz < -BOX / 2) z += BOX;
        if (y < 7 && insideHouse(x, z, -0.6)) { x += 14; y += 8; }   // 지붕 아래(실내)에는 눈이 내리지 않음
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
})();

/* ───────── 입김 ───────── */
const puffs = (() => {
  const material = new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, opacity: 0 });
  const list = Array.from({ length: 12 }, () => {
    const s = new THREE.Sprite(material.clone());
    s.visible = false;
    scene.add(s);
    return { s, life: 0, max: 1, v: new THREE.Vector3() };
  });
  let next = 0;
  return {
    emit(origin, dir) {
      for (let k = 0; k < 3; k++) {
        const p = list[next]; next = (next + 1) % list.length;
        p.s.position.copy(origin);
        p.v.copy(dir).multiplyScalar(0.35 + Math.random() * 0.2).add(new THREE.Vector3(0, 0.12 + Math.random() * 0.1, 0));
        p.life = -k * 0.08; p.max = 1.3 + Math.random() * 0.4;
        p.s.visible = true;
      }
    },
    update(dt) {
      for (const p of list) {
        if (!p.s.visible) continue;
        p.life += dt;
        if (p.life < 0) { p.s.material.opacity = 0; continue; }
        const k = p.life / p.max;
        if (k >= 1) { p.s.visible = false; continue; }
        p.s.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(0.97);
        const sc = 0.1 + k * 0.35;
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = 0.55 * (1 - k);
      }
    },
  };
})();

/* ───────── 트리에 걸린 편지 카드 ───────── */
const ornaments = [];          // { group, card, tree, phase, born }
const fontReady = Promise.race([
  document.fonts ? document.fonts.load('20px ChosunIlboMyungjo').catch(() => {}) : null,
  new Promise((res) => setTimeout(res, 2000)),
]);

function wrapLines(g, text, maxW, maxLines) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (g.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch;
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    lines.push(line);
  }
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

async function ornamentTextures(card) {
  const [im] = await Promise.all([cardImages(card.tree), fontReady]);
  const house = card.tree === 'Family';
  const W = 256, H = Math.round(256 * im.h / im.w);
  const make = (src, withText) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    if (src) g.drawImage(src, 0, 0, W, H);
    if (withText) {
      g.fillStyle = '#c2453f';
      g.textAlign = 'center';
      if (card.tree === 'Feeling') {
        // 양말 카드: 접단에 트리 이름, 다리·발에 답변
        const cx = W * 0.6;
        g.font = 'italic 16px Georgia, serif';
        g.fillText(card.tree, W * 0.66, H * 0.17);
        g.font = '10px ChosunIlboMyungjo, serif';
        g.fillText(letters.tr(card.category), W * 0.66, H * 0.22);
        g.fillStyle = '#5b2a24';
        g.font = '14px ChosunIlboMyungjo, serif';
        const lines = wrapLines(g, card.answer, W * 0.48, 6);
        lines.forEach((l, i) => g.fillText(l, cx, H * 0.36 + i * 19));
        g.fillStyle = '#c2453f';
        g.font = 'italic 11px Georgia, serif';
        g.fillText(`From. ${club.memberName(card.member)}`, W * 0.48, H * 0.8);
      } else if (card.tree === 'Wish') {
        // 별 카드: 가운데에 트리 이름·답변
        g.font = 'italic 15px Georgia, serif';
        g.fillText(card.tree, W / 2, H * 0.28);
        g.font = '10px ChosunIlboMyungjo, serif';
        g.fillText(letters.tr(card.category), W / 2, H * 0.34);
        g.fillStyle = '#5b2a24';
        g.font = '13px ChosunIlboMyungjo, serif';
        const lines = wrapLines(g, card.answer, W * 0.56, 4);
        lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.45 + i * 18));
        g.fillStyle = '#c2453f';
        g.font = 'italic 10px Georgia, serif';
        g.fillText(`From. ${club.memberName(card.member)}`, W / 2, H * 0.74);
      } else if (card.tree === 'Growth') {
        // 진저브레드 편지지: 머리에 트리 이름, 팔·몸통에 답변
        g.fillStyle = '#c2453f';
        g.font = 'italic 16px Georgia, serif';
        g.fillText(card.tree, W / 2, H * 0.15);
        g.font = '11px ChosunIlboMyungjo, serif';
        g.fillText(letters.tr(card.category), W / 2, H * 0.21);
        g.fillStyle = '#5b2a24';
        g.font = '14px ChosunIlboMyungjo, serif';
        const lines = wrapLines(g, card.answer, W * 0.62, 4);
        lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.44 + i * 19));
        g.fillStyle = '#c2453f';
        g.font = 'italic 11px Georgia, serif';
        g.fillText(`From. ${club.memberName(card.member)}`, W / 2, H * 0.73);
      } else if (house) {
        // 지붕(민무늬)에 트리 이름, 몸통에 답변
        g.font = 'italic 16px Georgia, serif';
        g.fillText(card.tree, W / 2, H * 0.31);
        g.font = '11px ChosunIlboMyungjo, serif';
        g.fillText(letters.tr(card.category), W / 2, H * 0.4);
        g.fillStyle = '#5b2a24';
        g.font = '14px ChosunIlboMyungjo, serif';
        const lines = wrapLines(g, card.answer, W * 0.56, 4);
        lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.6 + i * 19));
        g.fillStyle = '#c2453f';
        g.font = 'italic 11px Georgia, serif';
        g.fillText(`From. ${club.memberName(card.member)}`, W / 2, H * 0.93);
      } else {
        g.font = 'italic 17px Georgia, serif';
        g.fillText(card.tree, W / 2, H * 0.2);
        g.font = '13px ChosunIlboMyungjo, serif';
        g.fillText(letters.tr(card.category), W / 2, H * 0.27);
        g.fillStyle = '#5b2a24';
        g.font = '15px ChosunIlboMyungjo, serif';
        const lines = wrapLines(g, card.answer, W * 0.66, 5);
        lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.5 + i * 22));
        g.fillStyle = '#c2453f';
        g.font = 'italic 13px Georgia, serif';
        g.fillText(`From. ${club.memberName(card.member)}`, W / 2, H * 0.86);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  // [글씨 있는 면, 반대 면] — 민무늬 뒷면에 글씨, 반대쪽은 앞면 그림(체크 지붕 등)
  return [make(im.back, true), make(im.front, false), im];
}

// 카드가 걸릴 자리: 나무 표면을 따라 황금각 나선으로 고르게
// (나무 그룹 안의 로컬 좌표 — 나무가 커지면 카드도 함께 커짐)
function ornamentSlot(info, i) {
  const f = ((i * 0.618034) % 1) * 0.9 + 0.05;
  const y = TREE.BASE + 0.35 + f * (TREE.TOP - TREE.BASE - 1.05);
  const ang = i * 2.39996 + 0.7;
  // 전나무는 3단 원뿔이라, 그 높이에서 가장 바깥 가지 반지름 바로 바깥에 건다
  const r = coneR(y) + 0.28 / TREE.SCALE;
  return { x: Math.cos(ang) * r, y, z: Math.sin(ang) * r, ang };
}
// 나무 로컬 높이 y 에서 가지(원뿔) 바깥 반지름
function coneR(y) {
  let r = 0;
  for (let k = 0; k < 3; k++) {
    const r0 = 1.15 - k * 0.3, h = 1.35 - k * 0.15, y0 = 0.55 + k * 0.75;
    if (y >= y0 && y <= y0 + h) r = Math.max(r, r0 * (1 - (y - y0) / h));
  }
  return r;
}

const cardGlowTex = radialTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
const ornGeos = {};
function ornGeo(im) {
  const key = `${im.w}x${im.h}`;
  if (!ornGeos[key]) {
    const w = im.w > im.h ? 0.74 : 0.62, h = w * im.h / im.w;
    ornGeos[key] = new THREE.PlaneGeometry(w, h).translate(0, -h / 2 - 0.12, 0);
  }
  return ornGeos[key];
}
const stringMat = new THREE.LineBasicMaterial({ color: 0xd8b56a });

// 걸린 카드마다 다른 색으로 빛남 (크리스마스 전구 색). 카드 id로 정해서 새로고침해도 같은 색
const CARD_LIGHTS = [0xffb43c, 0xff4d4d, 0x4dff88, 0x4da6ff, 0xff6fd0, 0xb07dff, 0xffe066, 0x40e0d0];
function cardLight(card) {
  const key = String(card.id ?? Math.random());
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return new THREE.Color(CARD_LIGHTS[h % CARD_LIGHTS.length]);
}

// 언어를 바꾸면 트리에 걸린 카드의 분류 글자도 다시 그림
document.addEventListener('lang:change', () => {
  for (const o of ornaments) {
    ornamentTextures(o.card).then(([front, back]) => {
      o.meshes.forEach((m, i) => {
        const tex = i ? back : front;
        m.material.map?.dispose();
        m.material.map = tex;
        m.material.emissiveMap = tex;
        m.material.needsUpdate = true;
      });
    });
  }
});

async function addOrnament(info, card, slotIndex, animate) {
  const [front, back, im] = await ornamentTextures(card);
  const geo = ornGeo(im);
  const s = ornamentSlot(info, slotIndex);
  const group = new THREE.Group();
  // 카드 전체가 가지 밖으로 보이도록: 카드가 내려오는 높이 범위에서 가장 넓은 가지보다 바깥에 걸고,
  // 가지 끝에서 실로 늘어뜨림
  const S = TREE.SCALE;
  const cw = geo.parameters.width / S, ch = (geo.parameters.height + 0.12) / S;
  let rMax = 0;
  for (let k = 0; k <= 8; k++) rMax = Math.max(rMax, coneR(s.y - (k / 8) * ch));
  const sag = rMax > cw / 2 ? rMax - Math.sqrt(rMax * rMax - (cw / 2) ** 2) : cw / 2;   // 넓은 카드의 양끝이 둥근 가지에 닿지 않게
  const rCard = rMax + sag + 0.06;
  const rHook = coneR(s.y) + 0.02;
  group.position.set(Math.cos(s.ang) * rCard, s.y, Math.sin(s.ang) * rCard);
  group.rotation.order = 'YXZ';
  group.rotation.y = Math.atan2(Math.cos(s.ang), Math.sin(s.ang));     // 바깥쪽을 바라봄
  const f = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: front, transparent: true, alphaTest: 0.4, side: THREE.FrontSide }));
  const b = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: back, transparent: true, alphaTest: 0.4, side: THREE.FrontSide }));
  b.rotation.y = Math.PI;
  f.castShadow = b.castShadow = true;
  // 카드가 스스로 빛나도록: 양면 모두 자체 발광 + 뒤로 은은한 빛 번짐
  const light = cardLight(card);
  for (const [m, tex] of [[f, front], [b, back]]) {
    m.material.emissive = new THREE.Color(0xd8c6ae).lerp(light, 0.35);   // 종이도 그 빛을 살짝 머금음
    m.material.emissiveMap = tex;
  }
  const h = geo.parameters.height;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: cardGlowTex, color: light,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.7,
  }));
  halo.renderOrder = 2;
  halo.position.set(0, -h / 2 - 0.12, 0.22);                // 가지에 가려지지 않게 카드 살짝 앞에
  halo.scale.setScalar(Math.max(geo.parameters.width, h) * 2.6);
  halo.raycast = () => {};                                   // 클릭은 카드만
  const reach = Math.max(0, rCard - rHook) * S;             // 가지 끝까지의 거리 (카드 로컬)
  const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.05 + reach * 0.35, -reach), new THREE.Vector3(0, -0.13, 0),
  ]), stringMat);
  group.add(halo, f, b, string);
  f.userData.card = b.userData.card = card;
  f.userData.tree = b.userData.tree = info.name;
  info.group.add(group);
  ornaments.push({ group, halo, card, tree: info.name, slot: slotIndex, tilt: 0, phase: Math.random() * Math.PI * 2, born: animate ? clock.elapsedTime : -10, meshes: [f, b] });
}

function removeOrnament(card) {
  const i = ornaments.findIndex((o) => o.card.id === card.id);
  if (i < 0) return;
  const o = ornaments[i];
  o.group.parent?.remove(o.group);
  o.meshes.forEach((m) => { m.material.map.dispose(); m.material.dispose(); });
  o.halo.material.dispose();
  ornaments.splice(i, 1);
}

const _ornPos = new THREE.Vector3(), _ornDir = new THREE.Vector3(), _ornCam = new THREE.Vector3(), _ornQ = new THREE.Quaternion();
function animateOrnaments(t) {
  for (const o of ornaments) {
    const age = t - o.born;
    const pop = age < 0.9 ? 1 - Math.pow(1 - Math.min(1, age / 0.9), 3) * (1 - 0.0) : 1;
    const bounce = age < 0.9 ? Math.sin(age * 9) * (1 - age / 0.9) * 0.25 : 0;
    o.group.scale.setScalar(Math.max(0.01, pop) / TREE.SCALE);
    o.group.rotation.z = Math.sin(t * 1.3 + o.phase) * 0.06 + bounce;
    o.group.rotation.x = (o.tilt || 0) + Math.sin(t * 0.9 + o.phase * 2) * 0.04;
    // 숨 쉬듯 반짝 — 나무 뒤편 카드의 빛은 가지에 가려진 것처럼 흐리게
    o.group.getWorldPosition(_ornPos);
    _ornDir.set(0, 0, 1).applyQuaternion(o.group.getWorldQuaternion(_ornQ));
    const facing = THREE.MathUtils.clamp(_ornDir.dot(_ornCam.copy(camera.position).sub(_ornPos).normalize()) * 2.2 + 0.35, 0, 1);
    o.halo.material.opacity = (0.6 + 0.2 * Math.sin(t * 1.7 + o.phase * 3)) * facing;
  }
}

// 빈 자리 중에서 지금 캐릭터가 서 있는 쪽을 향한 자리를 고름 (건 카드가 바로 보이게)
function nextSlot(info) {
  const used = new Set(ornaments.filter((o) => o.tree === info.name).map((o) => o.slot));
  const heroAng = Math.atan2(state.pos.z - info.z, state.pos.x - info.x);
  let best = 0, bestScore = Infinity;
  for (let i = 0; i < 90; i++) {
    if (used.has(i)) continue;
    const s = ornamentSlot(info, i);
    const score = Math.abs(Math.atan2(Math.sin(s.ang - heroAng), Math.cos(s.ang - heroAng))) + i * 0.012;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// 서버의 카드 목록과 트리를 맞춤 (다른 멤버가 건 카드도 나타남)
async function syncTree(info, animate) {
  const cards = await club.fetchCards(info.name);
  if (!cards) return;
  info.known ??= new Set();
  const ids = new Set(cards.map((c) => c.id));
  cards.forEach((card, i) => {
    if (info.known.has(card.id)) return;
    info.known.add(card.id);
    addOrnament(info, card, card.slot ?? i, animate);
  });
  for (const o of ornaments.filter((o) => o.tree === info.name && !ids.has(o.card.id))) {
    removeOrnament(o.card);
    info.known.delete(o.card.id);
  }
  info.count = cards.length;                             // 카드 수만큼 트리가 커지고 밝아짐
}
const syncAll = (animate) => Promise.all(BIG_TREES.filter((b) => letters.QUESTIONS[b.name]).map((b) => syncTree(b, animate)));

async function hangCard(info, draft) {
  const card = await club.addCard({ ...draft, slot: nextSlot(info) });   // 실패하면 편지 창에서 알려 줌
  info.known ??= new Set();
  info.known.add(card.id);
  addOrnament(info, card, card.slot, true).then(() => window.Sound && Sound.bell(0.9));
  info.count++;                                          // 트리가 조금 더 커지고 밝아짐
}

/* 현관문: 열면 끼이익, 닫히면 쿵 */
const DOOR_OPEN = 1.75;                                  // 안쪽으로 열리는 각도 (약 100°)
function toggleDoor() {
  const d = house.door;
  d.open = !d.open;
  d.from = d.angle; d.to = d.open ? DOOR_OPEN : 0;
  d.t0 = clock.elapsedTime;
  d.dur = d.open ? 1.4 : 0.9;
  d.thudDone = false;
  if (d.open) window.Sound && Sound.creak(1.35);
  else { window.Sound && Sound.creak(0.7); d.box.off = false; }
}
function animateDoor(t) {
  const d = house.door;
  if (d.t0 === undefined) return;
  const k = Math.min(1, (t - d.t0) / d.dur);
  const e = d.open ? 1 - Math.pow(1 - k, 2.2) : k * k;              // 열 땐 천천히 멈추고, 닫을 땐 점점 빨라짐
  d.angle = d.from + (d.to - d.from) * e;
  d.hinge.rotation.y = d.angle;
  if (d.open && d.angle > 0.7) d.box.off = true;
  if (!d.open && k >= 1 && !d.thudDone) { d.thudDone = true; window.Sound && Sound.thud(); }
}
const nearDoor = () => Math.hypot(state.pos.x - house.door.world[0], state.pos.z - house.door.world[1]) < 2.6;

const writableTree = (name) => !!letters.QUESTIONS[name];
function openTree(info) {
  if (!writableTree(info.name) || letters.isOpen()) return;
  letters.openWriter(info.name, (draft) => hangCard(info, draft));
}
function openOrnament(mesh) {
  const info = BIG_TREES.find((b) => b.name === mesh.userData.tree);
  letters.openViewer(info.name, mesh.userData.card, async (card) => {
    await club.removeCard(card);
    removeOrnament(card);
    info.known?.delete(card.id);
    info.count = Math.max(0, info.count - 1);
  });
}

/* 화면 좌표 → 3D 물체 고르기 */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // 걸린 카드를 먼저 확인 (가지에 살짝 묻혀 있어도 눌리도록)
  const card = raycaster.intersectObjects(ornaments.flatMap((o) => o.meshes), false)[0];
  if (card) return { type: 'ornament', mesh: card.object };
  const door = raycaster.intersectObjects(house.door.meshes, false)[0];
  if (door && door.distance < 30) return { type: 'door' };
  const hit = raycaster.intersectObjects(BIG_TREES.flatMap((b) => [b.mesh, b.label]), false)[0];
  if (!hit) return null;
  const info = hit.object.userData.info || BIG_TREES.find((b) => b.label === hit.object);
  return info && writableTree(info.name) ? { type: 'tree', info } : null;
}

/* ───────── 눈 굴리기 ─────────
   R(또는 ☃ 버튼)을 누르면 발 앞에 작은 눈덩이가 생기고, 걸을수록 굴러가며 커짐
   다시 누르면 그 자리에 놓음. 더 큰 눈덩이 바로 옆에 놓으면 위로 올라가 눈사람이 됨
   (내 화면에만 보임) */
const snowballs = [];                                    // 놓아 둔 눈덩이 { mesh, r, collider, top }
const SNOWBALL = { START: 0.14, MAX: 1.05, GROW: 0.045, KEEP: 24 };
const snowballMat = new THREE.MeshStandardMaterial({ color: 0xf3f7ff, roughness: 1, metalness: 0 });
const snowballGeo = new THREE.IcosahedronGeometry(1, 3);
let rolling = null;                                      // 굴리는 중인 눈덩이 { mesh, r, last }
const rollBtn = document.querySelector('.roll:not(.throw)');

function startRolling() {
  if (rolling || state.seat) return;
  const mesh = new THREE.Mesh(snowballGeo, snowballMat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.scale.setScalar(SNOWBALL.START);
  scene.add(mesh);
  rolling = { mesh, r: SNOWBALL.START, last: null };
  rollBtn.setAttribute('aria-pressed', 'true');
  window.Sound && Sound.crunch();
}

function letGo() {
  if (!rolling) return;
  const { mesh, r } = rolling;
  rolling = null;
  rollBtn.setAttribute('aria-pressed', 'false');
  // 옆에 더 큰 눈덩이(또는 눈사람 몸통)가 있으면 그 위로 쌓기
  const base = snowballs.find((b) => !b.covered && b.r > r * 1.05
    && Math.hypot(b.mesh.position.x - mesh.position.x, b.mesh.position.z - mesh.position.z) < b.r + r + 0.15);
  const ball = { mesh, r, collider: null, covered: false };
  if (base) {
    mesh.position.set(base.mesh.position.x, base.top + r * 0.82, base.mesh.position.z);
    base.covered = true;
    ball.top = mesh.position.y + r;
  } else {
    ball.collider = { x: mesh.position.x, z: mesh.position.z, r: r * 0.9 };
    trees.push(ball.collider);                           // 큰 눈덩이는 지나갈 수 없게
    ball.top = mesh.position.y + r;
  }
  snowballs.push(ball);
  window.Sound && Sound.crunch();
  while (snowballs.length > SNOWBALL.KEEP) {             // 너무 많아지면 오래된 것부터 녹음
    const old = snowballs.shift();
    scene.remove(old.mesh);
    if (old.collider) trees.splice(trees.indexOf(old.collider), 1);
  }
}
const toggleRolling = () => (rolling ? letGo() : startRolling());

function updateSnowball(indoors) {
  if (!rolling) return;
  if (indoors || state.seat || letters.isOpen()) { letGo(); return; }
  const { mesh } = rolling;
  const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
  let x = state.pos.x + fx * (rolling.r + 0.32), z = state.pos.z + fz * (rolling.r + 0.32);
  for (const o of trees) {                                // 나무·집에 파고들지 않게
    const dx = x - o.x, dz = z - o.z, min = o.r + rolling.r * 0.8;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2); x = o.x + (dx / d) * min; z = o.z + (dz / d) * min; }
  }
  if (rolling.last) {
    const mx = x - rolling.last.x, mz = z - rolling.last.z, d = Math.hypot(mx, mz);
    if (d > 1e-4 && d < 2) {
      rolling.r = Math.min(SNOWBALL.MAX, rolling.r + d * SNOWBALL.GROW * (1 - rolling.r / (SNOWBALL.MAX * 1.3)));
      mesh.rotateOnWorldAxis(new THREE.Vector3(mz / d, 0, -mx / d), d / rolling.r);   // 굴러간 만큼 회전
    }
  }
  rolling.last = { x, z };
  mesh.scale.setScalar(rolling.r);
  mesh.position.set(x, rolling.r * 0.94, z);             // 살짝 눈에 파묻힌 느낌
}
rollBtn.addEventListener('click', () => { if (active) toggleRolling(); });
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || !active || letters.isOpen() || e.repeat) return;
  e.preventDefault();
  toggleRolling();
});

/* ───────── 눈싸움 ─────────
   F(또는 ❄ 버튼)를 누르면 카메라가 보는 쪽으로 눈뭉치를 던짐
   캐릭터에 맞으면 맞은 자리에 눈이 묻었다가 몇 초 뒤 스르르 없어짐
   던지는 건 다른 접속자에게도 보이고, 맞았는지는 각자 화면에서 똑같이 계산함 */
const THROW = { SPEED: 15, UP: 3.4, G: 13, R: 0.11, COOLDOWN: 0.35, LIFE: 3, STICK: 3.2 };
const flying = [];                                       // 날아가는 눈뭉치 { mesh, vel, owner, age }
const splats = [];                                       // 캐릭터에 묻은 눈 { group, h, age }
const bits = [];                                        // 부서지는 눈가루 { mesh, vel, age }
const throwBtn = document.querySelector('.throw');
const flakeGeo = new THREE.IcosahedronGeometry(1, 1);
let lastThrow = -10;

function throwSnowball() {
  const t = clock.elapsedTime;
  if (t - lastThrow < THROW.COOLDOWN || state.seat || insideHouse(state.pos.x, state.pos.z, -0.1)) return;
  if (rolling) letGo();
  lastThrow = t;
  const dx = -Math.sin(cam.yaw), dz = -Math.cos(cam.yaw);   // 카메라가 보는 쪽
  state.yaw = Math.atan2(dx, dz);
  const m = {
    id: myPresenceId,
    x: +(state.pos.x + dx * 0.35).toFixed(2), y: +(state.pos.y + 1.25).toFixed(2), z: +(state.pos.z + dz * 0.35).toFixed(2),
    vx: +(dx * THROW.SPEED).toFixed(2), vy: THROW.UP, vz: +(dz * THROW.SPEED).toFixed(2),
    yaw: +state.yaw.toFixed(2),
  };
  launch(m);
  presence.throw(m);
  window.Sound && Sound.swish(1);
}

function receiveThrow(m) {
  if (![m.x, m.y, m.z, m.vx, m.vy, m.vz].every(Number.isFinite)) return;
  if (Math.hypot(m.vx, m.vz) > 30 || Math.abs(m.vy) > 10) return;
  const o = others.get(m.id);
  if (o) { o.thrown = clock.elapsedTime; if (Number.isFinite(m.yaw)) { o.targetYaw = m.yaw; o.yaw = m.yaw; } }
  launch(m);
  window.Sound && Sound.swish(near(m.x, m.z));
}

function launch(m) {
  const mesh = new THREE.Mesh(flakeGeo, snowballMat);
  mesh.scale.setScalar(THROW.R);
  mesh.castShadow = true;
  mesh.position.set(m.x, m.y, m.z);
  scene.add(mesh);
  flying.push({ mesh, vel: new THREE.Vector3(m.vx, m.vy, m.vz), owner: m.id, age: 0 });
}

const near = (x, z) => Math.max(0, 1 - Math.hypot(x - state.pos.x, z - state.pos.z) / 28);

// 던지는 팔: 뒤로 젖혔다가 앞으로 휙
function throwPose(h, since) {
  if (since < 0 || since > 0.5) return;
  const a = since < 0.1 ? -2.8 * (since / 0.1)
    : since < 0.24 ? -2.8 + 2.2 * ((since - 0.1) / 0.14)
    : -0.6 * (1 - (since - 0.24) / 0.26);
  h.arms[1].rotation.x = a;
}

function updateThrows(dt) {
  const targets = [[myPresenceId, hero]];
  for (const [id, o] of others) targets.push([id, o.h]);
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i];
    f.age += dt;
    f.vel.y -= THROW.G * dt;
    const p = f.mesh.position.addScaledVector(f.vel, dt);
    let hit = null;
    for (const [id, h] of targets) {                     // 캐릭터 몸통(둥근 기둥)에 맞았나
      if (id === f.owner) continue;
      const c = h.root.position;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 0.42 && p.y > c.y + 0.05 && p.y < c.y + 1.6) { hit = h; break; }
    }
    let gone = !!hit || f.age > THROW.LIFE || p.y < heightAt(p.x, p.z);
    if (!gone) for (const o of trees) {                  // 나무·눈사람·가로등
      if (Math.hypot(p.x - o.x, p.z - o.z) < o.r && p.y < 5) { gone = true; break; }
    }
    if (!gone) for (const b of boxes) {                  // 집 벽
      if (b.off) continue;
      const c = Math.cos(b.rot), sn = Math.sin(b.rot), dx = p.x - b.x, dz = p.z - b.z;
      if (Math.abs(dx * c - dz * sn) < b.hw && Math.abs(dx * sn + dz * c) < b.hd && p.y < 6) { gone = true; break; }
    }
    if (!gone) continue;
    if (hit) stickSnow(hit, p);
    burst(p, hit ? 10 : 7);
    window.Sound && Sound.splat(near(p.x, p.z) * (hit ? 1 : 0.6));
    scene.remove(f.mesh);
    flying.splice(i, 1);
  }

  // 묻은 눈: 잠깐 그대로 있다가 작아지며 사라짐
  for (let i = splats.length - 1; i >= 0; i--) {
    const s = splats[i];
    s.age += dt;
    const k = Math.max(0, 1 - Math.max(0, s.age - (THROW.STICK - 0.9)) / 0.9);
    s.group.scale.setScalar(k);
    s.group.position.y = s.y - (1 - k) * 0.12;           // 녹으며 살짝 흘러내림
    if (k <= 0) { s.group.removeFromParent(); splats.splice(i, 1); }
  }
  // 눈가루
  for (let i = bits.length - 1; i >= 0; i--) {
    const q = bits[i];
    q.age += dt;
    q.vel.y -= 9 * dt;
    q.mesh.position.addScaledVector(q.vel, dt);
    q.mesh.scale.setScalar(q.size * Math.max(0, 1 - q.age / 0.55));
    if (q.age > 0.55) { scene.remove(q.mesh); bits.splice(i, 1); }
  }
}

// 맞은 자리에 눈 덩어리 몇 개를 붙임 (몸을 따라 움직이도록 몸통 그룹에 붙임)
function stickSnow(h, worldP) {
  const local = h.body.worldToLocal(worldP.clone());
  const center = new THREE.Vector3(0, Math.min(1.35, Math.max(0.35, local.y)), 0);
  const out = local.clone().sub(center).setY(0);
  if (out.lengthSq() < 1e-4) out.set(0, 0, 1);
  out.normalize();
  local.copy(center).addScaledVector(out, local.y > 0.95 ? 0.3 : 0.27);   // 머리·몸 겉면
  const group = new THREE.Group();
  group.position.copy(local);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(flakeGeo, snowballMat);
    const r = 0.035 + Math.random() * 0.045;
    m.scale.set(r * 1.3, r * 1.2, r * 0.55);             // 납작하게 철퍽
    m.position.set((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.16, Math.random() * 0.02);
    group.add(m);
  }
  h.body.add(group);
  splats.push({ group, h, age: 0, y: local.y });
  while (splats.length > 60) splats.shift().group.removeFromParent();
}
function clearSplats(h) {
  for (let i = splats.length - 1; i >= 0; i--) {
    if (splats[i].h === h) { splats[i].group.removeFromParent(); splats.splice(i, 1); }
  }
}

function burst(p, n) {
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(flakeGeo, snowballMat);
    const size = 0.025 + Math.random() * 0.035;
    mesh.scale.setScalar(size);
    mesh.position.copy(p);
    scene.add(mesh);
    const a = Math.random() * Math.PI * 2, up = 1.5 + Math.random() * 2.5, sp = 0.8 + Math.random() * 1.8;
    bits.push({ mesh, size, age: 0, vel: new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp) });
  }
}

throwBtn.addEventListener('click', () => { if (active && !letters.isOpen()) throwSnowball(); });
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyF' || !active || letters.isOpen() || e.repeat) return;
  e.preventDefault();
  throwSnowball();
});

/* ───────── 입력 ───────── */
const keys = new Set();
const KEYMAP = {
  ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
};
let active = false;
let nearTree = null;                                     // 카드를 쓸 수 있는 트리 근처면 그 트리
let atDoor = false;                                      // 현관문 앞(또는 안쪽)이면 true
const nearbyBtn = document.querySelector('.nearby');
const nearbyLabel = nearbyBtn.firstChild;
let nearSeat = null;                                      // 가까운 모닥불 의자
function sitDown(seat) { keys.clear(); state.seat = seat; state.unseat = null; }
function standUp() {
  if (!state.seat) return;
  state.unseat = state.seat.out;
  state.seat = null;
}
function doNearby() {
  if (state.seat) standUp();
  else if (atDoor) toggleDoor();
  else if (nearSeat) sitDown(nearSeat);
  else if (nearTree) { keys.clear(); openTree(nearTree); }
}
nearbyBtn.addEventListener('click', doNearby);
document.addEventListener('letter:open', () => { keys.clear(); stick.id = null; stick.x = stick.y = 0; joy.classList.remove('is-on'); looks.clear(); });
addEventListener('keydown', (e) => {
  if (!active || letters.isOpen()) return;
  if ((e.code === 'KeyE' || e.code === 'Enter') && (atDoor || nearTree || nearSeat || state.seat)) { e.preventDefault(); doNearby(); return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  keys.add(k);
  e.preventDefault();
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

const cam = { yaw: 0, pitch: 0.36, dist: 11, dragging: false, lastDrag: -10 };
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };    // 터치 조이스틱
const looks = new Map();                                 // 시점 회전용 포인터

const downs = new Map();                                 // 탭(클릭) 판별용
canvas.addEventListener('pointerdown', (e) => {
  if (!active || letters.isOpen()) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 일부 환경에선 실패해도 무방 */ }
  downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  const touch = e.pointerType !== 'mouse';
  if (touch && e.clientX < innerWidth / 2 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 });
    joy.style.left = e.clientX + 'px';
    joy.style.top = e.clientY + 'px';
    joy.classList.add('is-on');
    joyKnob.style.transform = 'translate(-50%, -50%)';
  } else {
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) {
    const R = 46;
    let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    stick.x = dx / R; stick.y = dy / R;
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    return;
  }
  const p = looks.get(e.pointerId);
  if (!p) return;
  cam.yaw -= (e.clientX - p.x) * 0.006;
  cam.pitch = Math.min(0.95, Math.max(0.12, cam.pitch + (e.clientY - p.y) * 0.004));
  p.x = e.clientX; p.y = e.clientY;
  cam.lastDrag = clock.elapsedTime;
});
const endPointer = (e) => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; joy.classList.remove('is-on'); }
  looks.delete(e.pointerId);
  const d = downs.get(e.pointerId);
  downs.delete(e.pointerId);
  // 거의 움직이지 않고 짧게 눌렀다 떼면 = 클릭/탭 → 트리나 걸린 카드를 고름
  if (d && e.type === 'pointerup' && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 400) {
    const hit = pick(e.clientX, e.clientY);
    if (hit?.type === 'tree') { keys.clear(); openTree(hit.info); }
    else if (hit?.type === 'ornament') { keys.clear(); openOrnament(hit.mesh); }
    else if (hit?.type === 'door') toggleDoor();
  }
};
// 마우스를 올리면 손가락 커서
let hoverAt = 0;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || looks.size || performance.now() - hoverAt < 80) return;
  hoverAt = performance.now();
  canvas.style.cursor = active && pick(e.clientX, e.clientY) ? 'pointer' : '';
});
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  cam.dist = Math.min(26, Math.max(4, cam.dist + e.deltaY * 0.012));
  e.preventDefault();
}, { passive: false });

/* ───────── 상태 ───────── */
const SPEED = 4.3;           // 걷는 속도 (m/s)
const state = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0,
  phase: 0,
  step: 0,
  blink: 0, nextBlink: 2,
  nextBreath: 1.5,
  moved: false,
  seat: null,          // 모닥불 의자에 앉아 있으면 그 자리
  sitK: 0,             // 앉은 정도 0~1
  unseat: null,        // 일어나서 의자 뒤로 비켜서는 중
};
{
  const p = pathCurve.getPointAt(START_T);
  const tan = pathCurve.getTangentAt(START_T);
  state.pos.set(p.x, 0, p.z);
  state.yaw = Math.atan2(-p.x, -p.z);           // 처음엔 중앙의 집을 바라봄
  cam.yaw = state.yaw + Math.PI - 0.22;          // 등 뒤 사선에서 집과 나무들이 보이게
}
const camTarget = state.pos.clone();

const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function update(dt, t) {
  // 카메라 기준 방향
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  move.set(0, 0, 0);
  if (active) {
    if (keys.has('f')) move.add(fwd);
    if (keys.has('b')) move.sub(fwd);
    if (keys.has('r')) move.add(right);
    if (keys.has('l')) move.sub(right);
    if (stick.id !== null) move.addScaledVector(right, stick.x).addScaledVector(fwd, -stick.y);
  }
  const amount = Math.min(1, move.length());
  if (amount > 0.05) {
    move.normalize();
    if (!state.moved) { state.moved = true; hint.classList.remove('is-on'); }
  }

  // 의자에 앉아 있다가 움직이려 하면 일어남
  if (state.seat && amount > 0.05) standUp();
  const pinned = state.seat || state.unseat;
  const target = move.clone().multiplyScalar(pinned ? 0 : SPEED * (amount > 0.05 ? amount : 0));
  state.vel.lerp(target, Math.min(1, dt * 8));
  const speed = state.vel.length();
  const speedF = Math.min(1, speed / SPEED);

  // 이동 + 나무·가로등 충돌 + 바깥 경계
  const next = state.pos.clone().addScaledVector(state.vel, dt);
  const goal = state.seat || state.unseat;
  if (goal) {                                               // 의자 쪽으로 / 의자 뒤로 스르륵
    state.vel.set(0, 0, 0);
    next.set(state.pos.x + (goal.x - state.pos.x) * Math.min(1, dt * 7), 0, state.pos.z + (goal.z - state.pos.z) * Math.min(1, dt * 7));
    if (state.seat) state.yaw = lerpAngle(state.yaw, state.seat.yaw, Math.min(1, dt * 7));
    if (state.unseat && Math.hypot(goal.x - next.x, goal.z - next.z) < 0.05) state.unseat = null;
  }
  if (!goal) {
  for (const o of trees) {
    const dx = next.x - o.x, dz = next.z - o.z, min = o.r + 0.3;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      next.x = o.x + (dx / d) * min;
      next.z = o.z + (dz / d) * min;
    }
  }
  for (const b of boxes) {
    if (b.off) continue;
    const c = Math.cos(b.rot), sn = Math.sin(b.rot);
    const dx = next.x - b.x, dz = next.z - b.z;
    let lx = dx * c - dz * sn, lz = dx * sn + dz * c;     // 집 기준 좌표
    const hw = b.hw + 0.3, hd = b.hd + 0.3;
    if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
      if (hw - Math.abs(lx) < hd - Math.abs(lz)) lx = Math.sign(lx) * hw; else lz = Math.sign(lz) * hd;
      next.x = b.x + lx * c + lz * sn;
      next.z = b.z - lx * sn + lz * c;
    }
  }
  }
  const r = Math.hypot(next.x, next.z);
  if (r > 92) { next.x *= 92 / r; next.z *= 92 / r; }
  state.sitK += ((state.seat ? 1 : 0) - state.sitK) * Math.min(1, dt * 5);
  state.pos.copy(next);
  state.pos.y = heightAt(state.pos.x, state.pos.z);

  // 집 안에 들어왔는지 (부드럽게 0~1로 전환)
  const indoors = insideHouse(state.pos.x, state.pos.z, -0.1);
  house.inside += ((indoors ? 1 : 0) - house.inside) * Math.min(1, dt * 3);

  if (speed > 0.15) state.yaw = lerpAngle(state.yaw, Math.atan2(state.vel.x, state.vel.z), Math.min(1, dt * 10));

  // 걸음: phase가 π를 지날 때마다 한 걸음
  const prev = state.phase;
  state.phase += speed * dt * 2.9;
  if (speedF < 0.05) state.phase += (Math.round(state.phase / Math.PI) * Math.PI - state.phase) * Math.min(1, dt * 8);
  if (Math.floor(state.phase / Math.PI) > Math.floor(prev / Math.PI) && speedF > 0.3) {
    state.step++;
    const side = state.step % 2 ? 1 : -1;
    const rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
    if (!indoors) {                                      // 실내에선 발자국·눈 밟는 소리 없음
      addPrint(state.pos.x + rx * 0.12 * side + Math.sin(state.yaw) * 0.15, state.pos.z + rz * 0.12 * side + Math.cos(state.yaw) * 0.15, state.yaw);
      window.Sound && Sound.crunch();
    }
  }

  // 캐릭터 포즈
  const { body, eyes } = hero;
  hero.root.position.copy(state.pos);
  hero.root.rotation.y = state.yaw;
  poseHero(hero, state.phase, speedF, t, state.sitK);
  throwPose(hero, t - lastThrow);

  updateSnowball(indoors);
  updateThrows(dt);

  // 다른 접속자: 내 위치를 보내고, 다른 사람들을 받은 위치로 부드럽게 움직임
  presence.send(state);
  updateOthers(dt, t);

  // 깜빡임
  state.nextBlink -= dt;
  if (state.nextBlink < 0) { state.blink = 0.13; state.nextBlink = 2 + Math.random() * 3.5; }
  state.blink = Math.max(0, state.blink - dt);
  for (const e of eyes) e.scale.y = state.blink > 0 ? 0.15 : 1.25;

  // 입김
  state.nextBreath -= dt;
  if (state.nextBreath < 0 && !indoors) {                // 따뜻한 실내에선 입김이 안 보임
    state.nextBreath = 2.2 + Math.random() * 1.6;
    const dir = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const mouth = state.pos.clone().addScaledVector(dir, 0.34);
    mouth.y += 1.12 + body.position.y;
    puffs.emit(mouth, dir.add(state.vel.clone().multiplyScalar(0.25)));
  }
  puffs.update(dt);

  // 카메라: 걸을 땐 천천히 등 뒤로 돌아감 (드래그 직후엔 잠시 멈춤)
  if (speedF > 0.3 && t - cam.lastDrag > 1.5 && looks.size === 0) {
    const behind = Math.atan2(-Math.sin(state.yaw), -Math.cos(state.yaw));
    cam.yaw = lerpAngle(cam.yaw, behind, Math.min(1, dt * 0.6 * speedF));
  }
  camTarget.lerp(state.pos, Math.min(1, dt * 5));
  // 실내에선 위에서 내려다보는 '인형의 집' 시점
  const ib = house.inside;
  // 앉아 있으면 등 뒤 가까이에서 불을 바라봄
  const sk2 = state.sitK;
  if (state.seat && t - cam.lastDrag > 1.5 && looks.size === 0) {
    cam.yaw = lerpAngle(cam.yaw, state.seat.yaw + Math.PI + 0.55, Math.min(1, dt * 2));
  }
  const pitch0 = cam.pitch + (0.3 - cam.pitch) * sk2;
  const dist0 = cam.dist + (Math.min(cam.dist, 4.6) - cam.dist) * sk2;
  const pitch = pitch0 + (0.95 - pitch0) * ib;
  const dist = dist0 + (9 - dist0) * ib;
  const cp = Math.cos(pitch);
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * dist,
    camTarget.y + 0.9 + Math.sin(pitch) * dist,
    camTarget.z + Math.cos(cam.yaw) * cp * dist,
  );
  house.roof.visible = ib < 0.5;
  // 카메라 쪽 벽은 잘라내서 방 안이 보이게
  const hc = Math.cos(HOUSE_ROT), hs = Math.sin(HOUSE_ROT);
  for (const w of house.walls) {
    const nx = w.n.x * hc + w.n.z * hs, nz = -w.n.x * hs + w.n.z * hc;
    w.group.visible = ib < 0.5 || camera.position.x * nx + camera.position.z * nz < w.half + 0.4;
  }
  const gy = heightAt(camera.position.x, camera.position.z) + 0.6;
  if (camera.position.y < gy) camera.position.y = gy;
  camera.lookAt(camTarget.x, camTarget.y + 1.3, camTarget.z);

  // 달빛 그림자 범위를 캐릭터 주변으로
  moonLight.position.copy(camTarget).addScaledVector(MOON_DIR, 40);
  moonLight.target.position.copy(camTarget);
  scene.userData.sky.position.copy(camera.position);

  updatePrints(dt);
  animateDecor(dt, t);
  animateCampfire(dt, t);
  animateOrnaments(t);

  // 현관문 · 트리 근처 안내 (문이 우선)
  animateDoor(t);
  nearTree = null;
  nearSeat = null;
  atDoor = active && !letters.isOpen() && !state.seat && nearDoor();
  if (active && !letters.isOpen() && !atDoor && !state.seat && !state.unseat) {
    nearSeat = campfire.seats.find((c) => Math.hypot(state.pos.x - c.x, state.pos.z - c.z) < 1.7) || null;
  }
  if (active && !letters.isOpen() && !atDoor && !nearSeat && !state.seat) {
    for (const b of BIG_TREES) {
      if (writableTree(b.name) && Math.hypot(state.pos.x - b.x, state.pos.z - b.z) < 7.5) { nearTree = b; break; }
    }
  }
  const label = state.seat ? say('near.stand')
    : atDoor ? say(house.door.open ? 'near.doorClose' : 'near.doorOpen')
    : nearSeat ? say('near.sit')
    : nearTree ? say('near.write', { tree: nearTree.name }) : null;
  nearbyBtn.classList.toggle('is-on', !!label);
  if (label && nearbyLabel.textContent !== label) nearbyLabel.textContent = label;
  if (!reduce) snow.update(dt, t, camTarget.x, camTarget.z);
}

/* ───────── 루프 ───────── */
let running = false;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt, clock.elapsedTime);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  clock.start();
  document.dispatchEvent(new Event('scene:start'));
  canvas.classList.add('is-on');
  document.querySelectorAll('.snow').forEach((c) => c.classList.add('is-off'));
  window.SnowDrift && setTimeout(() => { window.SnowDrift.paused = true; }, 1600);
  setTimeout(() => {
    active = true;
    if (!state.moved) hint.classList.add('is-on');
  }, 1200);

  // 배경 음악(보사노바): 소리가 켜져 있으면 바로, 아니면 첫 탭/키 입력 때 시작
  window.Sound && Sound.music.start();
  musicBtn.classList.add('is-on');
}

const musicBtn = document.querySelector('.music');
function toggleMusic() {
  if (!window.Sound) return;
  const on = Sound.music.toggle();
  musicBtn.setAttribute('aria-pressed', String(on));
}
musicBtn.addEventListener('click', toggleMusic);
addEventListener('keydown', (e) => { if (e.code === 'KeyM' && active) toggleMusic(); });

// 첫 프레임을 미리 그려 두어 전환이 매끄럽게
update(0, 0);
renderer.render(scene, camera);
requestAnimationFrame(frame);

/* ───────── 클럽 입장: 멤버 번호 받기 → 트리 카드 불러오기 ───────── */
const memberEl = document.querySelector('.member');
const welcomeEl = document.querySelector('.welcome');
// 새해(1월 1일, 한국 시간)까지 남은 날. 1월 첫 주에는 { year } 만 돌려줘 새해 인사를 보여 줌
function newYearCountdown(now = Date.now()) {
  const k = new Date(now + 9 * 3600e3);                  // 한국 시간의 날짜
  const y = k.getUTCFullYear(), m = k.getUTCMonth(), d = k.getUTCDate();
  if (m === 0 && d <= 7) return { year: y };
  const days = Math.round((Date.UTC(y + 1, 0, 1) - Date.UTC(y, m, d)) / 864e5);
  return { days, year: y + 1 };
}

const nameTag = makeNameTag(hero.root);
const joined = club.join().then(async (me) => {
  memberEl.innerHTML = `December Club · <b>${club.memberName(me.no)}</b>`;
  nameTag.set(club.memberName(me.no));
  dressHero(hero, me.no);
  presence.start(me.no);
  memberEl.title = club.isOnline() ? '' : say('offline');
  await syncAll(false);
  if (club.isOnline()) setInterval(() => { if (!document.hidden) syncAll(true); }, 8000);
  return me;
});
document.addEventListener('scene:start', () => {
  rollBtn.classList.add('is-on');
  throwBtn.classList.add('is-on');
  joined.then(async (me) => {
    memberEl.classList.add('is-on');
    const ny = newYearCountdown();
    const dday = ny.days ? `D-${ny.days}` : `Happy New Year`;
    const note = ny.days ? say('dday.note', { year: ny.year, days: ny.days }) : say('newyear.note', { year: ny.year });
    welcomeEl.innerHTML = `<span class="welcome__dday" role="img" aria-label="${dday}"></span>${say('welcome', { name: club.memberName(me.no) })}<small>${note}</small>`;
    try { welcomeEl.querySelector('.welcome__dday').append(await crossStitch(dday)); }
    catch { welcomeEl.querySelector('.welcome__dday').textContent = dday; }
    welcomeEl.classList.add('is-on');
    setTimeout(() => welcomeEl.classList.remove('is-on'), 5200);
  });
}, { once: true });

if (window.__introDone) start();
else document.addEventListener('intro:done', start);
