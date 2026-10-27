import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Shape,
  SphereGeometry,
  CapsuleGeometry,
  TorusGeometry,
  QuadraticBezierCurve3,
  Vector3,
  BoxGeometry,
  CylinderGeometry,
  type Scene,
} from "three";
import type { Terrain } from "./terrain";

/** 共享材质库（旧版 OA，色值原样） */
export const MATS = {
  wood: new MeshStandardMaterial({ color: 7032629, roughness: 0.9 }),
  woodDark: new MeshStandardMaterial({ color: 4863524, roughness: 0.92 }),
  plank: new MeshStandardMaterial({ color: 9071434, roughness: 0.88 }),
  stone: new MeshStandardMaterial({ color: 9143673, roughness: 0.95, flatShading: true }),
  stoneDark: new MeshStandardMaterial({ color: 6249041, roughness: 0.95, flatShading: true }),
  white: new MeshStandardMaterial({ color: 15328991, roughness: 0.62 }),
  red: new MeshStandardMaterial({ color: 10235687, roughness: 0.6 }),
  metal: new MeshStandardMaterial({ color: 9278618, metalness: 0.85, roughness: 0.35 }),
  darkMetal: new MeshStandardMaterial({ color: 2764081, metalness: 0.7, roughness: 0.5 }),
  glass: new MeshStandardMaterial({
    color: 11061456,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.45,
    side: DoubleSide,
  }),
  canvas: new MeshStandardMaterial({ color: 14273974, roughness: 0.95, side: DoubleSide }),
  canvasDark: new MeshStandardMaterial({ color: 6056538, roughness: 0.95, side: DoubleSide }),
  warm: new MeshStandardMaterial({
    color: 16764810,
    emissive: 16757084,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  }),
  rope: new MeshStandardMaterial({ color: 10324586, roughness: 1 }),
};

