import {
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  MathUtils,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Scene,
} from "three";

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uNight;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; }
  return s;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -0.2, 1.0);

  float t = pow(clamp(h, 0.0, 1.0), 0.28);
  vec3 col = mix(uHorizon, uZenith, t);

  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 5.0) * 0.20 * (1.0 - smoothstep(0.0, 0.6, h));
  col += uSunColor * pow(sd, 64.0) * 0.35;

  float sun = smoothstep(0.99965, 0.99995, dot(dir, normalize(uSunDir)));
  col += uSunColor * sun * 4.0;

  if (dir.y > 0.005) {
    vec2 p = dir.xz / (dir.y + 0.12);
    float drift = uTime * 0.0035;
    float c1 = fbm(p * 1.4 + vec2(drift, drift * 0.4));
    float c2 = fbm(p * 3.1 + vec2(-drift * 1.7, drift * 0.6) + 9.0);
    float clouds = smoothstep(0.52, 0.86, c1 * 0.72 + c2 * 0.38);
    clouds *= smoothstep(0.0, 0.22, dir.y);
    vec3 lit = mix(vec3(0.72,0.76,0.82), uSunColor * 1.25, 0.55 + 0.45 * pow(sd, 3.0));
    lit = mix(lit, vec3(0.16,0.19,0.26), uNight * 0.75);
    float shade = smoothstep(0.35, 0.95, c2);
    col = mix(col, lit * (0.72 + 0.38 * shade), clouds * 0.85);
  }

  if (uNight > 0.02 && dir.y > 0.0) {
    vec2 sp = dir.xz / (dir.y + 0.3) * 180.0;
    float s = hash(floor(sp));
    float star = smoothstep(0.9975, 1.0, s) * smoothstep(0.0, 0.25, dir.y);
    col += vec3(0.9, 0.95, 1.0) * star * uNight * 1.4;
  }

  col = mix(col, uHorizon * 1.05, smoothstep(0.08, -0.02, dir.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** 天空穹顶 + 太阳/补光 + 雾 + 昼夜系统（旧版 EB） */
export class Sky {
  readonly uniforms = {
    uSunDir: { value: new Vector3(0.4, 0.25, 0.6).normalize() },
    uZenith: { value: new Color(1785704) },
    uHorizon: { value: new Color(13622756) },
    uSunColor: { value: new Color(16765601) },
    uTime: { value: 0 },
    uNight: { value: 0 },
  };
  readonly mesh: Mesh;
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly ambient: AmbientLight;
  readonly fill: DirectionalLight;
  time = 15.2;
  sunElev = 0.18;

  constructor(private scene: Scene) {
    const geo = new SphereGeometry(1200, 48, 32);
    const mat = new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    this.sun = new DirectionalLight(16769720, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 900;
    const s = 170;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -6e-4;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun);
    this.sun.target = new (this.sun.target.constructor as any)();
    scene.add(this.sun.target);

    this.hemi = new HemisphereLight(12572927, 3879716, 0.85);
    scene.add(this.hemi);
    this.ambient = new AmbientLight(2832970, 0.3);
    scene.add(this.ambient);
    this.fill = new DirectionalLight(10470632, 0.55);
    this.fill.position.set(-260, 180, 240);
    scene.add(this.fill);

    scene.fog = new FogExp2(13612954, 3e-4);
    this.setTime(15.2);
  }

  /** 设定一天中的时刻（小时），旧版 setTime 原样移植 */
  setTime(t: number) {
    this.time = t;
    const dayT = (t - 6) / 12;
    const angle = Math.PI * dayT;
    const elev = Math.sin(angle) * 0.92;
    const azim = 3.62 + (t - 15) * 0.26;
    const dir = new Vector3(Math.cos(azim) * Math.cos(elev), Math.sin(elev), Math.sin(azim) * Math.cos(elev)).normalize();
    this.uniforms.uSunDir.value.copy(dir);
    this.sunElev = Math.max(-0.15, dir.y);
    const dusk = 1 - MathUtils.smoothstep(elev, 0.02, 0.55);
    const night = MathUtils.smoothstep(-elev, 0.02, 0.22);
    const warmSun = new Color(16757866);
    const sunColor = new Color(16774109).clone().lerp(warmSun, dusk);
    this.uniforms.uSunColor.value.copy(sunColor);
    this.uniforms.uZenith.value.copy(new Color(1785704).lerp(new Color(529190), night));
    this.uniforms.uHorizon.value
      .copy(new Color(13622756).lerp(new Color(14721646), dusk * 0.92).lerp(new Color(13199418), dusk * dusk * 0.45))
      .lerp(new Color(1055276), night);
    this.uniforms.uNight.value = night;
    this.sun.color.copy(sunColor);
    this.sun.intensity = 5.2 * Math.max(0, Math.sin(Math.max(0.02, elev))) * (1 - night * 0.85);
    this.sun.position.copy(dir).multiplyScalar(620);
    this.sun.position.y = Math.max(this.sun.position.y, 40);
    this.hemi.intensity = 1 * (1 - night * 0.8) + 0.1;
    this.hemi.color.copy(new Color(12572927).lerp(new Color(2766160), night));
    this.ambient.intensity = 0.22 + night * 0.12;
    this.fill.intensity = 0.55 * (1 - night * 0.6);
    const fog = this.scene.fog as FogExp2;
    fog.color.copy(this.uniforms.uHorizon.value).lerp(new Color(10467012), 0.45);
    fog.density = 42e-5 + night * 22e-5;
    (this.scene as any).environmentIntensity = 0.9;
  }

  update(dt: number, cameraPos: { position: Vector3 }) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(cameraPos.position);
    const target = this.sun.target;
    target.position.set(cameraPos.position.x, 0, cameraPos.position.z);
    this.sun.position.copy(target.position).add(this.uniforms.uSunDir.value.clone().multiplyScalar(400));
    target.updateMatrixWorld();
  }
}
