import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  NearestFilter,
  Vector2,
  Vector3,
  type Scene,
} from "three";
import { WORLD } from "./config";
import type { Terrain } from "./terrain";
import type { Sky } from "./sky";

const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vView;

float wave(vec2 p, vec2 d, float amp, float len, float spd) {
  return sin(dot(p, d) * (6.2831 / len) + uTime * spd) * amp;
}

void main() {
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  float h = 0.0;
  h += wave(wp.xz, normalize(vec2(1.0, 0.25)), 0.22, 74.0, 0.55);
  h += wave(wp.xz, normalize(vec2(-0.45, 1.0)), 0.16, 51.0, 0.72);
  h += wave(wp.xz, normalize(vec2(0.8, -0.6)), 0.09, 29.0, 0.95);
  wp.y += h;
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const WATER_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vView;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform sampler2D uHeight;
uniform vec2 uHeightRange;
uniform float uNight;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }

vec2 waveGrad(vec2 p, vec2 d, float amp, float len, float spd) {
  float k = 6.2831 / len;
  float ph = dot(p, d) * k + uTime * spd;
  return d * k * amp * cos(ph);
}

void main() {
  vec2 huv = (vWorld.xz + uHeightRange.x) / uHeightRange.y;
  float th = -30.0 + texture2D(uHeight, clamp(huv, 0.0, 1.0)).r * 170.0;
  float depth = max(0.0, -th);

  vec2 g = vec2(0.0);
  g += waveGrad(vWorld.xz, normalize(vec2(1.0, 0.25)), 0.22, 74.0, 0.55);
  g += waveGrad(vWorld.xz, normalize(vec2(-0.45, 1.0)), 0.16, 51.0, 0.72);
  g += waveGrad(vWorld.xz, normalize(vec2(0.8, -0.6)), 0.09, 29.0, 0.95);
  g += waveGrad(vWorld.xz, normalize(vec2(0.35, 0.94)), 0.035, 13.0, 1.6);
  g += waveGrad(vWorld.xz, normalize(vec2(-0.92, 0.38)), 0.02, 7.5, 2.1);
  vec2 rn = vec2(fbm(vWorld.xz * 0.35 + uTime * 0.05), fbm(vWorld.xz * 0.35 - uTime * 0.04 + 5.0)) - 0.5;
  g += rn * 0.09;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

  vec3 viewDir = normalize(vView);
  float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 4.0);

  vec3 reflDir = reflect(-viewDir, n);
  vec3 skyRefl = mix(uHorizon, uZenith, pow(clamp(reflDir.y, 0.0, 1.0), 0.5));
  skyRefl = mix(skyRefl, vec3(0.13,0.35,0.42), 0.35);

  float shallow = 1.0 - smoothstep(1.0, 22.0, depth);
  vec3 water = mix(uDeep, uShallow, shallow * 0.92);
  water *= 0.9 + 0.22 * fbm(vWorld.xz * 0.06);

  vec3 h = normalize(normalize(uSunDir) + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 260.0);
  float glit = pow(max(dot(n, h), 0.0), 40.0) * 0.18;
  vec3 specCol = uSunColor * (spec * 5.0 + glit);

  float shoreFoam = smoothstep(2.2, 0.0, depth) * smoothstep(0.0, 0.35, depth + 0.5);
  float bands = fbm(vec2(depth * 2.6 - uTime * 0.35, vWorld.x * 0.05 + vWorld.z * 0.05));
  float foam = shoreFoam * smoothstep(0.55, 0.9, bands + 0.22 * sin(depth * 5.0 - uTime * 1.4)) * 0.8;
  foam += smoothstep(0.75, 1.0, fbm(vWorld.xz * 0.5 + uTime * 0.12)) * 0.25 * smoothstep(1.6, 0.0, depth);

  vec3 col = water;
  float distN = 1.0 - smoothstep(60.0, 420.0, length(vWorld.xz - cameraPosition.xz));
  g *= distN;
  col = mix(col, skyRefl, clamp(fres * 0.55 + 0.05, 0.0, 1.0));
  col += specCol;
  col = mix(col, vec3(0.92, 0.95, 0.94) * (0.7 + 0.3 * uNight), foam * 0.85);

  float dist = length(vWorld.xz - cameraPosition.xz);
  float fogF = 1.0 - exp(-pow(dist * 0.00038, 1.7));
  vec3 fogCol = mix(uHorizon, vec3(0.32, 0.42, 0.48), 0.55);
  col = mix(col, fogCol, clamp(fogF, 0.0, 0.72));

  float alpha = mix(0.55, 0.97, smoothstep(0.0, 6.0, depth));
  alpha *= 0.92 + 0.08 * fres;
  gl_FragColor = vec4(col, alpha);
}`;

/** 海面（顶点波浪位移 + 深度/泡沫着色，旧版 oB） */
export class Ocean {
  readonly uniforms;
  readonly mesh: Mesh;

  constructor(scene: Scene, terrain: Terrain) {
    const res = terrain.res;
    const data = new Uint8Array(res * res);
    for (let i = 0; i < res * res; i++) {
      data[i] = Math.max(0, Math.min(255, Math.round(((terrain.hf[i] + 30) / 170) * 255)));
    }
    const heightTex = new DataTexture(data, res, res, RedFormat, UnsignedByteType);
    heightTex.magFilter = NearestFilter;
    heightTex.minFilter = NearestFilter;
    heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping;
    heightTex.needsUpdate = true;

    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color(16767392) },
      uZenith: { value: new Color(2775958) },
      uHorizon: { value: new Color(15910811) },
      uDeep: { value: new Color(402480) },
      uShallow: { value: new Color(1936000) },
      uHeight: { value: heightTex },
      uHeightRange: { value: new Vector2(WORLD.half, WORLD.size) },
      uNight: { value: 0 },
    };

    const geo = new PlaneGeometry(3600, 3600, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const mat = new ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.position.y = 0.02;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  private sync(sky: Sky) {
    this.uniforms.uSunDir.value.copy(sky.uniforms.uSunDir.value);
    this.uniforms.uSunColor.value.copy(sky.uniforms.uSunColor.value);
    this.uniforms.uZenith.value.copy(sky.uniforms.uZenith.value);
    this.uniforms.uHorizon.value.copy(sky.uniforms.uHorizon.value);
    this.uniforms.uNight.value = sky.uniforms.uNight.value;
  }

  update(dt: number, sky: Sky) {
    this.uniforms.uTime.value += dt;
    this.sync(sky);
  }
}
