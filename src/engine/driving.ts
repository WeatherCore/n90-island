import { MathUtils, Quaternion, Vector3 } from "three";
import type { Car } from "./car";
import type { Road } from "./road";
import type { Terrain } from "./terrain";

export interface DriveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

export const UP = new Vector3(0, 1, 0);

/** 简化车辆动力学（旧版 YB，公式与常量原样移植） */
export class Driving {
  pos = new Vector3();
  vel = new Vector3();
  yaw = 0;
  speed = 0;
  steer = 0;
  slip = 0;
  pitch = 0;
  roll = 0;
  onRoad = true;
  roadDist = 0;
  odometer = 0;
  wheelSpin = 0;
  lateral = 0;

  constructor(
    public car: Car,
    private terrain: Terrain,
    private road: Road,
  ) {
    this.placeAtRoad(0);
  }

  /** 路上第 i 点、横向偏移 P 处落车（旧版 placeAtRoad） */
  placeAtRoad(index: number, lateral = 0) {
    const road = this.road;
    const i = ((index % road.n) + road.n) % road.n;
    const tx = road.tan[i * 2];
    const tz = road.tan[i * 2 + 1];
    const nx = tz;
    const nz = -tx;
    const x = road.x[i] + nx * lateral;
    const z = road.z[i] + nz * lateral;
    this.pos.set(x, this.terrain.sampleHF(x, z) + 0.09, z);
    this.yaw = Math.atan2(-tx, -tz);
    this.speed = 0;
    this.steer = 0;
    this.syncModel(0.016);
  }

  get forward(): Vector3 {
    return new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt: number, input: DriveInput) {
    const terrain = this.terrain;
    const roadInfo = this.road.info(this.pos.x, this.pos.z);
    this.roadDist = roadInfo.dist;
    const onRoad = roadInfo.dist < 8.5;
    this.onRoad = onRoad;
    const vmax = onRoad ? 46 : 17;
    const accel = onRoad ? 13 : 7;
    const throttle = input.up ? 1 : 0;
    const reverse = input.down ? 1 : 0;
    if (throttle) this.speed += accel * dt * Math.pow(Math.max(0, 1 - this.speed / vmax), 0.7);
    if (reverse) this.speed -= (onRoad ? 24 : 11) * dt;
    if (!throttle && !reverse) this.speed *= Math.exp(-dt * (onRoad ? 0.35 : 1));
    this.speed -= this.speed * Math.abs(this.speed) * 32e-5 * dt;
    this.speed = MathUtils.clamp(this.speed, -7, vmax + 3);

    const spd = Math.abs(this.speed);
    const steerMax = 0.62 * (1 - Math.min(0.58, spd / 58));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const targetSteer = steerInput * steerMax;
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 9);

    const handbrake = input.brake && spd > 4;
    const grip = (onRoad ? 1 : 0.68) * (handbrake ? 0.55 : 1);
    let yawRate = (this.speed / 3.05) * Math.tan(this.steer) * grip;
    if (handbrake) yawRate *= 1.55;
    this.yaw += yawRate * dt;

    const slipTarget = handbrake ? yawRate * Math.abs(this.speed) * 0.16 : yawRate * Math.abs(this.speed) * 0.045;
    this.slip += (slipTarget - this.slip) * Math.min(1, dt * 5.5);
    if (!handbrake) this.slip *= Math.exp(-dt * 2.4);

    const fwd = this.forward;
    const cosY = Math.cos(this.yaw);
    const sinY = -Math.sin(this.yaw);
    this.pos.x += (fwd.x * this.speed + cosY * this.slip) * dt;
    this.pos.z += (fwd.z * this.speed + sinY * this.slip) * dt;
    this.odometer += Math.abs(this.speed) * dt;
    this.lateral = this.slip;

    // 四轮高度采样 → 俯仰/侧倾
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const sample = (f: number, s: number) =>
      terrain.sampleHF(this.pos.x + fwdX * f + cosY * s, this.pos.z + fwdZ * f + sinY * s);
    const hFL = sample(1.55, -0.8);
    const hFR = sample(1.55, 0.8);
    const hRL = sample(-1.5, -0.8);
    const hRR = sample(-1.5, 0.8);
    const front = (hFL + hFR) * 0.5;
    const rear = (hRL + hRR) * 0.5;
    const left = (hFL + hRL) * 0.5;
    const right = (hFR + hRR) * 0.5;
    const targetPitch = Math.atan2(front - rear, 3.05);
    const targetRoll = Math.atan2(right - left, 1.6);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 8);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8);

    const targetY = (front + rear) * 0.5 + (onRoad ? 0.075 : 0.015);
    this.pos.y += (targetY - this.pos.y) * Math.min(1, dt * 12);
    if (targetY < 0.3) this.speed *= Math.exp(-dt * 3); // 落水减速
    this.syncModel(dt, yawRate);
  }

  syncModel(dt: number, _yawRate = 0) {
    const root = this.car.root;
    root.position.copy(this.pos);
    const qYaw = new Quaternion().setFromAxisAngle(UP, this.yaw);
    const qPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.pitch);
    const qRoll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), this.roll);
    root.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);
    this.car.update(dt, this.speed);
  }
}
