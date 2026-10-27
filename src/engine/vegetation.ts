import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Scene,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SITES, WORLD, type Site } from "./config";
import { fbm, makeRng } from "./mathx";
import { distToPolyline, roadRadiusAtAngle, type Terrain } from "./terrain";
import { TRAIL } from "./config";

/** 合并几何并附加逐顶点随机明暗（旧版 hv + Pg） */
function coloredGeometry(geo: BufferGeometry, colorHex: number, jitter = 0.06): BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const count = flat.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const base = new Color(colorHex);
  for (let i = 0; i < count; i++) {
    const f = 1 + (Math.random() - 0.5) * jitter;
    colors[i * 3] = base.r * f;
    colors[i * 3 + 1] = base.g * f;
    colors[i * 3 + 2] = base.b * f;
  }
  flat.setAttribute("color", new BufferAttribute(colors, 3));
  flat.deleteAttribute("uv");
  return flat;
}

function merge(list: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
}

/** 树干：圆柱上移（旧版 sB） */
function trunk(radiusTop: number, radiusBottom: number, height: number, lift: number, color = 4864552, segs = 6) {
  const geo = new CylinderGeometry(radiusTop, radiusBottom, height, segs, 1);
  geo.translate(0, lift, 0);
  return coloredGeometry(geo, color);
}

// —— 9 种程序化植被（旧版 dc/Vc/fc/Xc/_c/$c/A6/P6/v6 原样移植）——
function pineGeometry(): BufferGeometry {
  const parts = [trunk(0.12, 0.26, 2.4, 1.2)];
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const radius = 2.05 * (1 - t * 0.78);
    const height = 2.1 - t * 0.5;
    const cone = new ConeGeometry(radius, height, 8, 1, false);
    cone.rotateY(i * 0.5);
    cone.translate(Math.sin(i * 1.7) * 0.05, 2.1 + i * 1.05, Math.cos(i * 1.3) * 0.05);
    parts.push(coloredGeometry(cone, i % 2 ? 3822644 : 4283449, 0.1));
  }
  return merge(parts);
}

function spruceGeometry(): BufferGeometry {
  const parts = [trunk(0.08, 0.18, 2, 1)];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const cone = new ConeGeometry(1.35 * (1 - t * 0.8), 2.2, 7, 1, false);
    cone.translate(0, 1.9 + i * 0.9, 0);
    parts.push(coloredGeometry(cone, i % 2 ? 3361839 : 3823156, 0.1));
  }
  return merge(parts);
}

function oakGeometry(): BufferGeometry {
  const rng = makeRng(9);
  const parts = [trunk(0.22, 0.42, 3.4, 1.7, 4928804)];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + rng() * 0.6;
    const branch = new CylinderGeometry(0.09, 0.16, 1.9, 5);
    branch.translate(0, 0.95, 0);
    branch.rotateZ(0.5 + rng() * 0.3);
    branch.rotateY(angle);
    branch.translate(0, 3, 0);
    parts.push(coloredGeometry(branch, 4600095));
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const d = 1.7 + rng() * 0.9;
    const blob = new IcosahedronGeometry(0.95 + rng() * 0.55, 1);
    blob.scale(1.15, 0.85, 1.15);
    blob.translate(Math.cos(angle) * d * 0.7, 4.5 + rng() * 1.8, Math.sin(angle) * d * 0.7);
    parts.push(coloredGeometry(blob, i % 2 ? 4874038 : 5598013, 0.12));
  }
  return merge(parts);
}

function birchGeometry(): BufferGeometry {
  const parts = [trunk(0.1, 0.16, 3.2, 1.6, 14210764)];
  for (let i = 0; i < 5; i++) {
    const blob = new IcosahedronGeometry(0.9 + Math.random() * 0.4, 1);
    blob.scale(1.1, 0.9, 1.1);
    blob.translate((Math.random() - 0.5) * 1.3, 3.4 + Math.random() * 1.4, (Math.random() - 0.5) * 1.3);
    parts.push(coloredGeometry(blob, i % 2 ? 7176005 : 7965517, 0.12));
  }
  return merge(parts);
}

function palmGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  let cx = 0;
  let cy = 0;
  const lean = 0.16;
  for (let i = 0; i < 6; i++) {
    const seg = new CylinderGeometry(0.13 - i * 0.01, 0.19 - i * 0.01, 1.1, 6);
    seg.translate(0, 0.55, 0);
    seg.rotateZ(lean * (i + 1) * 0.3);
    seg.translate(cx, cy, 0);
    parts.push(coloredGeometry(seg, 7033398));
    cy += 1.05 * Math.cos(lean * (i + 1) * 0.3);
    cx += 1.05 * Math.sin(lean * (i + 1) * 0.3);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const frond = new ConeGeometry(0.5, 3, 4, 1, true);
    frond.scale(1, 1, 0.18);
    frond.translate(0, 1.5, 0);
    frond.rotateX(1.15);
    frond.rotateY(angle);
    frond.translate(cx, cy, 0);
    parts.push(coloredGeometry(frond, 5533756, 0.14));
  }
  return merge(parts);
}

function bushGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const blob = new IcosahedronGeometry(0.55 + Math.random() * 0.3, 1);
    blob.scale(1.2, 0.8, 1.2);
    blob.translate((Math.random() - 0.5) * 0.7, 0.45 + Math.random() * 0.25, (Math.random() - 0.5) * 0.7);
    parts.push(coloredGeometry(blob, 4151089, 0.14));
  }
  return merge(parts);
}

function rockGeometry(): BufferGeometry {
  const geo = new IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const rng = makeRng(11);
  for (let i = 0; i < pos.count; i++) {
    const d = 0.6 + rng() * 0.7;
    pos.setXYZ(i, pos.getX(i) * d * 1.2, pos.getY(i) * d * 0.8, pos.getZ(i) * d);
  }
  geo.computeVertexNormals();
  return coloredGeometry(geo, 8223344, 0.12);
}

function grassGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const blade = new ConeGeometry(0.05, 0.6 + Math.random() * 0.3, 3, 1, true);
    blade.translate(0, 0.3, 0);
    blade.rotateZ((Math.random() - 0.5) * 0.5);
    blade.rotateY(Math.random() * 6.28);
    blade.translate((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.35);
    parts.push(coloredGeometry(blade, 6584895, 0.18));
  }
  return merge(parts);
}

function fernGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const frond = new ConeGeometry(0.07, 0.9, 3, 1, true);
    frond.translate(0, 0.45, 0);
    frond.rotateZ(0.7);
    frond.rotateY((i / 5) * Math.PI * 2);
    parts.push(coloredGeometry(frond, 4611892, 0.16));
  }
  return merge(parts);
}

type Matrix = Matrix4;

/** 植被：程序几何 + 种子化散布 + GPU 实例 + 风场顶点摇曳（旧版 cB） */
export class Vegetation {
  readonly group = new Group();
  readonly wind = { value: 0 };
  private mat: MeshStandardMaterial;
  counts: Record<string, number> = {};

