import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import { SITES, SITE_CAMP, TRAIL, WORLD, type Site } from "./config";
import { clamp, fbm, lerp, ridged, smoothstep01, valueNoise } from "./mathx";
import type { Road } from "./road";

/** 岛屿半径（旧版 lc） */
export function islandRadius(x: number, z: number): number {
  const n = 0.72 + 0.5 * fbm(x * 0.0026 + 31.7, z * 0.0026 - 17.3, 4);
  return WORLD.R * (0.74 + 0.34 * n);
}

/** 环岛公路半径（旧版 E4） */
export function roadRadiusAt(theta: number): number {
  return WORLD.roadRadius + 34 * Math.sin(theta * 3 + 0.7) + 17 * Math.sin(theta * 5 - 1.9) + 9 * Math.sin(theta * 9 + 2.3);
}

/** 折线最近距离（旧版 T4） */
export function distToPolyline(x: number, z: number, pts: Array<[number, number]>): number {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

/** 基础地形高度场（旧版 o4） */
export function baseHeight(x: number, z: number): number {
  const r = islandRadius(x, z);
  const v = Math.hypot(x, z) / r;
  const d = fbm(x * 0.0032 + 11.3, z * 0.0032 - 7.7, 6);
  const w = ridged(x * 0.0019 - 4.1, z * 0.0019 + 2.6, 5);
  const inland = smoothstep01(1, 0.6, v);
  let h = 1.6 + inland * (5 + 30 * Math.pow(d, 1.35) + 17 * w * d);
  const nx = (x + 258) / 215;
  const nz = (z + 196) / 195;
  const mountain = Math.exp(-(nx * nx + nz * nz) * 1.15);
  h += mountain * (46 + 68 * Math.pow(w, 1.35)) * smoothstep01(0.15, 0.6, d + 0.3) * inland;
  const jx = (x - 330) / 260;
  const jz = (z + 210) / 300;
  h += Math.exp(-(jx * jx + jz * jz)) * 24 * d * inland;
  const skirt = smoothstep01(0.885, 0.94, v) * (1 - smoothstep01(0.99, 1.04, v));
  h = lerp(h, 0.85 + 0.8 * d, skirt * 0.92);
  h = lerp(h, -16, smoothstep01(1, 1.2, v));
  return h;
}

/** 地形法线贴图（canvas 程序生成，旧版 Nc） */
function makeTerrainNormalMap(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  const field = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      field[y * 256 + x] = fbm(x * 0.06 + 3.1, y * 0.06 - 1.7, 4) * 0.65 + fbm(x * 0.19, y * 0.19, 3) * 0.35;
    }
  }
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const l = field[y * 256 + ((x + 256 - 1) % 256)];
      const r = field[y * 256 + ((x + 1) % 256)];
      const u = field[((y + 256 - 1) % 256) * 256 + x];
      const d = field[((y + 1) % 256) * 256 + x];
      const nx = (l - r) * 3.2;
      const ny = (u - d) * 3.2;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * 256 + x) * 4;
      img.data[o] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[o + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(140, 140);
  tex.anisotropy = 4;
  return tex;
}