/** 立方体（旧版 zP） */
function box(w: number, h: number, d: number, mat: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 圆柱（旧版 dP：CylinderGeometry(rTop, rBottom, h, seg)） */
function cyl(rTop: number, rBottom: number, h: number, seg: number, mat: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(new CylinderGeometry(rTop, rBottom, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 灯塔（含值守小屋），旧版 Wj */
export function buildLighthouse(terrain: Terrain, x: number, z: number): Group {
  const g = new Group();
  const groundY = terrain.sampleHF(x, z);
  g.position.set(x, groundY - 0.4, z);
  g.add(cyl(4.2, 4.8, 2.2, 12, MATS.stone, 0, 1.1, 0));
  const rings = 5;
  const ringH = 3.2;
  for (let i = 0; i < rings; i++) {
    const r = 3.1 - i * 0.32;
    g.add(cyl(r - 0.18, r, ringH, 14, i % 2 === 0 ? MATS.white : MATS.red, 0, 2.2 + ringH * i + ringH / 2, 0));
  }
  const topY = 2.2 + ringH * rings;
  g.add(cyl(2.4, 2.5, 0.35, 16, MATS.darkMetal, 0, topY + 0.2, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(cyl(0.05, 0.05, 1.05, 5, MATS.darkMetal, Math.cos(a) * 2.3, topY + 0.9, Math.sin(a) * 2.3));
  }
  const ring = new Mesh(new TorusGeometry(2.3, 0.06, 6, 32), MATS.darkMetal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = topY + 1.42;
  g.add(ring);
  g.add(cyl(1.55, 1.7, 2.3, 10, MATS.glass, 0, topY + 1.6, 0));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(cyl(0.07, 0.07, 2.3, 4, MATS.darkMetal, Math.cos(a) * 1.65, topY + 1.6, Math.sin(a) * 1.65));
  }
  const roof = new Mesh(new ConeGeometry(2.05, 1.5, 12), MATS.red);
  roof.position.y = topY + 3.4;
  roof.castShadow = true;
  g.add(roof);
  g.add(cyl(0.12, 0.18, 0.9, 6, MATS.darkMetal, 0, topY + 4.2, 0));
  const bulb = new Mesh(new SphereGeometry(0.55, 16, 12), new MeshBasicMaterial({ color: 16770736 }));
  bulb.position.y = topY + 1.6;
  g.add(bulb);
  const beam = new Mesh(
    new ConeGeometry(6, 60, 18, 1, true),
    new MeshBasicMaterial({
      color: 16768926,
      transparent: true,
      opacity: 0.12,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, topY + 1.6, 0);
  beam.name = "beam";
  g.add(beam);
  const lamp = new PointLight(16767392, 30, 90, 2);
  lamp.position.y = topY + 1.6;
  g.add(lamp);

  const house = new Group();
  house.position.set(9, 0, 4);
  house.rotation.y = -0.5;
  house.add(box(6.4, 3.4, 5, MATS.white, 0, 1.7, 0));
  const houseRoof = new Mesh(new ConeGeometry(5.1, 2.2, 4), MATS.red);
  houseRoof.rotation.y = Math.PI / 4;
  houseRoof.position.y = 4.5;
  houseRoof.castShadow = true;
  house.add(houseRoof);
  for (const wx of [-1.7, 1.7]) house.add(box(1.1, 1.2, 0.08, MATS.glass, wx, 2, 2.52));
  g.add(house);

  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** 码头（含小屋/小船/灯柱），旧版 Rj */
export function buildDock(terrain: Terrain, x: number, z: number, rot = 0): Group {
  const g = new Group();
  const w = Math.max(1.2, terrain.sampleHF(x, z));
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const LEN = 58;
  const DEPTH = 5.2;
  for (let i = 0; i < LEN; i += 1.2) {
    const plank = box(1.12, 0.16, DEPTH, MATS.plank, i, w + 1.1, 0);
    plank.rotation.y = (Math.random() - 0.5) * 0.02;
    g.add(plank);
  }
  for (const side of [-DEPTH / 2 + 0.4, DEPTH / 2 - 0.4]) {
    g.add(box(LEN, 0.3, 0.3, MATS.woodDark, LEN / 2, w + 0.95, side));
  }
  for (let i = 0; i < LEN; i += 6) {
    for (const side of [-DEPTH / 2 + 0.5, DEPTH / 2 - 0.5]) {
      g.add(cyl(0.2, 0.24, 8, 6, MATS.woodDark, i, w - 2.5, side));
    }
  }
  for (let i = 0; i < LEN; i += 2.4) {
    for (const side of [-DEPTH / 2, DEPTH / 2]) g.add(cyl(0.06, 0.06, 0.95, 5, MATS.wood, i, w + 1.65, side));
  }
  for (const side of [-DEPTH / 2, DEPTH / 2]) g.add(box(LEN, 0.08, 0.12, MATS.wood, LEN / 2, w + 2.1, side));
  g.add(box(13, 0.18, 9, MATS.plank, LEN + 5, w + 1.1, 0));

  const hut = new Group();
  hut.position.set(3, w + 1.2, 0);
  hut.add(box(4.2, 2.6, 3.4, MATS.wood, 0, 1.3, 0));
  const hutRoof = new Mesh(new ConeGeometry(3.4, 1.4, 4), MATS.canvasDark);
  hutRoof.rotation.y = Math.PI / 4;
  hutRoof.position.y = 3.2;
  hutRoof.castShadow = true;
  hut.add(hutRoof);
  hut.add(box(0.9, 0.9, 0.08, MATS.warm, 0, 1.8, 1.72));
  g.add(hut);

  for (let i = 0; i < 8; i++) {
    const s = 0.6 + Math.random() * 0.5;
    const crate = box(s, s, s, MATS.wood, 12 + Math.random() * 12, w + 1.2 + s / 2, (Math.random() - 0.5) * 3.4);
    crate.rotation.y = Math.random();
    g.add(crate);
  }
  for (let i = 0; i < 4; i++) g.add(cyl(0.42, 0.42, 0.9, 10, MATS.woodDark, 18 + i * 1.4, w + 1.65, -2.2));

  const boat = new Group();
  boat.position.set(LEN + 3, 0.15, 6.5);
  boat.rotation.y = 0.12;
  const hull = new Mesh(new CapsuleGeometry(1.1, 4.6, 6, 12), MATS.white);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.55, 0.8);
  boat.add(hull);
  boat.add(box(2.2, 0.12, 1.6, MATS.plank, -0.6, 0.55, 0));
  boat.add(cyl(0.05, 0.05, 2.4, 5, MATS.metal, 2.4, 1.1, 0));
  g.add(boat);

  for (const lx of [8, 30, 50]) {
    g.add(cyl(0.08, 0.1, 3.2, 6, MATS.darkMetal, lx, w + 2.7, -DEPTH / 2));
    const lamp = new Mesh(new SphereGeometry(0.16, 8, 6), MATS.warm);
    lamp.position.set(lx, w + 4.3, -DEPTH / 2);
    g.add(lamp);
  }
  const pierLight = new PointLight(16760952, 12, 40, 2);
  pierLight.position.set(28, w + 4, 0);
  g.add(pierLight);

  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** 营地（帐篷/篝火/长凳/灯串），旧版 Zj；userData.fire 供主循环驱动火光 */
export function buildCamp(terrain: Terrain, x: number, z: number): Group {
  const g = new Group();
  g.position.set(x, terrain.sampleHF(x, z), z);

  const tent = new Group();
  tent.rotation.y = 0.4;
  const shell = new Mesh(new ConeGeometry(4.4, 3.4, 4, 1, true), MATS.canvas);
  shell.rotation.y = Math.PI / 4;
  shell.position.y = 2.2;
  tent.add(shell);
  const inner = new Mesh(new ConeGeometry(3.1, 4), MATS.canvasDark);
  inner.rotation.y = Math.PI / 4;
  inner.position.set(-1.1, 1.35, -1.1);
  tent.add(inner);
  for (const [px, pz] of [
    [3.1, 0],
    [-3.1, 0],
    [0, 3.1],
    [0, -3.1],
  ]) {
    tent.add(cyl(0.05, 0.05, 3.4, 5, MATS.metal, px, 1.7, pz));
  }
  g.add(tent);

  const pit = new Group();
  pit.position.set(8, 0, 3);
  const ring = new Mesh(new TorusGeometry(1.45, 0.26, 8, 18), MATS.stoneDark);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  pit.add(ring);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const log = cyl(0.11, 0.14, 2.2, 6, MATS.woodDark, Math.cos(a) * 0.35, 0.42, Math.sin(a) * 0.35);
    log.rotation.z = Math.PI / 2 - 0.35;
    log.rotation.y = a;
    pit.add(log);
  }
  const flameMat = new MeshBasicMaterial({
    color: 16751164,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const flames = new Group();
  for (let i = 0; i < 5; i++) {
    const f = new Mesh(new ConeGeometry(0.28 - i * 0.035, 1.5 + Math.random() * 0.8, 6), flameMat);
    f.position.set((Math.random() - 0.5) * 0.5, 0.9, (Math.random() - 0.5) * 0.5);
    flames.add(f);
  }
  pit.add(flames);
  const fireLight = new PointLight(16747066, 120, 45, 2);
  fireLight.position.y = 1.4;
  pit.add(fireLight);
  g.add(pit);
  g.userData.fire = { flames, light: fireLight };

  for (const [lx, lz, ry] of [
    [5.2, 1.2, 0.5],
    [10.4, 5, -0.8],
    [6, 6.2, 1.6],
  ]) {
    const log = cyl(0.32, 0.34, 2.4, 8, MATS.wood, lx, 0.34, lz);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = ry;
    g.add(log);
  }

  const bench = new Group();
  bench.position.set(-6, 0, 6);
  bench.add(box(3.2, 0.14, 1.1, MATS.plank, 0, 0.95, 0));
  for (const [lx, lz] of [
    [-1.3, 0.35],
    [1.3, 0.35],
    [-1.3, -0.35],
    [1.3, -0.35],
  ]) {
    bench.add(box(0.14, 0.9, 0.14, MATS.woodDark, lx, 0.45, lz));
  }
  bench.add(box(3.2, 0.12, 0.4, MATS.plank, 0, 0.55, 0.95));
  bench.add(box(3.2, 0.12, 0.4, MATS.plank, 0, 0.55, -0.95));
  g.add(bench);

  for (const p of [new Vector3(-8, 0, -4), new Vector3(6, 0, -8)]) {
    g.add(cyl(0.09, 0.11, 4.2, 6, MATS.woodDark, p.x, 2.1, p.z));
  }
  const curve = new QuadraticBezierCurve3(
    new Vector3(-8, 4.2, -4),
    new Vector3(-1, 3.2, -6.4),
    new Vector3(6, 4.2, -8),
  );
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const p = curve.getPoint(t);
    const bulb = new Mesh(new SphereGeometry(0.11, 8, 6), MATS.warm);
    bulb.position.copy(p);
    bulb.position.y -= 0.15;
    g.add(bulb);
  }
  const stringLight = new PointLight(16758903, 45, 36, 2);
  stringLight.position.set(-1, 3.2, -6);
  g.add(stringLight);

  for (let i = 0; i < 4; i++) g.add(cyl(0.1, 0.1, 0.5, 8, MATS.warm, 3 + i * 1.3, 0.3, -3));

  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** 村舍，旧版 dj */
export function buildHut(terrain: Terrain, x: number, z: number, rot = 0, scale = 1): Group {
  const g = new Group();
  const groundY = terrain.sampleHF(x, z);
  g.position.set(x, groundY, z);
  g.rotation.y = rot;
  g.scale.setScalar(scale);
  const W = 7.4;
  const D = 5.6;
  const wallH = 2.9;
  g.add(box(W, 0.5, D, MATS.stoneDark, 0, 0.25, 0));
  g.add(box(W, wallH, D, MATS.woodDark, 0, 0.5 + wallH / 2, 0));
  for (let i = 0; i < 7; i++) {
    g.add(box(W + 0.12, 0.36, D + 0.12, i % 2 ? MATS.wood : MATS.woodDark, 0, 0.75 + i * 0.4, 0));
  }

  const roof = new Group();
  roof.position.y = 0.5 + wallH;
  const slabA = box(W + 1.6, 0.22, D * 0.72, MATS.stoneDark, 0, 0.9, -D * 0.26);
  slabA.rotation.x = -0.52;
  const slabB = box(W + 1.6, 0.22, D * 0.72, MATS.stoneDark, 0, 0.9, D * 0.26);
  slabB.rotation.x = 0.52;
  roof.add(slabA, slabB);

  const tri = new Shape();
  tri.moveTo(-D / 2, 0);
  tri.lineTo(D / 2, 0);
  tri.lineTo(0, 2.2);
  tri.lineTo(-D / 2, 0);
  const gableGeo = new ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
  const gableA = new Mesh(gableGeo, MATS.wood);
  gableA.rotation.y = Math.PI / 2;
  gableA.position.set(-W / 2, 0.56, 0);
  const gableB = gableA.clone();
  gableB.position.x = W / 2 - 0.12;
  roof.add(gableA, gableB);
  g.add(roof);

  g.add(box(0.8, 2.4, 0.8, MATS.stone, W * 0.28, 4.1, -D * 0.18));
  g.add(box(0.95, 2, 0.12, MATS.wood, 0, 1.5, D / 2 + 0.02));
  g.add(box(1.2, 1, 0.1, MATS.warm, -2.2, 2, D / 2 + 0.03));
  g.add(box(1.2, 1, 0.1, MATS.warm, 2.2, 2, D / 2 + 0.03));
  g.add(box(0.1, 1, 1.2, MATS.warm, -W / 2 - 0.03, 2, 0.4));
  g.add(box(0.1, 1, 1.2, MATS.warm, W / 2 + 0.03, 2, -0.4));
  g.add(box(3.2, 0.16, 1.6, MATS.plank, 0, 0.62, D / 2 + 0.8));
  for (const px of [-1.4, 1.4]) g.add(cyl(0.09, 0.1, 2.2, 6, MATS.wood, px, 1.6, D / 2 + 1.4));
  g.add(box(3.4, 0.12, 1.8, MATS.stoneDark, 0, 2.75, D / 2 + 0.85));
  const porchLight = new PointLight(16756848, 10, 18, 2);
  porchLight.position.set(0, 2.2, D / 2 + 1.2);
  g.add(porchLight);

  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** 站点指示牌，旧版 Vj */
export function buildSign(terrain: Terrain, x: number, z: number, _label = "", scale = 1): Group {
  const g = new Group();
  const groundY = terrain.sampleHF(x, z);
  g.position.set(x, groundY, z);
  g.add(cyl(0.09, 0.11, 2.6, 6, MATS.woodDark, 0, 1.3, 0));
  g.add(box(2.4, 0.62, 0.09, MATS.wood, 0.9, 2.3, 0));
  for (let i = 0; i < 3; i++) g.add(box(0.28, 0.09, 0.04, MATS.white, 0.3 + i * 0.45, 2.3, 0.06));
  g.scale.setScalar(scale);
  return g;
}

/** 石桥（架在公路上方），旧版 fj */
export function buildBridge(x: number, z: number, rot: number, y: number): Group {
  const g = new Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const W = 20;
  const D = 11;
  g.add(box(W, 0.7, D, MATS.stone, 0, -0.12, 0));
  for (const side of [-D / 2 + 0.35, D / 2 - 0.35]) {
    g.add(box(W, 1, 0.6, MATS.stone, 0, 0.6, side));
    for (let i = -4; i <= 4; i++) g.add(box(1.1, 1.15, 0.75, MATS.stoneDark, i * 2.1, 0.62, side));
  }
  for (const end of [-W / 2, W / 2]) g.add(box(0.8, 1.2, D, MATS.stoneDark, end, 0.2, 0));
  g.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** 越野小径路面（沿折线的暗色带），旧版 Xj */
export function buildTrailSurface(terrain: Terrain, pts: Array<[number, number]>): Mesh {
  const mat = new MeshStandardMaterial({
    color: 3046776,
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
    side: DoubleSide,
  });
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let v = 0;
  const step = 3.2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const segLen = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(segLen / step));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      const dx = (bx - ax) / segLen;
      const dz = -(bz - az) / segLen;
      const py = terrain.sampleHF(px, pz);
      positions.push(px + dx * 2.4, py + 0.28, pz + dz * 2.4);
      positions.push(px - dx * 2.4, py + 0.28, pz - dz * 2.4);
      uvs.push(0, i + t, 1, i + t);
      if (s < steps) {
        const a = v;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      v += 2;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

export interface BirdProps {
  r: number;
  a: number;
  h: number;
  s: number;
  sp: number;
}

/** 海鸟群（双三角翅膀），旧版主循环内联定义 */
export function buildBirds(scene: Scene): Array<Mesh<BufferGeometry, MeshBasicMaterial>> {
  const geo = new BufferGeometry();
  geo.setAttribute(
    "position",
    new Float32BufferAttribute([0, 0, 0, -0.9, 0.15, -0.25, -0.35, 0, 0.15, 0, 0, 0, 0.9, 0.15, -0.25, 0.35, 0, 0.15], 3),
  );
  geo.computeVertexNormals();
  const mat = new MeshBasicMaterial({ color: 2238507, side: DoubleSide });
  const birds: Array<Mesh<BufferGeometry, MeshBasicMaterial>> = [];
  for (let i = 0; i < 14; i++) {
    const bird = new Mesh(geo, mat);
    bird.userData = {
      r: 120 + Math.random() * 260,
      a: Math.random() * Math.PI * 2,
      h: 46 + Math.random() * 50,
      s: 0.4 + Math.random() * 0.6,
      sp: 0.05 + Math.random() * 0.05,
    } satisfies BirdProps;
    bird.scale.setScalar(1.4 + Math.random());
    scene.add(bird);
    birds.push(bird);
  }
  return birds;
}

/** 站点交互信标（圆环 + 光锥），旧版 Activities.buildMarkers */
export function buildBeacon(): Group {
  const g = new Group();
  const ring = new Mesh(
    new TorusGeometry(2.6, 0.08, 8, 40),
    new MeshBasicMaterial({ color: 16766874, transparent: true, opacity: 0.75 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.4;
  g.add(ring);
  const beam = new Mesh(
    new CylinderGeometry(0.55, 0.22, 26, 10, 1, true),
    new MeshBasicMaterial({
      color: 16764818,
      transparent: true,
      opacity: 0.1,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  beam.position.y = 13;
  g.add(beam);
  g.userData.ring = ring;
  return g;
}

/** 越野/计时赛门（发光圆环 + 两根立柱），旧版 Activities.buildMarkers */
export function buildGate(archColor = 16761975, emissive = 16751932): Group {
  const g = new Group();
  const arch = new Mesh(
    new TorusGeometry(6.4, 0.32, 10, 40),
    new MeshStandardMaterial({ color: archColor, emissive, emissiveIntensity: 1.4, roughness: 0.4 }),
  );
  arch.position.y = 6.4;
  g.add(arch);
  const postMat = new MeshStandardMaterial({ color: 7031594, roughness: 0.9 });
  for (const px of [-6.4, 6.4]) {
    const post = new Mesh(new CylinderGeometry(0.16, 0.2, 6.4, 6), postMat);
    post.position.set(px, 3.2, 0);
    post.castShadow = true;
    g.add(post);
  }
  g.visible = false;
  return g;
}
