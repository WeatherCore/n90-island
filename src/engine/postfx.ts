import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Color, Vector2, type Camera, type Scene, type ShaderMaterialParameters, type WebGLRenderer } from "three";

/** 调色/暗角/颗粒/色差 pass（旧版 k6） */
export const GradeShader: ShaderMaterialParameters & { name?: string } = {
  name: "GradeShader",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.5 },
    uGrain: { value: 0.035 },
    uChroma: { value: 9e-4 },
    uSaturation: { value: 1.04 },
    uContrast: { value: 1.07 },
    uLift: { value: new Color(264978) },
    uGain: { value: new Color(16447215) },
    uResolution: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uChroma, uSaturation, uContrast;
    uniform vec3 uLift, uGain;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float ca = uChroma * dot(d, d);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;

      col = col * uGain + uLift;

      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;

      float v = smoothstep(0.92, 0.28, length(d) * 1.35);
      col *= mix(1.0 - uVignette, 1.0, v);

      float g = hash(uv * uResolution + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

/** 渲染管线：Render → Bloom → 调色 → 输出（旧版 FB） */
export class PostFX {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.composer.setSize(innerWidth, innerHeight);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.3, 0.7, 1.35);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader as any);
    (this.grade.uniforms.uResolution.value as Vector2).set(innerWidth, innerHeight);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  resize(w: number, h: number) {
    this.composer.setSize(w, h);
    (this.grade.uniforms.uResolution.value as Vector2).set(w, h);
    this.bloom.setSize(w, h);
  }

  render(dt: number) {
    (this.grade.uniforms.uTime.value as number) += dt;
    this.composer.render(dt);
  }
}
