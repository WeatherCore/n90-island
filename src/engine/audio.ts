// 16 步音序器 + 噪声环境床 + 引擎声（旧版 xB 原样移植；音源文件外置）
interface TrackDef {
  bpm: number;
  name: string;
  kick: number[];
  snare: number[];
  hat: number[];
  bass: number[];
  lead: number[];
  leadType: OscillatorType;
  swing: number;
}

export const TRACKS: Record<string, TrackDef> = {
  sunny: {
    bpm: 112,
    name: "海岛晨光",
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    bass: [48, 0, 0, 48, 0, 0, 45, 0, 43, 0, 0, 43, 0, 0, 45, 0],
    lead: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0],
    leadType: "triangle",
    swing: 0.06,
  },
  neon: {
    bpm: 96,
    name: "霓虹夜驰",
    kick: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    bass: [33, 0, 0, 33, 0, 36, 0, 0, 31, 0, 0, 31, 0, 34, 0, 0],
    lead: [57, 0, 60, 0, 63, 0, 60, 0, 55, 0, 58, 0, 60, 0, 58, 0],
    leadType: "sawtooth",
    swing: 0,
  },
  areyouok: {
    bpm: 126,
    name: "彩蛋 · Are U OK",
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    bass: [40, 0, 40, 0, 43, 0, 40, 0, 38, 0, 40, 0, 43, 0, 45, 0],
    lead: [69, 69, 0, 67, 69, 0, 72, 0, 69, 69, 0, 67, 64, 0, 0, 0],
    leadType: "square",
    swing: 0,
  },
};

