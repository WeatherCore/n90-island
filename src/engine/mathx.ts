// 确定性随机与噪声 —— 与旧版逐位一致（种子逻辑不可改动，否则地形分布漂移）
export type Rng = () => number;

/** 种子随机数（mulberry32 变体，旧版 CB） */
export function makeRng(seed: number): Rng {
  let g = seed | 0;
  return function () {
    g = (g + 1831565813) | 0;
    let a = Math.imul(g ^ (g >>> 15), 1 | g);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D 哈希（旧版 BB） */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (x: number) => x * x * (3 - 2 * x); // 旧版 yj

/** 2D value noise（旧版 zB） */
export function valueNoise(x: number, y: number): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  const fx = x - px;
  const fy = y - py;
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a = hash2(px, py);
  const b = hash2(px + 1, py);
  const c = hash2(px, py + 1);
  const d = hash2(px + 1, py + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/** 分形噪声（旧版 ED：octaves=5, lacunarity=2.02, gain=0.5 默认） */
export function fbm(x: number, y: number, octaves = 5, lacunarity = 2.02, gain = 0.5): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 山脊噪声（旧版 Jj） */
export function ridged(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)); // 旧版 IB
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t; // 旧版 F8
/** 0-1 区间 smoothstep（旧版 mv） */
export const smoothstep01 = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
