import { Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, type Scene } from "three";
import { SITES } from "./config";
import type { Driving } from "./driving";
import type { AudioEngine } from "./audio";
import type { Sky } from "./sky";
import type { Terrain } from "./terrain";
import { buildBeacon, buildGate } from "./structures";
import type { EdgeState } from "./input";
import type { UiBridge } from "../state/store";
import type { TimeTrial } from "./trial";

export const QUEST_IDS = ["fish", "camp", "offroad", "trial", "lap", "motes", "photo"] as const;

interface SiteDef {
  id: "fish" | "camp" | "offroad" | "trial";
  name: string;
  key: string;
  x: number;
  z: number;
  r: number;
  title: string;
  desc: string;
}

interface FishState {
  phase: "ready" | "cast" | "bite" | "reel";
  power: number;
  dir: number;
  waited: number;
  biteT: number;
  reel: number;
  tension: number;
}

interface Gate {
  mesh: Group;
  pos: Vector3;
  passed: boolean;
}

const clamp01 = (v: number, lo = 0, hi = 1.2) => Math.max(lo, Math.min(hi, v));

/** 交互活动总控（旧版 JB：码头海钓 / 草地露营 / 林间越野） */
export class Activities {
  active: string | null = null;
  state: "fish" | "camp" | "offroad" | null = null;
  timer = 0;
  fish: FishState | null = null;
  journal = new Set<string>();
  input: EdgeState = { pressed: false, released: false, held: false };
  fireBoost = 1;
  targetTime = 18.4;
  offroad: { t: number; passed: number } | null = null;
  private sites: SiteDef[];
  private beacons = new Group();
  private gates: Gate[] = [];
  private lastPrompt = "";
  private camPos = new Vector3();
  private camLook = new Vector3();
  private campT = 0;
  private started = false;
  /** 供 UI 面板实时读取 */
  campDone = new Set<string>();
  /** 环岛计时赛（Game 构造后注入） */
  timeTrial: TimeTrial | null = null;
  private celebrated3 = false;
  private celebratedAll = false;

  constructor(
    private scene: Scene,
    private terrain: Terrain,
    public driving: Driving,
    private ui: UiBridge,
    private sky: Sky,
    private camera: PerspectiveCamera,
    private audio: AudioEngine | null,
    private onSaveJournal: (id: string) => void,
  ) {
    this.sites = [
      {
        id: "fish",
        name: "码头海钓体验",
        key: "E",
        x: SITES.DOCK.x + 6,
        z: SITES.DOCK.z,
        r: 26,
        title: "码头 · 海钓",
        desc: "把车停在海边，听潮水拍打木桩。",
      },
      {
        id: "camp",
        name: "草地露营体验",
        key: "E",
        x: SITES.CAMP.x + 8,
        z: SITES.CAMP.z + 3,
        r: 24,
        title: "草地 · 露营",
        desc: "篝火、帐篷与渐暗的天色。",
      },
      {
        id: "offroad",
        name: "轻度越野体验",
        key: "E",
        x: -58,
        z: 262,
        r: 22,
        title: "林间 · 越野",
        desc: "离开柏油路，穿过五道林间门。",
      },
      {
        id: "trial",
        name: "环岛计时赛",
        key: "E",
        x: 0, // 由 timeTrial 注入后校正
        z: 0,
        r: 24,
        title: "环岛 · 计时赛",
        desc: "穿五道光门，跑完整圈环岛。",
      },
    ];
    this.buildMarkers();
  }

  /** 计时赛入口位置回填（TimeTrial 先于 Activities 构造完成后调用） */
  attachTrial(timeTrial: TimeTrial) {
    this.timeTrial = timeTrial;
    const site = this.sites.find((s) => s.id === "trial")!;
    site.x = timeTrial.sitePos.x;
    site.z = timeTrial.sitePos.z;
    this.buildTrialBeacon();
  }

  private buildTrialBeacon() {
    if (!this.timeTrial) return;
    const pos = this.timeTrial.sitePos;
    const beacon = buildBeacon();
    beacon.position.copy(pos);
    this.beacons.add(beacon);
  }