/** 地形反照率贴图（canvas 程序生成，旧版 Sc） */
function makeTerrainAlbedoMap(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const n1 = fbm(x * 0.045 + 2.1, y * 0.045 - 4.3, 4);
      const n2 = fbm(x * 0.17, y * 0.17, 3);
      const v = 0.82 + n1 * 0.22 + (n2 - 0.5) * 0.12;
      const g = Math.min(255, Math.max(0, v * 255));
      const o = (y * 512 + x) * 4;
      img.data[o] = g * 0.94;
      img.data[o + 1] = g;
      img.data[o + 2] = g * 0.86;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(120, 120);
  tex.anisotropy = 8;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** 地形：高度场 + 网格（旧版 jB） */
export class Terrain {
  readonly res = WORLD.heightRes;
  readonly step = WORLD.size / (WORLD.heightRes - 1);
  readonly hf: Float32Array;
  readonly mesh: Mesh;

  constructor(public road: Road) {
    this.hf = new Float32Array(this.res * this.res);
    this.buildField();
    this.mesh = this.buildMesh();
  }

  /** 公路混合权重（0-1，旧版 roadBlend） */
  roadBlend(x: number, z: number): number {
    const theta = Math.atan2(z, x);
    const d = Math.hypot(x, z);
    const diff = Math.abs(d - roadRadiusAt(theta));
    return 1 - smoothstep01(10, 30, diff);
  }

  /** 公路某角度处的路面高程（旧版 roadElevAt） */
  roadElevAt(theta: number): number {
    const t = ((theta < 0 ? theta + Math.PI * 2 : theta) / (Math.PI * 2)) * this.road.n;
    const i = Math.floor(t) % this.road.n;
    const j = (i + 1) % this.road.n;
    const f = t - Math.floor(t);
    return this.road.y[i] * (1 - f) + this.road.y[j] * f;
  }

  /** 含站点压平/小径下切/公路融合的最终高度（旧版 height） */
  height(x: number, z: number): number {
    let h = baseHeight(x, z);
    for (const site of [SITE_CAMP, SITES.VILLAGE, SITES.DOCK] as Site[]) {
      const d = Math.hypot(x - site.x, z - site.z);
      const t = 1 - smoothstep01(site.r * 0.55, site.r, d);
      h = lerp(h, site.h, t * 0.92);
    }
    const trailD = distToPolyline(x, z, TRAIL);
    if (trailD < 26) {
      const carve = Math.exp(-Math.pow(trailD / 7.5, 2));
      h -= carve * 3.6;
      h = lerp(h, h * 0.55 - 1.2, Math.exp(-Math.pow(trailD / 20, 2)) * 0.25);
    }
    const road = this.roadBlend(x, z);
    if (road > 0) h = lerp(h, this.roadElevAt(Math.atan2(z, x)), road * 0.94);
    return h;
  }

  private buildField() {
    const { res, step } = this;
    for (let j = 0; j < res; j++) {
      const z = -WORLD.half + j * step;
      for (let i = 0; i < res; i++) {
        const x = -WORLD.half + i * step;
        this.hf[j * res + i] = this.height(x, z);
      }
    }
  }

  /** 双线性采样高度场（旧版 sampleHF） */
  sampleHF(x: number, z: number): number {
    const map = (v: number) => clamp((v + WORLD.half) / this.step, 0, this.res - 1.001);
    const fx = map(x);
    const fz = map(z);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = this.hf[iz * this.res + ix];
    const h10 = this.hf[iz * this.res + ix + 1];
    const h01 = this.hf[(iz + 1) * this.res + ix];
    const h11 = this.hf[(iz + 1) * this.res + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  normalAt(x: number, z: number, eps = 1.6): Vector3 {
    const hl = this.sampleHF(x - eps, z);
    const hr = this.sampleHF(x + eps, z);
    const hd = this.sampleHF(x, z - eps);
    const hu = this.sampleHF(x, z + eps);
    return new Vector3(hl - hr, 2 * eps, hd - hu).normalize();
  }

  slopeAt(x: number, z: number): number {
    return 1 - this.normalAt(x, z).y;
  }

  private buildMesh(): Mesh {
    const seg = WORLD.seg;
    const res = this.res;
    const geo = new BufferGeometry();
    const count = (seg + 1) * (seg + 1);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    // 顶点配色板（旧版数字原样）
    const cShoreA = new Color(13482898);
    const cShoreB = new Color(9403484);
    const cGrass = new Color(6258495);
    const cMeadow = new Color(3955244);
    const cCamp = new Color(9083983);
    const cRock = new Color(7301728);
    const cRock2 = new Color(4867647);
    const cHigh = new Color(12173762);
    const cTmp = new Color();

    for (let gy = 0; gy <= seg; gy++) {
      for (let gx = 0; gx <= seg; gx++) {
        const hi = Math.round((gx / seg) * (res - 1));
        const hj = Math.round((gy / seg) * (res - 1));
        const x = -WORLD.half + (gx / seg) * WORLD.size;
        const z = -WORLD.half + (gy / seg) * WORLD.size;
        const h = this.hf[hj * res + hi];
        const idx = gy * (seg + 1) + gx;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = h;
        positions[idx * 3 + 2] = z;
        uvs[idx * 2] = gx / seg;
        uvs[idx * 2 + 1] = gy / seg;
        const slope = this.slopeAt(x, z);
        const n = valueNoise(x * 0.06, z * 0.06);
        const a = fbm(x * 0.012, z * 0.012, 4);
        if (h < 1.2) {
          cTmp.copy(cShoreB).lerp(cShoreA, smoothstep01(-1.5, 1.2, h));
        } else if (h < 3.4 && slope < 0.35) {
          cTmp.copy(cShoreA).lerp(cGrass, smoothstep01(2.2, 3.6, h));
        } else {
          cTmp.copy(cMeadow).lerp(cGrass, a * 0.85 + 0.15);
        }
        const campD = Math.hypot(x - SITE_CAMP.x, z - SITE_CAMP.z);
        if (campD < SITE_CAMP.r * 1.5) {
          cTmp.lerp(cCamp, (1 - campD / (SITE_CAMP.r * 1.5)) * 0.55);
        }
        let rockMix = smoothstep01(0.34, 0.62, slope + n * 0.06);
        if (rockMix > 0) cTmp.lerp(n > 0.5 ? cRock : cRock2, rockMix);
        if (h > 74) cTmp.lerp(cHigh, smoothstep01(74, 104, h) * 0.75);
        cTmp.offsetHSL(0, 0, (n - 0.5) * 0.045);
        colors[idx * 3] = cTmp.r;
        colors[idx * 3 + 1] = cTmp.g;
        colors[idx * 3 + 2] = cTmp.b;
      }
    }
    const indices = new Uint32Array(seg * seg * 6);
    let p = 0;
    for (let gy = 0; gy < seg; gy++) {
      for (let gx = 0; gx < seg; gx++) {
        const a = gy * (seg + 1) + gx;
        const b = a + 1;
        const c = a + seg + 1;
        const d = c + 1;
        indices[p++] = a;
        indices[p++] = c;
        indices[p++] = b;
        indices[p++] = b;
        indices[p++] = c;
        indices[p++] = d;
      }
    }
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setAttribute("uv", new BufferAttribute(uvs, 2));
    geo.setIndex(new Uint32BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0,
      map: makeTerrainAlbedoMap(),
      normalMap: makeTerrainNormalMap(),
      normalScale: new Vector2(0.8, 0.8),
    });
    // 草地/岩石着色与沙滩提亮的片元 patch（旧版 onBeforeCompile 原样）
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos; varying vec3 vWNrm;`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * objectNormal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos; varying vec3 vWNrm;
          float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
          float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
            return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
          float fbm2(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float dn = fbm2(vWPos.xz * 0.55);
          float dn2 = fbm2(vWPos.xz * 3.1 + 7.0);
          float grain = mix(dn, dn2, 0.45);
          vec3 grassTint = mix(vec3(0.86,0.93,0.74), vec3(1.08,1.02,0.82), grain);
          vec3 rockTint = mix(vec3(0.82,0.8,0.77), vec3(1.1,1.05,1.0), grain);
          float rockMask = smoothstep(0.55, 0.9, vWNrm.y * -1.0 + 1.55);
          diffuseColor.rgb *= mix(grassTint, rockTint, rockMask * 0.8);
          diffuseColor.rgb *= 0.94 + 0.12 * dn2;
          float sandMask = smoothstep(0.5, 0.15, abs(vWPos.y - 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06,1.0,0.9), sandMask);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + (dn2 - 0.5) * 0.12, 0.55, 1.0);`,
        );
    };
    const mesh = new Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

/** 公路上某角度的半径（旧版 MB，植被放置用） */
export function roadRadiusAtAngle(road: Road, x: number, z: number): number {
  let theta = Math.atan2(z, x);
  if (theta < 0) theta += Math.PI * 2;
  const i = Math.floor((theta / (Math.PI * 2)) * road.n) % road.n;
  return Math.hypot(road.x[i], road.z[i]);
}
