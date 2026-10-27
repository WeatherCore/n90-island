import {
  AnimationMixer,
  CanvasTexture,
  DoubleSide,
  Group,
  LoopOnce,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type AnimationAction,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { CAR_MATERIAL_RULES, INTERIOR_TEXTURES, PAINTS } from "./config";

/** 车漆法线贴图（canvas 噪声，旧版 o6） */
function makePaintNormalMap(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export interface DoorStateEntry {
  open: boolean;
  target: number;
}

export interface WheelEntry {
  pivot: Object3D;
  radius: number;
  spin: number;
}

/** N90 车辆模型：GLB 载入 + 材质归类 + 内饰贴图 + 车轮重组 + 开合动画（旧版 UB） */
export class Car {
  readonly root = new Group();
  readonly model = new Group();
  wheels: WheelEntry[] = [];
  paintMats: MeshPhysicalMaterial[] = [];
  mats: Record<string, MeshStandardMaterial | MeshPhysicalMaterial> = {};
  actions: Record<string, AnimationAction> = {};
  mixer: AnimationMixer | null = null;
  seat = new Object3D();
  seats: Record<string, Object3D> = {};
  doorState: Record<string, DoorStateEntry> = {};
  tentOpen = true;
  trunkOpen = false;
  doorsOpen = false;
  bounds = { min: [-2.64, 0, -1.12], max: [2.64, 1.9, 1.12] };
  ready = false;
  paintName = PAINTS[0].name;
  clipNames: string[] = [];
  groups: Record<string, Object3D | undefined> = {};

  constructor(scene: import("three").Scene) {
    this.model.rotation.y = -Math.PI / 2;
    this.root.add(this.model);
    scene.add(this.root);
    this.seat.position.set(0.3, 1.32, 0.18);
    this.root.add(this.seat);
    this.seats.driver = this.seat;
    for (const [name, pos] of [
      ["passenger", [-0.36, 1.3, 0.16]],
      ["rear", [0.25, 1.24, 1.05]],
    ] as const) {
      const anchor = new Object3D();
      anchor.position.set(pos[0], pos[1], pos[2]);
      this.root.add(anchor);
      this.seats[name] = anchor;
    }
    const interiorLight = new PointLight(16766632, 2.2, 4.5, 2);
    interiorLight.position.set(0.3, 1.55, 0.2);
    this.root.add(interiorLight);
    void this.load();
  }

  /** 按名称规则归类材质（旧版 material()） */
  material(kind: string): MeshStandardMaterial | MeshPhysicalMaterial {
    if (this.mats[kind]) return this.mats[kind];
    let mat: MeshStandardMaterial | MeshPhysicalMaterial;
    if (kind === "paint") {
      const paint = new MeshPhysicalMaterial({
        color: PAINTS[0].color,
        metalness: 0.5,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        normalMap: makePaintNormalMap(),
        normalScale: new Vector2(0.05, 0.05),
        envMapIntensity: 0.9,
      });
      this.paintMats.push(paint);
      mat = paint;
    } else if (kind === "glass") {
      mat = new MeshPhysicalMaterial({
        color: 659732,
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.7,
        side: DoubleSide,
        depthWrite: false,
      });
    } else if (kind === "rim") {
      mat = new MeshStandardMaterial({ color: 13225684, metalness: 1, roughness: 0.19 });
    } else if (kind === "chrome") {
      mat = new MeshStandardMaterial({ color: 14673128, metalness: 1, roughness: 0.08 });
    } else if (kind === "light") {
      mat = new MeshStandardMaterial({
        color: 16050902,
        metalness: 0,
        roughness: 0.22,
        emissive: 16770749,
        emissiveIntensity: 0.12,
      });
    } else if (kind === "leather") {
      mat = new MeshStandardMaterial({ color: 4863526, metalness: 0.04, roughness: 0.68 });
    } else if (kind === "tyre") {
      mat = new MeshStandardMaterial({ color: 1316378, roughness: 0.9 });
    } else if (kind === "brake") {
      mat = new MeshStandardMaterial({ color: 7040883, metalness: 0.85, roughness: 0.4 });
    } else if (kind === "caliper") {
      mat = new MeshStandardMaterial({ color: 9383213, metalness: 0.4, roughness: 0.35 });
    } else if (kind === "glossBlack") {
      mat = new MeshStandardMaterial({ color: 658189, metalness: 0.1, roughness: 0.18 });
    } else if (kind === "matteBlack") {
      mat = new MeshStandardMaterial({ color: 1711135, roughness: 0.7 });
    } else if (kind === "silver") {
      mat = new MeshStandardMaterial({ color: 12567753, metalness: 0.85, roughness: 0.3 });
    } else if (kind === "plate") {
      mat = new MeshStandardMaterial({ color: 15263976, roughness: 0.5 });
    } else if (kind === "trim") {
      mat = new MeshStandardMaterial({ color: 2830131, roughness: 0.5, metalness: 0.2 });
    } else {
      mat = new MeshStandardMaterial({ color: 2303272, metalness: 0.4, roughness: 0.45 });
    }
    this.mats[kind] = mat;
    return mat;
  }

  private async load() {
    const loader = new GLTFLoader();
    const gltf: GLTF = await loader.loadAsync("./assets/models/n90.glb");
    this.model.add(gltf.scene);

    gltf.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || "";
      let kind = "bodyTrim";
      for (const [k, re] of CAR_MATERIAL_RULES) {
        if (re.test(name)) {
          kind = k;
          break;
        }
      }
      mesh.material = this.material(kind);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    // 内饰贴图：按网格名最长前缀匹配到贴图键（旧版 D 闭包逻辑）
    const texLoader = new TextureLoader();
    const texCache: Record<string, Awaited<ReturnType<TextureLoader["loadAsync"]>>> = {};
    const findTextureKey = (meshName: string): string | null => {
      const isInterior = meshName.startsWith("carInternal_") && !meshName.startsWith("carInternal_TopTent");
      const keys = Object.keys(INTERIOR_TEXTURES).filter((k) => k.startsWith("carInternal_"));
      let best: { k: string; base: string } | null = null;
      for (const key of keys) {
        const isBrown = key.includes("CreamBrown");
        if (isInterior !== isBrown) continue;
        const base = key.replace(/_MT_[^/]+$/, "").replace(/_(MP|ao|Shape\d*)$/, "");
        if (meshName.startsWith(base) && (!best || base.length > best.base.length)) best = { k: key, base };
      }
      return best && best.k;
    };
    gltf.scene.traverse(async (obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const key = findTextureKey(mesh.name || "");
      if (!key) return;
      const file = INTERIOR_TEXTURES[key];
      if (!texCache[file]) {
        const tex = await texLoader.loadAsync(`./assets/textures/${file}.webp`);
        tex.colorSpace = SRGBColorSpace;
        texCache[file] = tex;
      }
      const mat = (mesh.material as MeshStandardMaterial).clone();
      mat.map = texCache[file];
      mat.color.setHex(16777215);
      mat.needsUpdate = true;
      mesh.material = mat;
    });

    // 车轮重组：只保留 ACAL25 款轮毂，四个位置各克隆一份（旧版逻辑）
    const rimNames = ["carWheel_ACAL40", "carWheel_ACAL22", "carWheel_ACAL17", "carWheel_ACAL25"];
    const rims: Record<string, Object3D | undefined> = {};
    for (const name of rimNames) rims[name] = gltf.scene.getObjectByName(name) ?? undefined;
    for (const name of rimNames) if (rims[name]) rims[name]!.visible = false;
    const chosenRim = rims.carWheel_ACAL25;
    const tyres = ["carTyre_01", "carTyre_02"]
      .map((n) => gltf.scene.getObjectByName(n))
      .filter((o): o is Object3D => Boolean(o));
    for (const t of tyres) t.visible = false;
    if (chosenRim) {
      const mounts = [
        { x: -1.673, z: -0.805, side: 1 },
        { x: -1.673, z: 0.805, side: -1 },
        { x: 1.402, z: -0.805, side: 1 },
        { x: 1.402, z: 0.805, side: -1 },
      ];
      for (const mount of mounts) {
        const pivot = new Object3D();
        pivot.position.set(mount.x, 0.385, mount.z);
        if (mount.side > 0) pivot.rotation.y = Math.PI;
        const rimClone = chosenRim.clone(true);
        rimClone.visible = true;
        pivot.add(rimClone);
        for (const t of tyres) {
          const tyreClone = t.clone(true);
          tyreClone.visible = true;
          pivot.add(tyreClone);
        }
        pivot.traverse((o) => {
          o.visible = true;
          const mesh = o as Mesh;
          if (mesh.isMesh) {
            mesh.material = /tyre/i.test(mesh.name || "") ? this.material("tyre") : this.material("rim");
            mesh.castShadow = true;
          }
        });
        this.model.add(pivot);
        this.wheels.push({ pivot, radius: 0.384, spin: 0 });
      }
    }

    // 车顶帐篷动画的关键帧时间归一化到整段时长（旧版逻辑）
    const tentClip = gltf.animations.find((a) => a.name === "topTent");
    if (tentClip) {
      const duration = tentClip.duration;
      for (const track of tentClip.tracks) {
        const times = track.times as Float32Array | number[];
        if (!times || times.length < 2) continue;
        const t0 = times[0];
        const t1 = times[times.length - 1];
        if (t1 - t0 < 0.001) continue;
        const scaled = new Float32Array(times.length);
        for (let i = 0; i < times.length; i++) scaled[i] = ((times[i] - t0) / (t1 - t0)) * duration;
        track.times = scaled;
      }
    }

    this.mixer = new AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.enabled = false;
      this.actions[clip.name] = action;
    }
    this.clipNames = gltf.animations.map((a) => a.name);
    for (const name of ["doorLF", "doorRF", "doorLB", "doorRB", "trunk", "topTent"]) {
      const obj = gltf.scene.getObjectByName(name) ?? undefined;
      this.groups[name] = obj;
      if (obj) {
        if (name === "trunk") (obj as any).userData.trunk = true;
        else if (name === "topTent") (obj as any).userData.tent = true;
        else (obj as any).userData.door = name;
      }
    }
    for (const name of ["doorLF", "doorRF", "doorLB", "doorRB", "trunk"]) {
      this.doorState[name] = { open: false, target: 0 };
    }
    this.tentOpen = true;
    this.ready = true;
  }

  seatFor(view: string): Object3D {
    return this.seats[view] ?? this.seat;
  }

  /** 正/反向播放开合动画（旧版 play） */
  play(name: string, forward: boolean, speed = 1) {
    const action = this.actions[name];
    if (!action) return;
    const duration = action.getClip().duration;
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    if (forward) {
      if (action.time >= duration - 0.02) action.time = 0;
      action.timeScale = speed;
    } else {
      if (action.time <= 0.02) action.time = duration;
      action.timeScale = -speed;
    }
    action.play();
  }

  setDoors(open: boolean) {
    for (const name of ["doorLF", "doorRF", "doorLB", "doorRB"]) {
      this.play(name, open);
      if (this.doorState[name]) {
        this.doorState[name].open = open;
        this.doorState[name].target = open ? 1 : 0;
      }
    }
    this.doorsOpen = open;
  }

  toggleDoor(name: string) {
    if (!this.doorState[name]) return;
    const open = !this.doorState[name].open;
    this.play(name, open);
    this.doorState[name].open = open;
    this.doorState[name].target = open ? 1 : 0;
  }

  setTrunk(open: boolean) {
    this.play("trunk", open);
    if (this.doorState.trunk) {
      this.doorState.trunk.open = open;
      this.doorState.trunk.target = open ? 1 : 0;
    }
    this.trunkOpen = open;
  }

  setTent(open: boolean) {
    this.tentOpen = open;
    this.play("topTent", !open, 2.4);
  }

  setPaint(index: number) {
    const paint = PAINTS[index % PAINTS.length];
    for (const mat of this.paintMats) mat.color.setHex(paint.color);
    this.paintName = paint.name;
  }

  update(dt: number, speed: number) {
    if (this.mixer) this.mixer.update(dt);
    for (const wheel of this.wheels) {
      wheel.spin -= (speed * dt) / wheel.radius;
      (wheel.pivot as any).rotation.z = wheel.spin;
    }
  }
}
