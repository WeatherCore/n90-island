import { create } from "zustand";
import type { ReactNode } from "react";

export type PanelSpec =
  | { kind: "custom"; sub: string; title: string; body: ReactNode; foot: string }
  | { kind: "fish" }
  | { kind: "camp" }
  | { kind: "offroad" };

export interface InspectUiState {
  doorsOn: boolean;
  doorsLabel: string;
  trunkOn: boolean;
  trunkLabel: string;
  tentOn: boolean;
  tentLabel: string;
  view: string;
  paint: number;
}

export interface AudioUiState {
  music: number;
  sfx: number;
  master: number;
  track: string | null;
}

export interface AppState {
  phase: "loading" | "entered";
  loadPct: number;
  loadStatus: string;
  hudOn: boolean;
  prompt: string | null;
  panel: PanelSpec | null;
  panelNonce: number;
  mission: { title: string; desc: string };
  toast: { id: number; text: string } | null;
  cine: boolean;
  inspectOn: boolean;
  audioPanelOn: boolean;
  questsOpen: boolean;
  albumOpen: boolean;
  flashNonce: number;
  inspectUi: InspectUiState;
  audioUi: AudioUiState;

  setLoad(pct: number, status?: string): void;
  enterGame(): void;
  setPrompt(text: string | null): void;
  setPanel(spec: PanelSpec | null): void;
  bumpPanel(): void;
  setMission(title: string, desc: string): void;
  showToast(text: string): void;
  clearToast(id: number): void;
  setCine(on: boolean): void;
  setHudOn(on: boolean): void;
  setInspectOn(on: boolean): void;
  setAudioPanelOn(on: boolean): void;
  setQuestsOpen(on: boolean): void;
  setAlbumOpen(on: boolean): void;
  flash(): void;
  setInspectUi(patch: Partial<InspectUiState>): void;
  setAudioUi(patch: Partial<AudioUiState>): void;
}

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<AppState>((set, get) => ({
  phase: "loading",
  loadPct: 0,
  loadStatus: "",
  hudOn: false,
  prompt: null,
  panel: null,
  panelNonce: 0,
  mission: { title: "沿着环岛公路", desc: "绕岛一周约 5 分钟。发现码头、营地与越野小径。" },
  toast: null,
  cine: false,
  inspectOn: false,
  audioPanelOn: false,
  questsOpen: false,
  albumOpen: false,
  flashNonce: 0,
  inspectUi: {
    doorsOn: false,
    doorsLabel: "关闭",
    trunkOn: false,
    trunkLabel: "关闭",
    tentOn: false,
    tentLabel: "已收起",
    view: "orbit",
    paint: 0,
  },
  audioUi: { music: 0.5, sfx: 0.75, master: 0.8, track: null },

  setLoad(pct, status) {
    set((s) => ({ loadPct: pct, loadStatus: status ?? s.loadStatus }));
  },
  enterGame() {
    set({ phase: "entered", hudOn: true });
  },
  setPrompt(text) {
    if (get().prompt !== text) set({ prompt: text });
  },
  setPanel(spec) {
    set((s) => ({ panel: spec, panelNonce: s.panelNonce + 1 }));
  },
  bumpPanel() {
    set((s) => ({ panelNonce: s.panelNonce + 1 }));
  },
  setMission(title, desc) {
    set({ mission: { title, desc } });
  },
  showToast(text) {
    const id = ++toastId;
    set({ toast: { id, text } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => get().clearToast(id), 2200);
  },
  clearToast(id) {
    if (get().toast?.id === id) set({ toast: null });
  },
  setCine(on) {
    set({ cine: on });
  },
  setHudOn(on) {
    set({ hudOn: on });
  },
  setInspectOn(on) {
    set({ inspectOn: on });
  },
  setAudioPanelOn(on) {
    set({ audioPanelOn: on });
  },
  setQuestsOpen(on) {
    set({ questsOpen: on });
  },
  setAlbumOpen(on) {
    set({ albumOpen: on });
  },
  flash() {
    set((s) => ({ flashNonce: s.flashNonce + 1 }));
  },
  setInspectUi(patch) {
    set((s) => ({ inspectUi: { ...s.inspectUi, ...patch } }));
  },
  setAudioUi(patch) {
    set((s) => ({ audioUi: { ...s.audioUi, ...patch } }));
  },
}));

/** 每帧变化的 HUD 数值：绕过 React 渲染，由 HUD 组件用 rAF 直接写 DOM */
export const liveHud = {
  speed: "0",
  gear: "D",
  compass: "N · 000°",
  lap: "0:00",
  clock: "15:12 AFTERNOON",
};

/** 引擎回调接口（旧版 yB 的等价物） */
export interface UiBridge {
  showPrompt(text: string): void;
  hidePrompt(): void;
  showPanel(spec: PanelSpec): void;
  hidePanel(): void;
  setMission(title: string, desc: string): void;
  cinematic(on: boolean): void;
  setLap(text: string): void;
  toast(text: string): void;
}

export const storeBridge: UiBridge = {
  showPrompt: (text) => useApp.getState().setPrompt(text),
  hidePrompt: () => useApp.getState().setPrompt(null),
  showPanel: (spec) => useApp.getState().setPanel(spec),
  hidePanel: () => useApp.getState().setPanel(null),
  setMission: (title, desc) => useApp.getState().setMission(title, desc),
  cinematic: (on) => useApp.getState().setCine(on),
  setLap: (text) => {
    liveHud.lap = text;
  },
  toast: (text) => useApp.getState().showToast(text),
};
