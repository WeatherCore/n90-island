import type { DriveInput } from "./driving";

export interface EdgeState {
  pressed: boolean;
  released: boolean;
  held: boolean;
}

/**
 * 输入抽象层：键盘现在是唯一后端，但 press/release 是公开 API，
 * 二期接入触屏虚拟按键时直接调用同一入口，不触碰游戏逻辑。
 */
export class Input {
  private keys = new Set<string>();
  drive: DriveInput = { up: false, down: false, left: false, right: false, brake: false };
  /** 空格 / E 的边沿状态（旧版 Lv） */
  action: EdgeState = { pressed: false, released: false, held: false };

  press(code: string) {
    if (this.keys.has(code)) return; // 与旧版 g.repeat 语义一致：按住不重复触发边沿
    this.keys.add(code);
    if (code === "Space" || code === "KeyE") {
      this.action.pressed = true;
      this.action.held = true;
    }
  }

  release(code: string) {
    this.keys.delete(code);
    if (code === "Space" || code === "KeyE") {
      this.action.released = true;
      this.action.held = false;
    }
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  blur() {
    this.keys.clear();
    this.action.held = false;
  }

  /** 每帧开始时汇总体感输入（旧版 F6 的键盘部分） */
  pollDrive() {
    this.drive.up = this.isDown("KeyW") || this.isDown("ArrowUp");
    this.drive.down = this.isDown("KeyS") || this.isDown("ArrowDown");
    this.drive.left = this.isDown("KeyA") || this.isDown("ArrowLeft");
    this.drive.right = this.isDown("KeyD") || this.isDown("ArrowRight");
    this.drive.brake = this.isDown("Space");
  }

  /** 小游戏接管时清空行驶输入并回收速度 */
  clearDrive(driving: { speed: number }) {
    this.drive.up = this.drive.down = this.drive.left = this.drive.right = this.drive.brake = false;
    driving.speed *= 0.9;
  }

  consumeAction(): EdgeState {
    const snapshot = { ...this.action };
    this.action.pressed = false;
    this.action.released = false;
    return snapshot;
  }
}