  constructor(scene: Scene, private terrain: Terrain, private road: { n: number; x: Float32Array; z: Float32Array }) {
    scene.add(this.group);
    this.mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader =
        `uniform float uWind;
` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         #else
           vec3 iPos = vec3(0.0);
         #endif
         float sway = sin(uWind * 1.15 + iPos.x * 0.09 + iPos.z * 0.06) * 0.055
                    + sin(uWind * 2.6 + iPos.z * 0.13) * 0.018;
         float amt = max(transformed.y - 0.8, 0.0);
         transformed.x += sway * amt;
         transformed.z += sway * 0.55 * amt;`,
        );
    };
    (this.mat as any).customProgramCacheKey = () => "veg-wind-v1";
    this.place();
  }

  private nearSite(x: number, z: number, factor = 1): boolean {
    for (const key of Object.keys(SITES) as Array<keyof typeof SITES>) {
      const s: Site = SITES[key];
      if (Math.hypot(x - s.x, z - s.z) < s.r * factor) return true;
    }
    return false;
  }

  private place() {
    const terrain = this.terrain;
    const rng = makeRng(20261018);
    const lists: Record<string, Matrix[]> = {
      pine: [],
      spruce: [],
      oak: [],
      birch: [],
      palm: [],
      bush: [],
      rock: [],
      grass: [],
      fern: [],
    };
    const tmpObj = new Object3D();

    const treeTarget = 7600;
    while (lists.pine.length + lists.spruce.length + lists.oak.length + lists.birch.length + lists.palm.length < treeTarget) {
      const angle = rng() * Math.PI * 2;
      const dist = 40 + Math.pow(rng(), 0.55) * 545;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = terrain.sampleHF(x, z);
      if (
        h < 2 ||
        h > 78 ||
        terrain.slopeAt(x, z) > 0.62 ||
        this.nearSite(x, z, 1.05) ||
        Math.abs(dist - roadRadiusAtAngle(this.road as any, x, z)) < 8.5 ||
        distToPolyline(x, z, TRAIL) < 4.5
      )
        continue;
      const wet = fbm(x * 0.0042 + 3.1, z * 0.0042 - 2.2, 4);
      if (wet < 0.3 && rng() > 0.2) continue;
      const s = 0.5 + rng() * 0.6;
      tmpObj.position.set(x, h - 0.2, z);
      tmpObj.rotation.set((rng() - 0.5) * 0.07, rng() * 6.28, (rng() - 0.5) * 0.07);
      tmpObj.scale.set(s, s * (0.85 + rng() * 0.4), s);
      tmpObj.updateMatrix();
      const m = tmpObj.matrix.clone();
      if (h < 7 && dist > WORLD.R * 0.72 && rng() < 0.5) lists.palm.push(m);
      else if (h > 30 || (h > 16 && wet > 0.55)) lists.pine.push(m);
      else if (h > 12 && rng() < 0.4) lists.spruce.push(m);
      else if (h < 9 && rng() < 0.45) lists.birch.push(m);
      else lists.oak.push(m);
    }

    for (let tries = 0; tries < 14e3 && lists.bush.length + lists.fern.length < 4200; tries++) {
      const angle = rng() * Math.PI * 2;
      const dist = 30 + rng() * 550;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = terrain.sampleHF(x, z);
      if (h < 1.5 || h > 60 || this.nearSite(x, z, 0.95) || Math.abs(dist - roadRadiusAtAngle(this.road as any, x, z)) < 6)
        continue;
      const s = 0.5 + rng() * 0.9;
      tmpObj.position.set(x, h, z);
      tmpObj.rotation.set(0, rng() * 6.28, 0);
      tmpObj.scale.set(s, s, s);
      tmpObj.updateMatrix();
      (rng() < 0.55 ? lists.bush : lists.fern).push(tmpObj.matrix.clone());
    }

    for (let tries = 0; tries < 9e3 && lists.rock.length < 900; tries++) {
      const angle = rng() * Math.PI * 2;
      const dist = 80 + rng() * 540;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = terrain.sampleHF(x, z);
      if (
        h < -1 ||
        h > 80 ||
        (terrain.slopeAt(x, z) < 0.18 && rng() > 0.25) ||
        Math.abs(dist - roadRadiusAtAngle(this.road as any, x, z)) < 7
      )
        continue;
      const s = 0.5 + rng() * 2.4;
      tmpObj.position.set(x, h + s * 0.15, z);
      tmpObj.rotation.set(rng() * 0.4, rng() * 6.28, rng() * 0.4);
      tmpObj.scale.set(s, s * (0.5 + rng() * 0.5), s);
      tmpObj.updateMatrix();
      lists.rock.push(tmpObj.matrix.clone());
    }

    for (let tries = 0; tries < 16e3 && lists.grass.length < 7e3; tries++) {
      const angle = rng() * Math.PI * 2;
      const dist = 90 + rng() * 470;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = terrain.sampleHF(x, z);
      if (h < 2.4 || h > 45 || terrain.slopeAt(x, z) > 0.55 || Math.abs(dist - roadRadiusAtAngle(this.road as any, x, z)) < 5.2)
        continue;
      const s = 0.7 + rng() * 1.2;
      tmpObj.position.set(x, h, z);
      tmpObj.rotation.set(0, rng() * 6.28, 0);
      tmpObj.scale.set(s, s * (0.8 + rng() * 0.6), s);
      tmpObj.updateMatrix();
      lists.grass.push(tmpObj.matrix.clone());
    }

    this.addInstanced(pineGeometry(), lists.pine, 0.06);
    this.addInstanced(spruceGeometry(), lists.spruce, 0.06);
    this.addInstanced(oakGeometry(), lists.oak, 0.05);
    this.addInstanced(birchGeometry(), lists.birch, 0.05);
    this.addInstanced(palmGeometry(), lists.palm, 0.05);
    this.addInstanced(bushGeometry(), lists.bush, 0.06);
    this.addInstanced(fernGeometry(), lists.fern, 0.06);
    this.addInstanced(rockGeometry(), lists.rock, 0.1).castShadow = true;
    const grass = this.addInstanced(grassGeometry(), lists.grass, 0.08);
    grass.castShadow = false;
    this.counts = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]));
    console.log("vegetation", this.counts);
  }

  private addInstanced(geo: BufferGeometry, matrices: Matrix[], jitter: number): InstancedMesh {
    const mesh = new InstancedMesh(geo, this.mat as Material, matrices.length);
    const color = new Color();
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      const f = 1 + (Math.random() - 0.5) * jitter * 2;
      color.setRGB(f, f * (0.98 + Math.random() * 0.06), f * (0.96 + Math.random() * 0.06));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  update(dt: number) {
    this.wind.value += dt;
  }
}

export type { Mesh, Group, Quaternion, Euler, Vector3 };
