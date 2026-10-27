import { MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3, type Object3D, type WebGLRenderer } from "three";
import type { Car } from "./car";
import type { Driving } from "./driving";
import type { UiBridge } from "../state/store";

/**
 * 车辆检视控制器：轨道相机 / 机位切换 / 点击拾取车门后备箱车顶帐篷。
 * DOM 面板由 React 层负责，这里只持有相机与拾取逻辑（旧版 KB 的无 DOM 部分）。
 */
export class InspectController {
  active = false;
  view = "orbit";
  private theta = -0.9;
  private phi = 1.15;
  private radius = 8.6;
  private target = new Vector3();
  private pointer = { down: false, x: 0, y: 0, moved: 0 };
  private raycaster = new Raycaster();
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private car: Car;
  private driving: Driving;
  private ui: UiBridge;
  private onStateChange: () => void;
  private onExit: () => void;

  constructor(
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    car: Car,
    driving: Driving,
    ui: UiBridge,
    onStateChange: () => void,
    onExit: () => void,
  ) {
    this.camera = camera;
    this.renderer = renderer;
    this.car = car;
    this.driving = driving;
    this.ui = ui;
    this.onStateChange = onStateChange;
    this.onExit = onExit;
  }

  private placeCamera() {
    const { theta, phi, radius, target, camera } = this;
    camera.position.set(
      target.x + Math.sin(phi) * Math.cos(theta) * radius,
      target.y + Math.cos(phi) * radius,
      target.z + Math.sin(phi) * Math.sin(theta) * radius,
    );
    camera.lookAt(target);
  }

  setView(view: string) {
    this.view = view;
    if (view !== "orbit") {
      this.camera.fov = 68;
      this.camera.near = 0.05;
    } else {
      this.camera.fov = 42;
      this.camera.near = 0.1;
    }
    this.camera.updateProjectionMatrix();
    this.onStateChange();
  }

  enter() {
    if (this.active) return;
    this.active = true;
    this.driving.speed = 0;
    this.target.copy(this.car.root.position);
    this.target.y += 1.05;
    this.setView("orbit");
    this.placeCamera();
    this.onStateChange();
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.camera.fov = 54;
    this.camera.near = 0.2;
    this.camera.updateProjectionMatrix();
    this.onExit();
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  action(kind: "doors" | "trunk" | "tent" | "all") {
    const car = this.car;
    if (kind === "doors") {
      const anyOpen = Object.entries(car.doorState).some(([name, state]) => name !== "trunk" && state.target > 0.5);
      car.setDoors(!anyOpen);
    } else if (kind === "trunk") {
      car.setTrunk(!((car.doorState.trunk?.target ?? 0) > 0.5));
    } else if (kind === "tent") {
      car.setTent(!car.tentOpen);
    } else if (kind === "all") {
      const allOpen = car.tentOpen && Object.values(car.doorState).every((s) => s.target > 0.5);
      car.setDoors(!allOpen);
      car.setTrunk(!allOpen);
      car.setTent(!allOpen);
    }
    this.onStateChange();
  }

  setPaint(index: number) {
    this.car.setPaint(index);
    this.ui.toast(this.car.paintName);
    this.onStateChange();
  }

  /** 指针拖拽（仅在 orbit 视角生效），由 React 层转发 */
  drag(dx: number, dy: number) {
    if (!this.active) return;
    this.pointer.moved += Math.abs(dx) + Math.abs(dy);
    if (this.view === "orbit") {
      this.theta += dx * 0.006;
      this.phi = MathUtils.clamp(this.phi - dy * 0.005, 0.35, 1.48);
      this.placeCamera();
    }
  }

  pointerDown(x: number, y: number) {
    if (!this.active) return;
    this.pointer.down = true;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.moved = 0;
  }

  pointerUp(x: number, y: number) {
    if (!this.active || !this.pointer.down) return;
    this.pointer.down = false;
    if (this.pointer.moved < 6 && this.view === "orbit") this.pick(x, y);
  }

  wheel(deltaY: number) {
    if (!this.active || this.view !== "orbit") return;
    this.radius = MathUtils.clamp(this.radius + deltaY * 0.01, 4.2, 22);
    this.placeCamera();
  }

  private pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.car.model, true);
    if (!hits.length) return;
    let node: Object3D | null = hits[0].object;
    while (node && node !== this.car.model) {
      const ud = (node as any).userData ?? {};
      if (ud.door) {
        this.car.toggleDoor(ud.door);
        this.onStateChange();
        return;
      }
      if (ud.trunk) {
        this.car.setTrunk(!((this.car.doorState.trunk?.target ?? 0) > 0.5));
        this.onStateChange();
        return;
      }
      if (ud.tent) {
        this.car.setTent(!this.car.tentOpen);
        this.onStateChange();
        return;
      }
      node = node.parent;
    }
  }

  update(_dt: number) {
    if (!this.active) return;
    this.target.copy(this.car.root.position);
    this.target.y += 1.05;
    if (this.view === "orbit") {
      this.placeCamera();
      return;
    }
    const seat = this.car.seatFor(this.view);
    seat.getWorldPosition(this.camera.position);
    seat.getWorldQuaternion(this.camera.quaternion);
    this.camera.rotateX(this.view === "driver" ? -0.06 : -0.08);
  }

  /** 面板按钮状态（旧版 refresh 的数据部分） */
  snapshot() {
    const car = this.car;
    const doorsOpenCount = Object.values(car.doorState ?? {}).filter((s) => s.target > 0.5).length;
    return {
      doorsOn: doorsOpenCount > 0,
      doorsLabel: doorsOpenCount ? "已打开" : "关闭",
      trunkOn: (car.doorState?.trunk?.target ?? 0) > 0.5,
      trunkLabel: (car.doorState?.trunk?.target ?? 0) > 0.5 ? "已打开" : "关闭",
      tentOn: car.tentOpen,
      tentLabel: car.tentOpen ? "已展开" : "已收起",
      view: this.view,
    };
  }
}
