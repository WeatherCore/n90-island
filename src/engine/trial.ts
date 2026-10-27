import { Group, Mesh, MeshBasicMaterial, TorusGeometry, Vector3, type Scene } from "three";
import type { Road } from "./road";
import type { Terrain } from "./terrain";
import type { Driving } from "./driving";
import type { UiBridge } from "../state/store";
import type { AudioEngine } from "./audio";
import { buildGate } from "./structures";

interface Gate {
  mesh: Group;
  pos: Vector3;
  passed: boolean;
  finish: boolean;
}

/**
 * 环岛计时赛：从起点信标出发，沿环岛公路穿过 5 道蓝门并冲回起点处的金色终点门，
 * 计时入册。中途按 E 或 Esc 退出。
 */
export class TimeTrial {
  state: "idle" | "running" = "idle";
  best: number | null = null;
  elapsed = 0;
  passed = 0;
  /** 起点信标（常驻，提示入口） */
  readonly beacon = new Group();
  private gates: Gate[] = [];
  private startIdx = 0;

  constructor(
    scene: Scene,
    private road: Road,
    terrain: Terrain,
    private driving: Driving,
    private ui: UiBridge,
    private audio: AudioEngine,
    private onFinish: (seconds: number, best: number | null) => void,
    private onQuit: () => void,
  ) {
    // 起点选在 θ≈2.0 对应路段（离三个站点都远）
    this.startIdx = road.nearest(Math.cos(2.0) * 452, Math.sin(2.0) * 452);
    const sx = road.x[this.startIdx];
    const sz = road.z[this.startIdx];
    this.beacon.position.set(sx + 9, terrain.sampleHF(sx + 9, sz + 9), sz + 9);
    scene.add(this.beacon);

    const ring = new Mesh(
      new TorusGeometry(2.6, 0.08, 8, 40),
      new MeshBasicMaterial({ color: 16766874, transparent: true, opacity: 0.75 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.4;
    this.beacon.add(ring);
    this.beacon.userData.ring = ring;

    // 5 道中途门（青）+ 终点门（金，回到起点，即 startIdx + 900 ≡ startIdx）
    for (const off of [150, 300, 450, 600, 750]) this.makeGate(this.startIdx + off, false);
    this.makeGate(this.startIdx + 900, true);
    for (const g of this.gates) {
      g.mesh.visible = false;
      scene.add(g.mesh);
    }
  }

  private makeGate(index: number, finish: boolean) {
    const i = ((index % this.road.n) + this.road.n) % this.road.n;
    const mesh = buildGate(
      finish ? 16761975 : 4918975,
      finish ? 16751932 : 3519398,
    );
    mesh.position.set(this.road.x[i], this.road.y[i], this.road.z[i]);
    // 拱面垂直于路面行进方向
    const tx = this.road.tan[i * 2];
    const tz = this.road.tan[i * 2 + 1];
    mesh.rotation.y = Math.atan2(tx, tz);
    this.gates.push({
      mesh,
      pos: new Vector3(this.road.x[i], this.road.y[i], this.road.z[i]),
      passed: false,
      finish,
    });
  }

  get sitePos(): Vector3 {
    return this.beacon.position;
  }

  start() {
    if (this.state === "running") return;
    this.state = "running";
    this.elapsed = 0;
    this.passed = 0;
    for (const g of this.gates) {
      g.passed = false;
      g.mesh.visible = true;
    }
    this.ui.setMission("环岛计时赛", "穿过五道蓝门，冲过起点处的金色终点门。");
    this.ui.toast("计时赛开始！");
    this.audio.chime(784, 0.3);
  }

  update(dt: number) {
    if (this.state !== "running") return;
    this.elapsed += dt;
    const pos = this.driving.pos;
    for (const g of this.gates) {
      if (g.mesh.visible) g.mesh.rotation.z = Math.sin(this.elapsed * 2) * 0.05;
      if (g.passed) continue;
      if (Math.hypot(pos.x - g.pos.x, pos.z - g.pos.z) < 9) {
        g.passed = true;
        g.mesh.visible = false;
        this.audio.chime(g.finish ? 988 : 660, 0.2);
        if (g.finish) {
          this.finish();
          return;
        }
        this.passed++;
        this.ui.toast(`光门 ${this.passed} / 5 · ${this.elapsed.toFixed(1)}s`);
      }
    }
    this.ui.setLap(this.elapsed.toFixed(1) + "s");
  }

  /** 起点信标的常驻呼吸动画（不受 running 状态影响） */
  updateAmbient(elapsed: number) {
    this.beacon.rotation.y = elapsed * 0.4;
    const ring = this.beacon.userData.ring as Mesh | undefined;
    if (ring) {
      (ring.material as MeshBasicMaterial).opacity = 0.55 + Math.sin(elapsed * 2.4) * 0.2;
    }
  }

  private finish() {
    this.state = "idle";
    const t = this.elapsed;
    const isBest = this.best == null || t < this.best;
    if (isBest) this.best = t;
    this.ui.toast(`计时赛完成 · ${t.toFixed(1)} 秒${isBest ? "（新纪录）" : `（最佳 ${this.best!.toFixed(1)}）`}`);
    this.ui.setMission("环岛之旅", "计时赛已入册。公路仍归你。");
    for (const g of this.gates) g.mesh.visible = false;
    this.onFinish(t, this.best);
  }

  quit() {
    if (this.state !== "running") return;
    this.state = "idle";
    for (const g of this.gates) g.mesh.visible = false;
    this.ui.toast("计时赛已退出");
    this.ui.setMission("环岛之旅", "沿环岛公路继续前行。");
    this.onQuit();
  }
}