  private buildMarkers() {
    this.scene.add(this.beacons);
    for (const site of this.sites) {
      const y = this.terrain.sampleHF(site.x, site.z);
      const beacon = buildBeacon();
      beacon.position.set(site.x, y, site.z);
      this.beacons.add(beacon);
    }
    const gatePositions: Array<[number, number]> = [
      [-30, 250],
      [-104, 226],
      [-168, 192],
      [-214, 142],
      [-196, 84],
    ];
    for (const [gx, gz] of gatePositions) {
      const gy = this.terrain.sampleHF(gx, gz);
      const mesh = buildGate();
      mesh.position.set(gx, gy, gz);
      this.scene.add(mesh);
      this.gates.push({ mesh, pos: new Vector3(gx, gy, gz), passed: false });
    }
  }

  get nearSite(): SiteDef | null {
    if (this.active) return null;
    let best: SiteDef | null = null;
    let bestDist = 1e9;
    for (const site of this.sites) {
      const d = Math.hypot(this.driving.pos.x - site.x, this.driving.pos.z - site.z);
      if (d < site.r && d < bestDist) {
        best = site;
        bestDist = d;
      }
    }
    return best;
  }

  update(dt: number, elapsed: number) {
    const driving = this.driving;
    const site = this.nearSite;
    if (site && Math.abs(driving.speed) < 4) {
      const key = site.key + site.name;
      if (this.lastPrompt !== key) {
        this.ui.showPrompt(`按 E 开始${site.name}`);
        this.lastPrompt = key;
      }
    } else if (!this.active) {
      this.ui.hidePrompt();
      this.lastPrompt = "";
    }
    for (const beacon of this.beacons.children) {
      beacon.rotation.y = elapsed * 0.4;
      const ring = (beacon.userData as { ring?: Mesh }).ring;
      if (ring) {
        (ring.material as MeshBasicMaterial).opacity = 0.55 + Math.sin(elapsed * 2.4) * 0.2;
      }
      const beam = beacon.children[1] as Mesh | undefined;
      if (beam) {
        const d = Math.hypot(beacon.position.x - driving.pos.x, beacon.position.z - driving.pos.z);
        (beam.material as MeshBasicMaterial).opacity = MathUtils.clamp((d - 18) / 70, 0, 1) * 0.07;
      }
    }
    for (const gate of this.gates) {
      if (gate.mesh.visible) gate.mesh.rotation.z = Math.sin(elapsed * 2) * 0.05;
    }
    if (this.state === "fish") this.updateFish(dt);
    else if (this.state === "camp") this.updateCamp(dt);
    else if (this.state === "offroad") this.updateOffroad(dt);
  }

  interact() {
    if (this.active) return;
    const site = this.nearSite;
    if (!site) return;
    if (site.id === "fish") this.startFish();
    else if (site.id === "camp") this.startCamp();
    else if (site.id === "offroad") this.startOffroad();
    else if (site.id === "trial") {
      this.timeTrial?.start();
      if (this.timeTrial?.state === "running") this.active = "trial";
    }
  }

  startFish() {
    this.active = "fish";
    this.state = "fish";
    this.timer = 0;
    this.fish = { phase: "ready", power: 0, dir: 1, waited: 0, biteT: 0, reel: 0, tension: 0.45 };
    this.ui.hidePrompt();
    this.ui.cinematic(true);
    const dock = SITES.DOCK;
    this.camPos.set(dock.x + 30, 6.5, dock.z + 12);
    this.camLook.set(dock.x + 46, 1.5, dock.z + 2);
    this.cameraOverride = (dt) => {
      this.camera.position.lerp(this.camPos, 1 - Math.exp(-dt * 2.2));
      this.camera.lookAt(this.camLook);
      this.camera.fov += (44 - this.camera.fov) * Math.min(1, dt * 2);
      this.camera.updateProjectionMatrix();
    };
    this.audio?.startFishing();
    this.ui.showPanel({ kind: "fish" });
  }

  cameraOverride: ((dt: number) => void) | null = null;

