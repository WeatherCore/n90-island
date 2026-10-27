import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  BoxGeometry,
  CylinderGeometry,
} from "three";
import { baseHeight, roadRadiusAt } from "./terrain";

/** 路面虚线贴图（canvas 程序生成，旧版 qc） */
function makeStripeTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = (0.72 + Math.random() * 0.22) * 255;
    img.data[i * 4] = v * 0.96;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v * 0.97;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 160);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** 环岛公路（旧版 TB） */
export class Road {
  readonly n = 900;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly y: Float32Array;
  readonly tan: Float32Array; // [cos, sin] 每点
  readonly mesh: Group;
  readonly length: number;

  constructor() {
    this.x = new Float32Array(this.n);
    this.z = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.tan = new Float32Array(this.n * 2);
    this.buildPath();
    this.mesh = this.buildMesh();
    this.length = this.computeLength();
  }

  private buildPath() {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = roadRadiusAt(theta);
      this.x[i] = Math.cos(theta) * r;
      this.z[i] = Math.sin(theta) * r;
      this.y[i] = Math.max(3.4, baseHeight(this.x[i], this.z[i]));
    }
    // 三轮窗口平滑，再限坡
    for (let pass = 0; pass < 3; pass++) {
      const src = this.y.slice();
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -6; k <= 6; k++) sum += src[(i + k + n) % n];
        this.y[i] = sum / 13;
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const limit = Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]) * 0.11;
      if (this.y[j] - this.y[i] > limit) this.y[j] = this.y[i] + limit;
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = this.x[j] - this.x[i];
      const dz = this.z[j] - this.z[i];
      const len = Math.hypot(dx, dz) || 1;
      this.tan[i * 2] = dx / len;
      this.tan[i * 2 + 1] = dz / len;
    }
  }

  computeLength(): number {
    let total = 0;
    for (let i = 0; i < this.n; i++) {
      const j = (i + 1) % this.n;
      total += Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]);
    }
    return total;
  }

  /** 距最近路点（旧版 info：按角度取扇区 ±4 邻域搜索） */
  info(x: number, z: number): { dist: number; i: number } {
    let theta = Math.atan2(z, x);
    if (theta < 0) theta += Math.PI * 2;
    const n = this.n;
    const sector = Math.floor((theta / (Math.PI * 2)) * n) % n;
    let best = { dist: 1e9, i: sector };
    for (let k = -4; k <= 4; k++) {
      const i = (sector + k + n) % n;
      const d = Math.hypot(x - this.x[i], z - this.z[i]);
      if (d < best.dist) best = { dist: d, i };
    }
    return best;
  }

  /** 角度对应路点索引（旧版 nearest） */
  nearest(x: number, z: number): number {
    let theta = Math.atan2(z, x);
    if (theta < 0) theta += Math.PI * 2;
    return Math.floor((theta / (Math.PI * 2)) * this.n) % this.n;
  }

  /** 生成一条沿路的带状网格（旧版 buildMesh 内部 v 函数） */
  private buildStrip(halfWidth: number, lift: number, mat: MeshStandardMaterial, vRepeat: number): Mesh {
    const n = this.n;
    const positions = new Float32Array((n + 1) * 2 * 3);
    const uvs = new Float32Array((n + 1) * 2 * 2);
    const indices: number[] = [];
    for (let l = 0; l <= n; l++) {
      const i = l % n;
      const tx = this.tan[i * 2];
      const tz = this.tan[i * 2 + 1];
      const nx = -tx;
      const px = this.x[i];
      const pz = this.z[i];
      const py = this.y[i] + lift;
      positions[l * 6] = px - tz * halfWidth;
      positions[l * 6 + 1] = py;
      positions[l * 6 + 2] = pz - nx * halfWidth;
      positions[l * 6 + 3] = px + tz * halfWidth;
      positions[l * 6 + 4] = py;
      positions[l * 6 + 5] = pz + nx * halfWidth;
      uvs[l * 4] = 0;
      uvs[l * 4 + 1] = (l / n) * vRepeat;
      uvs[l * 4 + 2] = 1;
      uvs[l * 4 + 3] = (l / n) * vRepeat;
      if (l < n) {
        const a = l * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new Mesh(geo, mat);
  }

  private buildMesh(): Group {
    const n = this.n;
    const group = new Group();

    // 沥青路面
    const asphalt = new MeshStandardMaterial({ color: 7299923, roughness: 0.98 });
    const surface = this.buildStrip(7.4, 0.02, asphalt, 1);
    surface.receiveShadow = true;
    // 中央磨耗层（带条纹贴图）
    const wear = new MeshStandardMaterial({
      color: 7171949,
      roughness: 0.9,
      metalness: 0.02,
      map: makeStripeTexture(),
    });
    const wearStrip = this.buildStrip(4.6, 0.07, wear, 1);
    wearStrip.receiveShadow = true;
    group.add(surface, wearStrip);

    // 中央虚线（instanced 小平面）
    const dashMat = new MeshBasicMaterial({ color: 14275517 });
    const dashGeo = new PlaneGeometry(0.16, 3.4);
    const dashes = new InstancedMesh(dashGeo, dashMat, Math.floor(n / 6));
    const m = new Matrix4();
    let di = 0;
    for (let i = 0; i < n; i += 6) {
      const tx = this.tan[i * 2];
      const tz = this.tan[i * 2 + 1];
      const heading = Math.atan2(tx, tz);
      m.makeRotationX(-Math.PI / 2);
      m.premultiply(new Matrix4().makeRotationY(heading));
      m.setPosition(this.x[i], this.y[i] + 0.085, this.z[i]);
      dashes.setMatrixAt(di++, m);
    }
    dashes.instanceMatrix.needsUpdate = true;
    group.add(dashes);

    // 两侧车道线
    const laneMat = new MeshBasicMaterial({ color: 13617070, transparent: true, opacity: 0.55 });
    for (const side of [-1, 1]) {
      const geo = new BufferGeometry();
      const pos = new Float32Array((n + 1) * 2 * 3);
      const idx: number[] = [];
      for (let t = 0; t <= n; t++) {
        const i = t % n;
        const tx = this.tan[i * 2];
        const tz = this.tan[i * 2 + 1];
        const nx = -tx;
        const off = side * 4.25;
        const half = 0.11;
        pos[t * 6] = this.x[i] + tz * (off - half);
        pos[t * 6 + 1] = this.y[i] + 0.085;
        pos[t * 6 + 2] = this.z[i] + nx * (off - half);
        pos[t * 6 + 3] = this.x[i] + tz * (off + half);
        pos[t * 6 + 4] = this.y[i] + 0.085;
        pos[t * 6 + 5] = this.z[i] + nx * (off + half);
        if (t < n) idx.push(t * 2, t * 2 + 2, t * 2 + 1, t * 2 + 1, t * 2 + 2, t * 2 + 3);
      }
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      group.add(new Mesh(geo, laneMat));
    }

    // 护栏立柱（路侧 ±5.4）
    const postGeo = new CylinderGeometry(0.07, 0.09, 1, 5);
    const postMat = new MeshStandardMaterial({ color: 9341828, roughness: 0.7, metalness: 0.45 });
    const posts: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < n; i += 4) {
      const tx = this.tan[i * 2];
      const tz = this.tan[i * 2 + 1];
      posts.push({ x: this.x[i] + tz * 5.4, y: this.y[i] + 0.5, z: this.z[i] + -tx * 5.4 });
    }
    const postMesh = new InstancedMesh(postGeo, postMat, posts.length);
    posts.forEach((p, i) => {
      postMesh.setMatrixAt(i, new Matrix4().makeTranslation(p.x, p.y, p.z));
    });
    postMesh.castShadow = true;
    group.add(postMesh);

    // 路缘线
    const kerbMat = new MeshStandardMaterial({ color: 14209990, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const geo = new BufferGeometry();
      const pos = new Float32Array((n + 1) * 2 * 3);
      const idx: number[] = [];
      for (let t = 0; t <= n; t++) {
        const i = t % n;
        const tx = this.tan[i * 2];
        const tz = this.tan[i * 2 + 1];
        const nx = -tx;
        const off = side * 4.62;
        pos[t * 6] = this.x[i] + tz * (off - 0.09);
        pos[t * 6 + 1] = this.y[i] + 0.07;
        pos[t * 6 + 2] = this.z[i] + nx * (off - 0.09);
        pos[t * 6 + 3] = this.x[i] + tz * (off + 0.09);
        pos[t * 6 + 4] = this.y[i] + 0.07;
        pos[t * 6 + 5] = this.z[i] + nx * (off + 0.09);
        if (t < n) idx.push(t * 2, t * 2 + 2, t * 2 + 1, t * 2 + 1, t * 2 + 2, t * 2 + 3);
      }
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new Mesh(geo, kerbMat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // 反光柱（每 22 点两侧）
    const reflGeo = new BoxGeometry(0.14, 1.05, 0.14);
    const reflMat = new MeshStandardMaterial({ color: 15262936, roughness: 0.6 });
    const reflectors: Array<{ x: number; y: number; z: number }> = [];
    for (let i = 0; i < n; i += 22) {
      const tx = this.tan[i * 2];
      const tz = this.tan[i * 2 + 1];
      const nx = -tx;
      for (const side of [-1, 1]) {
        reflectors.push({ x: this.x[i] + tz * side * 5.9, y: this.y[i] + 0.52, z: this.z[i] + nx * side * 5.9 });
      }
    }
    const reflMesh = new InstancedMesh(reflGeo, reflMat, reflectors.length);
    reflectors.forEach((p, i) => {
      reflMesh.setMatrixAt(i, new Matrix4().makeTranslation(p.x, p.y, p.z));
    });
    reflMesh.castShadow = true;
    group.add(reflMesh);

    group.traverse((o) => {
      if ((o as Mesh).isMesh) o.frustumCulled = false;
    });
    return group;
  }
}
