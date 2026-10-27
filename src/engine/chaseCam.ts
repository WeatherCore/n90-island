import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { Terrain } from "./terrain";
import type { Driving } from "./driving";

/** 追击相机 + 开场环绕运镜（旧版 iB） */
export class ChaseCamera {
  pos = new Vector3();
  look = new Vector3();
  mode: "chase" | "intro" | "cockpit" = "chase";
  private tmp = new Vector3();

  constructor(
    private camera: PerspectiveCamera,
    private terrain: Terrain,
  ) {}

  snap(car: Driving) {
    const fwd = car.forward;
    this.pos
      .copy(car.pos)
      .addScaledVector(fwd, -7.9)
      .add(new Vector3(0, 2.55, 0));
    this.look
      .copy(car.pos)
      .addScaledVector(fwd, 4)
      .add(new Vector3(0, 1.2, 0));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  /** 开场环绕（旧版 intro），t 为累计时间 */
  intro(dt: number, car: Driving, t: number) {
    const angle = t * 0.22;
    const radius = 11;
    const target = new Vector3(
      car.pos.x + Math.cos(angle) * radius,
      car.pos.y + 2.6 + Math.sin(t * 0.3) * 0.5,
      car.pos.z + Math.sin(angle) * radius,
    );
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 2.2));
    this.camera.lookAt(car.pos.x, car.pos.y + 1, car.pos.z);
    this.camera.fov += (40 - this.camera.fov) * Math.min(1, dt * 2);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, car: Driving) {
    if (this.mode === "intro") return;
    const fwd = car.forward;
    const speedN = MathUtils.clamp(Math.abs(car.speed) / 34, 0, 1);
    const dist = 7.9 + speedN * 1.2;
    const height = 2.55 + speedN * 0.35;
    const target = this.tmp
      .copy(car.pos)
      .addScaledVector(fwd, -dist)
      .add(new Vector3(0, height, 0));
    const ground = this.terrain.sampleHF(target.x, target.z);
    if (target.y < ground + 1.1) target.y = ground + 1.1;
    const blend = 1 - Math.exp(-dt * 4.6);
    this.pos.lerp(target, blend);
    this.camera.position.copy(this.pos);
    const lookTarget = new Vector3()
      .copy(car.pos)
      .addScaledVector(fwd, 4.2)
      .add(new Vector3(0, 1.15, 0));
    this.look.lerp(lookTarget, 1 - Math.exp(-dt * 7));
    this.camera.lookAt(this.look);
    const fovTarget = 54 + speedN * 20;
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 2.4);
    this.camera.updateProjectionMatrix();
    // 手持感抖动
    const shake = speedN * 0.014 + (car.onRoad ? 0 : 0.004);
    this.camera.rotateZ((Math.random() - 0.5) * shake);
    this.camera.rotateX((Math.random() - 0.5) * shake * 0.6);
  }
}