  updateFish(dt: number) {
    const fish = this.fish;
    if (!fish) return;
    const input = this.input;
    if (fish.phase === "ready") {
      fish.power += fish.dir * dt * 1.5;
      if (fish.power > 1) {
        fish.power = 1;
        fish.dir = -1;
      }
      if (fish.power < 0) {
        fish.power = 0;
        fish.dir = 1;
      }
      if (input.released) {
        if (fish.power > 0.35 && fish.power < 0.9) {
          fish.phase = "cast";
          this.timer = 0;
        } else {
          this.ui.toast("抛竿力度不合适，再试一次");
          fish.power = 0;
          fish.dir = 1;
        }
      }
    } else if (fish.phase === "cast") {
      this.timer += dt;
      if (this.timer > 2.4) {
        fish.phase = "bite";
        fish.biteT = 0;
      }
    } else if (fish.phase === "bite") {
      fish.biteT += dt;
      if (input.pressed) {
        fish.phase = "reel";
        fish.reel = 0.05;
        fish.tension = 0.35;
      } else if (fish.biteT > 1.15) {
        this.endFish(false, "鱼跑掉了…");
        return;
      }
    } else if (fish.phase === "reel") {
      const held = input.held;
      fish.tension = clamp01(fish.tension + (held ? 0.55 : -0.75) * dt + (Math.random() - 0.5) * 0.02);
      fish.reel = Math.max(0, Math.min(1, fish.reel + (held && fish.tension < 0.95 ? 0.28 : 0.02) * dt));
      if (fish.tension > 1.05) {
        this.endFish(false, "线断了…");
        return;
      }
      if (fish.reel >= 1) {
        this.endFish(true, "一尾黑鲈");
        return;
      }
    }
  }

  endFish(success: boolean, message: string) {
    this.state = null;
    this.fish = null;
    this.ui.hidePanel();
    this.ui.cinematic(false);
    this.cameraOverride = null;
    this.active = null;
    this.audio?.stopFishing();
    if (success) {
      this.ui.toast("海钓成功 · " + message);
      this.ui.setMission("环岛之旅", "码头海钓已完成。沿着环岛公路继续前行。");
    } else {
      this.ui.toast(message);
    }
    this.reward(success ? "fish" : null);
    this.driving.speed = 0;
  }

  startCamp() {
    this.active = "camp";
    this.state = "camp";
    this.timer = 0;
    this.ui.hidePrompt();
    this.ui.cinematic(true);
    const camp = SITES.CAMP;
    this.campT = 0;
    this.cameraOverride = (dt) => {
      this.campT += dt;
      const angle = this.campT * 0.13;
      this.camera.position.set(
        camp.x + 8 + Math.cos(angle) * 6.5,
        this.terrain.sampleHF(camp.x, camp.z) + 2.6,
        camp.z + 12 + Math.sin(angle) * 6.5,
      );
      this.camera.lookAt(camp.x + 4, this.terrain.sampleHF(camp.x, camp.z) + 1.1, camp.z + 3);
      this.camera.fov += (40 - this.camera.fov) * Math.min(1, dt * 2);
      this.camera.updateProjectionMatrix();
    };
    this.campDone = new Set();
    this.ui.showPanel({ kind: "camp" });
    this.audio?.startCamp();
    this.fireBoost = 1;
    this.targetTime = 18.4;
  }

  campAction(n: number) {
    if (this.state !== "camp") return;
    const action = n === 1 ? "fire" : n === 2 ? "coffee" : "stars";
    if (this.campDone.has(action)) {
      this.ui.toast("已经做过了");
      return;
    }
    this.campDone.add(action);
    if (action === "fire") {
      this.fireBoost = 2.4;
      this.targetTime = Math.max(this.targetTime ?? 18.4, 19.2);
      this.ui.toast("篝火升起来了");
      this.audio?.chime(420, 0.5);
    } else if (action === "coffee") {
      this.ui.toast("咖啡的香气混着松木味");
      this.audio?.chime(560, 0.4);
    } else {
      this.sky.setTime(20.6);
      this.targetTime = 20.6;
      this.ui.toast("银河从山脊后面漫上来");
      this.audio?.chime(760, 0.8);
    }
    this.ui.showPanel({ kind: "camp" });
    if (this.campDone.size >= 3) this.timer = Math.max(this.timer, 6.4);
  }