interface NoiseLoop {
  g: GainNode;
  filt: BiquadFilterNode;
  src: AudioBufferSourceNode;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  ready = false;
  track: string | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  vol = { master: 0.8, music: 0.5, sfx: 0.75 };
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private surf!: NoiseLoop;
  private wind!: NoiseLoop;
  private fire!: NoiseLoop;
  private engine!: GainNode;
  private engineOsc: OscillatorNode[] = [];
  private areyouok: AudioBuffer | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem("dsh-audio") || "{}");
      Object.assign(this.vol, saved);
    } catch {
      /* 忽略 */
    }
  }

  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol.master;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.vol.music;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.vol.sfx;
    this.sfxGain.connect(this.master);
    this.surf = this.noiseLoop(0.12, 420, 0.7);
    this.wind = this.noiseLoop(0.05, 900, 0.4);
    this.fire = this.noiseLoop(0, 1400, 0.5);
    this.engine = this.ctx.createGain();
    this.engine.gain.value = 0;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 700;
    const oscA = this.ctx.createOscillator();
    oscA.type = "sawtooth";
    oscA.frequency.value = 48;
    const oscB = this.ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = 96;
    const mix = this.ctx.createGain();
    mix.gain.value = 0.35;
    oscA.connect(mix);
    oscB.connect(mix);
    mix.connect(lowpass);
    lowpass.connect(this.engine);
    this.engine.connect(this.sfxGain);
    oscA.start();
    oscB.start();
    this.engineOsc = [oscA, oscB];
    this.ready = true;
    void this.loadEasterEgg();
    this.tick();
  }

  private async loadEasterEgg() {
    if (!this.ctx) return;
    try {
      const res = await fetch("./assets/audio/areyouok.mp3");
      const buf = await res.arrayBuffer();
      this.ctx.decodeAudioData(buf, (decoded) => {
        this.areyouok = decoded;
      }, () => {});
    } catch {
      /* 彩蛋加载失败不影响主流程 */
    }
  }

  private noiseLoop(volume: number, freq: number, q: number): NoiseLoop {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      acc = (acc + 0.02 * white) / 1.02;
      data[i] = acc * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start();
    return { g, filt, src };
  }

  private tick = () => {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const surfLevel = 0.1 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.35));
    this.surf.g.gain.setTargetAtTime(surfLevel, t, 0.6);
    this.wind.g.gain.setTargetAtTime(0.035 + 0.02 * Math.sin(t * 0.21), t, 1.2);
    requestAnimationFrame(this.tick);
  };

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private save() {
    try {
      localStorage.setItem("dsh-audio", JSON.stringify(this.vol));
    } catch {
      /* 忽略 */
    }
  }

  setVolume(which: "music" | "sfx" | "master", value: number) {
    this.vol[which] = Math.max(0, Math.min(1, value));
    if (this.ready && this.ctx) {
      const node = which === "music" ? this.musicGain : which === "sfx" ? this.sfxGain : this.master;
      node.gain.setTargetAtTime(this.vol[which], this.ctx.currentTime, 0.05);
    }
    this.save();
  }

  setSpeed(kmh: number) {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, kmh / 120);
    this.engine.gain.setTargetAtTime(v * 0.09, t, 0.15);
    const freq = 42 + v * 70;
    this.engineOsc[0].frequency.setTargetAtTime(freq, t, 0.2);
    this.engineOsc[1].frequency.setTargetAtTime(freq * 2.02, t, 0.2);
  }

  playMusic(name: string) {
    if (name !== "areyouok" && !TRACKS[name]) return;
    this.resume();
    if (!this.ready || !this.ctx) return;
    this.stopMusic();
    if (name === "areyouok" && this.areyouok) {
      this.track = "areyouok";
      const src = this.ctx.createBufferSource();
      src.buffer = this.areyouok;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 1;
      src.connect(g);
      g.connect(this.musicGain);
      src.start();
      this.bufferSource = src;
      return;
    }
    if (name === "areyouok" && !this.areyouok) name = "sunny";
    this.track = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
      } catch {
        /* 已停止 */
      }
      this.bufferSource = null;
    }
    this.track = null;
  }

  private schedule() {
    if (!this.ready || !this.ctx || !this.track) return;
    const def = TRACKS[this.track];
    if (!def) return;
    const stepDur = 60 / def.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(def, this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 16;
    }
  }

  private playStep(def: TrackDef, step: number, when: number) {
    if (def.kick[step]) this.kick(when);
    if (def.snare[step]) this.snare(when);
    if (def.hat[step]) this.hat(when);
    const bass = def.bass[step];
    if (bass) this.note(when, this.midi(bass), 0.22, "sawtooth", 0.16, 700, 0.02);
    const lead = def.lead[step];
    if (lead) this.note(when, this.midi(lead), 0.18, def.leadType, 0.12, 2600, 0.01);
  }

  private midi(n: number): number {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  private note(when: number, freq: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, when);
    g.gain.exponentialRampToValueAtTime(vol, when + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(1e-4, when + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = cutoff || 1800;
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private kick(when: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  private noiseHit(when: number, dur: number, type: BiquadFilterType, freq: number, vol: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.musicGain);
    src.start(when);
  }

  private snare(when: number) {
    this.noiseHit(when, 0.16, "bandpass", 1800, 0.35);
  }

  private hat(when: number) {
    this.noiseHit(when, 0.05, "highpass", 7000, 0.18);
  }

  startFishing() {
    this.chime(660, 0.06);
    if (this.ready && this.ctx) this.surf.g.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.6);
  }

  /** 快门声：短促高频噪声 + 细高音 */
  shutter() {
    if (!this.ready || !this.ctx) return;
    this.noiseHit(this.ctx.currentTime, 0.05, "highpass", 3200, 0.22);
    this.chime(1320, 0.12);
  }

  /** 拾取光尘：上行双音 */
  pickup() {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.chime(880, 0.18);
    setTimeout(() => this.chime(1174.7, 0.3), 90);
    void t;
  }

  stopFishing() {
    if (this.ready && this.ctx) this.surf.g.gain.setTargetAtTime(0.12, this.ctx.currentTime, 1.2);
  }

  startCamp() {
    if (this.ready && this.ctx) this.fire.g.gain.setTargetAtTime(0.16, this.ctx.currentTime, 1.4);
  }

  stopCamp() {
    if (this.ready && this.ctx) this.fire.g.gain.setTargetAtTime(0, this.ctx.currentTime, 1.2);
  }

  chime(freq = 520, dur = 0.35) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(this.sfxGain);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
