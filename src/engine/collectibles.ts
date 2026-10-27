import {
  AdditiveBlending,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  CylinderGeometry,
  DoubleSide,
  Vector3,
  type Scene,
} from "three";
import { roadRadiusAt } from "./terrain";
import { makeRng } from "./mathx";
import type { Terrain } from "./terrain";
import type { UiBridge } from "../state/store";
import type { AudioEngine } from "./audio";

export const MOTE_TOTAL = 12;

interface Mote {
  id: string;
  group: Group;
  core: Mesh;
  halo: Mesh;
  baseY: number;
  taken: boolean;
  animT: number; // 拾取动画进度（-1 未拾取）
}

/**
 * 光尘：种子化散布在环岛公路两侧的 12 枚发光体，驾车靠近自动拾取。
 * 位置由固定种子决定，存档记录已拾取 id。
 */
export class Collectibles {
  readonly group = new Group();
  collected = 0;
  private motes: Mote[] = [];

  constructor(
    scene: Scene,
    terrain: Terrain,
    private ui: UiBridge,
    private audio: AudioEngine,
    private onCollect: (id: string, count: number) => void,
    preCollected: string[],
  ) {
    scene.add(this.group);
    const rng = makeRng(9026);
    for (let i = 0; i < MOTE_TOTAL; i++) {
      const theta = (i / MOTE_TOTAL) * Math.PI * 2 + 0.26;
      let radius = roadRadiusAt(theta) + (rng() * 210 - 90);
      let h = terrain.sampleHF(Math.cos(theta) * radius, Math.sin(theta) * radius);
      let tries = 0;
      while (h < 1.5 && tries < 24) {
        radius -= 15;
        h = terrain.sampleHF(Math.cos(theta) * radius, Math.sin(theta) * radius);
        tries++;
      }
      if (h < 1.5) continue;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const baseY = h + 1.25;

      const g = new Group();
      g.position.set(x, baseY, z);

      const core = new Mesh(
        new IcosahedronGeometry(0.42, 1),
        new MeshBasicMaterial({ color: 16764818 }),
      );
      g.add(core);

      const halo = new Mesh(
        new SphereGeometry(1.05, 12, 10),
        new MeshBasicMaterial({
          color: 16764818,
          transparent: true,
          opacity: 0.16,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      g.add(halo);

      // 远处可见的细光柱
      const pillar = new Mesh(
        new CylinderGeometry(0.08, 0.3, 18, 6, 1, true),
        new MeshBasicMaterial({
          color: 16764818,
          transparent: true,
          opacity: 0.06,
          side: DoubleSide,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      pillar.position.y = 9;
      g.add(pillar);

      this.group.add(g);
      const id = "m" + i;
      const taken = preCollected.includes(id);
      if (taken) g.visible = false;
      else this.collected++;
      this.motes.push({ id, group: g, core, halo, baseY, taken, animT: -1 });
    }
    this.motes.forEach((m) => {
      if (m.taken) this.collected++;
    });
    this.collected = MOTE_TOTAL - this.motes.filter((m) => !m.taken).length;
  }

  get takenCount(): number {
    return this.motes.filter((m) => m.taken).length;
  }

  takenIds(): string[] {
    return this.motes.filter((m) => m.taken).map((m) => m.id);
  }

  /** 存档恢复：把已收集的隐藏掉 */
  markCollected(ids: string[]) {
    for (const m of this.motes) {
      if (ids.includes(m.id) && !m.taken) {
        m.taken = true;
        m.group.visible = false;
      }
    }
  }

  update(dt: number, elapsed: number, carPos: Vector3) {
    for (const m of this.motes) {
      if (m.taken && m.animT < 0) continue;
      if (m.animT >= 0) {
        // 拾取动画：放大 + 上浮 + 淡出
        m.animT += dt;
        const t = Math.min(1, m.animT / 0.6);
        m.group.scale.setScalar(1 + t * 1.6);
        m.group.position.y = m.baseY + t * 3.2;
        (m.halo.material as MeshBasicMaterial).opacity = 0.16 * (1 - t);
        (m.core.material as MeshBasicMaterial).transparent = true;
        (m.core.material as MeshBasicMaterial).opacity = 1 - t;
        if (t >= 1) {
          m.group.visible = false;
          m.animT = -1;
        }
        continue;
      }
      m.group.position.y = m.baseY + Math.sin(elapsed * 1.3 + m.baseY) * 0.3;
      m.core.rotation.y = elapsed * 0.9;
      m.core.rotation.x = elapsed * 0.4;
      const pulse = 1 + Math.sin(elapsed * 2.2 + m.baseY * 3) * 0.12;
      m.halo.scale.setScalar(pulse);

      const d = Math.hypot(carPos.x - m.group.position.x, carPos.z - m.group.position.z);
      if (d < 7) this.take(m);
    }
  }

  private take(m: Mote) {
    m.taken = true;
    m.animT = 0;
    this.audio.pickup();
    const n = this.takenCount;
    if (n >= MOTE_TOTAL) {
      this.ui.toast(`第 ${n} 枚光尘 · 全部收集完毕！`);
    } else {
      this.ui.toast(`拾获光尘 · ${n} / ${MOTE_TOTAL}`);
    }
    this.onCollect(m.id, n);
  }
}
