// 轻量存档（二期内容的落点：任务进度/收集品/最佳成绩/偏好）
const KEY = "n90-save-v1";

export interface SaveData {
  journal: string[]; // 已完成的体验 id：fish / camp / offroad / trial / lap / motes / photo
  bestLap: number | null; // 最佳环岛圈速（秒，自由驾驶）
  trialBest: number | null; // 计时赛最佳成绩（秒）
  motes: string[]; // 已拾取光尘 id
  paint: number; // 车漆索引
  timeIndex: number | null; // 昼夜预设索引
}

const DEFAULT: SaveData = { journal: [], bestLap: null, trialBest: null, motes: [], paint: 0, timeIndex: null };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      journal: Array.isArray(parsed.journal) ? parsed.journal.filter((x: unknown) => typeof x === "string") : [],
      bestLap: typeof parsed.bestLap === "number" ? parsed.bestLap : null,
      trialBest: typeof parsed.trialBest === "number" ? parsed.trialBest : null,
      motes: Array.isArray(parsed.motes) ? parsed.motes.filter((x: unknown) => typeof x === "string") : [],
      paint: typeof parsed.paint === "number" ? parsed.paint : 0,
      timeIndex: typeof parsed.timeIndex === "number" ? parsed.timeIndex : null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式等场景忽略 */
  }
}