  updateCamp(dt: number) {
    this.timer += dt;
    if (this.sky.time < this.targetTime && !this.campDone.has("stars")) {
      this.sky.setTime(Math.min(this.targetTime, this.sky.time + dt * 0.35));
    }
    if (this.campDone.size >= 3 && this.timer > 10) this.endCamp();
  }

  endCamp() {
    if (!this.active) return;
    this.state = null;
    this.active = null;
    this.cameraOverride = null;
    this.ui.hidePanel();
    this.ui.cinematic(false);
    this.audio?.stopCamp();
    this.ui.toast("露营体验完成 · 星空已升起");
    this.ui.setMission("环岛之旅", "营地归你。沿公路继续探索。");
    this.reward("camp");
  }

  startOffroad() {
    this.active = "offroad";
    this.state = "offroad";
    this.timer = 0;
    this.ui.hidePrompt();
    this.offroad = { t: 0, passed: 0 };
    for (const gate of this.gates) {
      gate.passed = false;
      gate.mesh.visible = true;
    }
    this.ui.setMission("轻度越野", "穿过五道林间门 · 计时开始");
    this.ui.showPanel({ kind: "offroad" });
  }

  beginOffroadRun() {
    this.ui.hidePanel();
    this.started = true;
    this.ui.toast("出发！");
  }

  private updateOffroad(dt: number) {
    if (!this.started || !this.offroad) return;
    this.offroad.t += dt;
    const pos = this.driving.pos;
    for (const gate of this.gates) {
      if (gate.passed) continue;
      if (Math.hypot(pos.x - gate.pos.x, pos.z - gate.pos.z) < 8.5) {
        gate.passed = true;
        this.offroad.passed++;
        gate.mesh.visible = false;
        this.audio?.chime();
        this.ui.toast(`通过第 ${this.offroad.passed} 道门 · ${this.offroad.t.toFixed(1)}s`);
        if (this.offroad.passed >= this.gates.length) this.endOffroad(true);
      }
    }
    this.ui.setLap(this.offroad.t.toFixed(1) + "s");
  }

  endOffroad(success: boolean) {
    this.state = null;
    this.active = null;
    this.started = false;
    this.ui.hidePanel();
    if (success && this.offroad) {
      this.ui.toast("越野完成 · 用时 " + this.offroad.t.toFixed(1) + " 秒");
      this.ui.setMission("环岛之旅", "越野小径已留下车辙。");
      this.reward("offroad");
    }
    for (const gate of this.gates) gate.mesh.visible = false;
  }

  reward(id: string | null) {
    if (!id) return;
    this.journal.add(id);
    this.onSaveJournal(id);
    if (!this.celebrated3 && ["fish", "camp", "offroad"].every((x) => this.journal.has(x))) {
      this.celebrated3 = true;
      setTimeout(() => this.ui.toast("三处体验全部完成 · 环岛之旅圆满"), 1600);
      this.ui.setMission("旅程完成", "码头、营地、林间小径 —— 这座岛已经记住你。");
    }
    if (!this.celebratedAll && (QUEST_IDS as readonly string[]).every((x) => this.journal.has(x))) {
      this.celebratedAll = true;
      setTimeout(() => this.ui.toast("七项皆成 · 这座岛已经记住你的名字"), 2600);
      this.ui.setMission("岛屿传说", "光尘、快门与圈速 —— 全部收入册中。");
    }
  }

  /** 存档恢复后同步庆祝标记（不触发 toast） */
  syncCelebrations() {
    if (["fish", "camp", "offroad"].every((x) => this.journal.has(x))) this.celebrated3 = true;
    if ((QUEST_IDS as readonly string[]).every((x) => this.journal.has(x))) this.celebratedAll = true;
  }

  handleKey(code: string) {
    if (this.state === "offroad" && !this.started && code === "KeyE") this.beginOffroadRun();
  }

  endAll() {
    if (this.state === "camp") this.endCamp();
    else if (this.state === "offroad") this.endOffroad(false);
    else if (this.state === "fish") this.endFish(false, "结束了海钓");
    else if (this.active === "trial") {
      this.timeTrial?.quit();
      this.active = null;
    }
  }
}
