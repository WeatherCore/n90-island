import {
  ACESFilmicToneMapping,
  Group,
  Mesh,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { AudioEngine } from "./audio";
import { Activities } from "./activities";
import { Car } from "./car";
import { ChaseCamera } from "./chaseCam";
import { MOTE_TOTAL, Collectibles } from "./collectibles";
import { SITES, TIME_PRESETS, TRAIL, LIGHTHOUSE_POS } from "./config";
import { Driving } from "./driving";
import { Input } from "./input";
import { InspectController } from "./inspect";
import { captureFrame, photoSave } from "./photo";
import { PostFX } from "./postfx";
import { Road } from "./road";
import { loadSave, saveSave } from "./save";
import { Sky } from "./sky";
import {
  buildBirds,
  buildBridge,
  buildCamp,
  buildDock,
  buildHut,
  buildLighthouse,
  buildSign,
  buildTrailSurface,
} from "./structures";
import { Terrain } from "./terrain";
import { TimeTrial } from "./trial";
import { Vegetation } from "./vegetation";
import { Ocean } from "./water";
import { liveHud, storeBridge, useApp } from "../state/store";

function fmtLap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 游戏总控：世界搭建、主循环、输入分发（旧版主 IIFE 的模块化重建） */
export class Game {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera: PerspectiveCamera;
  road: Road;
  terrain: Terrain;
  sky: Sky;
  ocean: Ocean;
  veg: Vegetation;
  lighthouse: Group;
  dock: Group;
  campGroup: Group;
  birds: Array<Mesh>;
  car: Car;
  driving: Driving;
  chase: ChaseCamera;
  input = new Input();
  audio = new AudioEngine();
  activities: Activities;
  collectibles: Collectibles;
  timeTrial: TimeTrial;
  inspect: InspectController;
  postfx: PostFX | null = null;
  private pmrem: PMREMGenerator;
  private envRT: ReturnType<PMREMGenerator["fromScene"]> | null = null;
  private debugParams: URLSearchParams;
  private debugMode: boolean;
  private nofx: boolean;

  entered = false;
  private introT = 0;
  private elapsed = 0;
  private lastFrame = performance.now();
  private fpsFrames = 0;
  private fpsAccum = 0;
  fps = 60;

  private timeIndex = 2;
  private lapStart = performance.now();
  private lastRoadIdx = 0;
  private bestLap = Infinity;
  private saved = loadSave();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.camera = new PerspectiveCamera(52, innerWidth / innerHeight, 0.2, 4000);
    const setLoad = (pct: number, status?: string) => useApp.getState().setLoad(pct, status);

    setLoad(6);
    this.sky = new Sky(this.scene);
    this.debugParams = new URLSearchParams(location.search);
    this.debugMode = this.debugParams.has("cx") || this.debugParams.has("ri") || this.debugParams.has("free");
    this.nofx = this.debugParams.has("nofx");
    if (this.debugParams.has("time")) this.sky.setTime(Number(this.debugParams.get("time")) || 16);

    setLoad(14, "铺开环岛公路…");
    this.road = new Road();
    this.terrain = new Terrain(this.road);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.road.mesh);

    setLoad(46, "注入海水与云…");
    this.ocean = new Ocean(this.scene, this.terrain);

    setLoad(58, "种下森林…");
    this.veg = new Vegetation(this.scene, this.terrain, this.road);

    setLoad(78, "把车开上岸…");
    this.lighthouse = buildLighthouse(this.terrain, LIGHTHOUSE_POS.x, LIGHTHOUSE_POS.z);
    this.scene.add(this.lighthouse);
    this.dock = buildDock(this.terrain, SITES.DOCK.x, SITES.DOCK.z, 0);
    this.scene.add(this.dock);
    this.campGroup = buildCamp(this.terrain, SITES.CAMP.x, SITES.CAMP.z);
    this.scene.add(this.campGroup);
    for (const [dx, dz, rot, scale] of [
      [-16, 12, 0.4, 1],
      [14, -8, -1.1, 0.9],
      [-4, -20, 2.2, 1.05],
    ] as const) {
      this.scene.add(buildHut(this.terrain, SITES.VILLAGE.x + dx, SITES.VILLAGE.z + dz, rot, scale));
    }
    const bridgeIdx = this.road.nearest(350, 326);
    const bridgeAngle = Math.atan2(-this.road.tan[bridgeIdx * 2 + 1], this.road.tan[bridgeIdx * 2]);
    this.scene.add(buildBridge(this.road.x[bridgeIdx], this.road.z[bridgeIdx], bridgeAngle, this.road.y[bridgeIdx] + 0.02));
    this.scene.add(buildTrailSurface(this.terrain, TRAIL));
    for (const site of [SITES.CAMP, SITES.DOCK, SITES.VILLAGE]) {
      this.scene.add(buildSign(this.terrain, site.x + 8, site.z + 8, "", 0.6));
    }
    this.birds = buildBirds(this.scene);

    this.car = new Car(this.scene);
    this.driving = new Driving(this.car, this.terrain, this.road);
    this.driving.placeAtRoad(0);

    setLoad(88);
    this.pmrem = new PMREMGenerator(this.renderer);
    this.rebuildEnv();

    setLoad(96);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.chase = new ChaseCamera(this.camera, this.terrain);
    this.chase.snap(this.driving);

    const persistJournal = () => this.persist();
    this.activities = new Activities(
      this.scene,
      this.terrain,
      this.driving,
      storeBridge,
      this.sky,
      this.camera,
      this.audio,
      persistJournal,
    );

    // —— 二期：光尘收集 + 环岛计时赛 ——
    this.collectibles = new Collectibles(this.scene, this.terrain, storeBridge, this.audio, (_id, count) => {
      this.persist();
      if (count >= MOTE_TOTAL) this.activities.reward("motes");
    }, this.saved.motes);
    this.timeTrial = new TimeTrial(
      this.scene,
      this.road,
      this.terrain,
      this.driving,
      storeBridge,
      this.audio,
      () => {
        this.activities.active = null;
        this.activities.reward("trial");
        this.persist();
      },
      () => {
        this.activities.active = null;
      },
    );
    this.activities.attachTrial(this.timeTrial);
    this.activities.journal = new Set(this.saved.journal);
    this.activities.syncCelebrations();
    this.timeTrial.best = this.saved.trialBest;
    this.inspect = new InspectController(
      this.camera,
      this.renderer,
      this.car,
      this.driving,
      storeBridge,
      () => this.syncInspectUi(),
      () => {
        useApp.getState().setInspectOn(false);
        useApp.getState().setHudOn(true);
      },
    );

    if (this.saved.bestLap != null) this.bestLap = this.saved.bestLap;
    useApp.getState().setAudioUi({
      music: this.audio.vol.music,
      sfx: this.audio.vol.sfx,
      master: this.audio.vol.master,
      track: null,
    });
    if (this.saved.timeIndex != null) {
      this.timeIndex = this.saved.timeIndex % TIME_PRESETS.length;
      this.sky.setTime(TIME_PRESETS[this.timeIndex]);
      this.rebuildEnv();
    }
    // 车漆存档（车模型异步加载完成后应用）
    const applyPaint = () => {
      if (this.disposed) return;
      if (this.car.ready) {
        this.car.setPaint(this.saved.paint);
        this.syncInspectUi();
      } else {
        setTimeout(applyPaint, 200);
      }
    };
    applyPaint();

    this.updateClockLabel();
    this.bindEvents();
    setLoad(100, "准备就绪");

    // 调试句柄（与旧版 window.__* 一致）
    Object.assign(window as any, {
      __game: this,
      __scene: this.scene,
      __terrain: this.terrain,
      __road: this.road,
      __sky: this.sky,
      __car: this.car,
      __driving: this.driving,
      __camera: this.camera,
      __renderer: this.renderer,
      __veg: this.veg,
      __chase: this.chase,
      __fx: this.postfx,
      __ocean: this.ocean,
      __fps: () => this.fps,
      __audio: this.audio,
      __ready: true,
      __state: () => ({
        entered: this.entered,
        inspectActive: this.inspect.active,
        chaseMode: this.chase.mode,
        driveKeys: JSON.stringify(this.input.drive),
      }),
    });

    setTimeout(() => this.loop(), 30);
    if (this.debugParams.has("skipintro")) this.enter();
  }

  /** 环境贴图：用缩小版天空穹顶烘焙 PMREM（旧版 gz） */
  rebuildEnv() {
    const mini = new Scene();
    const skyClone = new Mesh(this.sky.mesh.geometry, this.sky.mesh.material);
    skyClone.scale.setScalar(0.35);
    mini.add(skyClone);
    const rt = this.pmrem.fromScene(mini, 0, 0.1, 2000);
    this.scene.environment = rt.texture;
    (this.scene as any).environmentIntensity = 1;
    this.envRT?.dispose();
    this.envRT = rt;
  }

  private keydownHandler = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.input.press(e.code);
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    this.handleKeyPress(e.code);
    this.anyKeyProgress();
  };
  private keyupHandler = (e: KeyboardEvent) => this.input.release(e.code);
  private blurHandler = () => this.input.blur();
  private resizeHandler = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.postfx?.resize(innerWidth, innerHeight);
  };
  private pointerDownHandler = (e: PointerEvent) => {
    if (!this.inspect.active) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.inspect.pointerDown(e.clientX, e.clientY);
  };
  private pointerMoveHandler = (e: PointerEvent) => {
    if (!this.inspect.active || !this.dragging) return;
    this.inspect.drag(e.clientX - this.lastX, e.clientY - this.lastY);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private pointerUpHandler = (e: PointerEvent) => {
    this.dragging = false;
    if (this.inspect.active) this.inspect.pointerUp(e.clientX, e.clientY);
  };
  private wheelHandler = (e: WheelEvent) => {
    if (!this.inspect.active) return;
    e.preventDefault();
    this.inspect.wheel(e.deltaY);
  };
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  private bindEvents() {
    addEventListener("keydown", this.keydownHandler);
    addEventListener("keyup", this.keyupHandler);
    addEventListener("blur", this.blurHandler);
    addEventListener("resize", this.resizeHandler);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.pointerDownHandler);
    el.addEventListener("pointermove", this.pointerMoveHandler);
    addEventListener("pointerup", this.pointerUpHandler);
    el.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  private handleKeyPress(code: string) {
    const activities = this.activities;
    if (code === "KeyT") this.cycleTime();
    if (code === "KeyM") this.toggleAudioPanel();
    if (code === "KeyJ") {
      const s = useApp.getState();
      s.setQuestsOpen(!s.questsOpen);
      s.setAlbumOpen(false);
    }
    if (code === "KeyB") {
      const s = useApp.getState();
      s.setAlbumOpen(!s.albumOpen);
      s.setQuestsOpen(false);
    }
    if (code === "KeyP") this.takePhoto();
    if (code === "KeyR") {
      if (this.timeTrial.state === "running") {
        storeBridge.toast("计时进行中，无法传送");
      } else {
        this.driving.placeAtRoad(this.road.nearest(this.driving.pos.x, this.driving.pos.z));
      }
    }
    if (code === "KeyK") this.rebuildEnv();
    if (code === "KeyE") {
      this.audio.resume();
      this.audio.playMusic("sunny"); // 与旧版一致：首次交互即点亮晨光 BGM
      if (activities.state === "fish") {
        // 边沿已由 Input.press 记录
      } else if (activities.state === "camp") {
        activities.endCamp();
      } else if (activities.state === "offroad") {
        activities.handleKey("KeyE");
      } else if (this.timeTrial.state === "running") {
        this.timeTrial.quit();
      } else if (!activities.active) {
        activities.interact();
      }
    }
    if (code === "Escape") {
      const s = useApp.getState();
      if (s.questsOpen || s.albumOpen) {
        s.setQuestsOpen(false);
        s.setAlbumOpen(false);
      } else if (activities.active) {
        activities.endAll();
      }
    }
    if (code === "KeyV" && !activities.active) {
      this.inspect.toggle();
      useApp.getState().setInspectOn(this.inspect.active);
      if (this.inspect.active) useApp.getState().setHudOn(false);
      this.syncInspectUi();
    }
    if (this.inspect.active && code === "Escape") {
      this.inspect.exit();
    }
    if (activities.state === "camp" && /^Digit[1-3]$/.test(code)) {
      activities.campAction(Number(code.slice(5)));
    }
  }

  /** P 键快门：抓当前帧入册 */
  private takePhoto() {
    try {
      const url = captureFrame(this.renderer.domElement);
      this.audio.shutter();
      useApp.getState().flash();
      void photoSave(url).then(() => {
        if (!this.activities.journal.has("photo")) this.activities.reward("photo");
        storeBridge.toast("已存入相册 · 按 B 查看");
      });
    } catch (err) {
      console.error("photo", err);
      storeBridge.toast("快门失败");
    }
  }

  /** 任意按键：未进入则进入；开场运镜中则切追击（旧版 t6） */
  private anyKeyProgress() {
    if (!this.entered) {
      this.enter();
      return;
    }
    if (this.chase.mode === "intro") {
      this.chase.mode = "chase";
      this.chase.snap(this.driving);
    }
  }

  /** 进入体验（旧版 Qz） */
  enter() {
    if (this.entered) return;
    this.entered = true;
    useApp.getState().enterGame();
    this.audio.resume();
    this.audio.playMusic("sunny");
    if (!this.debugMode) this.chase.mode = "intro";
    useApp.getState().setCine(true);
    setTimeout(() => useApp.getState().setCine(false), 5200);
  }

  /** 统一落盘（二期字段一并保存） */
  private persist() {
    saveSave({
      journal: [...this.activities.journal],
      bestLap: Number.isFinite(this.bestLap) ? this.bestLap : null,
      trialBest: this.timeTrial.best,
      motes: this.collectibles.takenIds(),
      paint: this.saved.paint,
      timeIndex: this.timeIndex,
    });
  }

  /** 车漆落盘（检视面板换漆时调用） */
  savePaint(index: number) {
    this.saved.paint = index;
    this.persist();
  }

  get lapBest(): number | null {
    return Number.isFinite(this.bestLap) ? this.bestLap : null;
  }

  /** 任务手册快照（React 面板每帧读取） */
  questSnapshot() {
    return {
      journal: [...this.activities.journal],
      motes: this.collectibles.takenCount,
      motesTotal: MOTE_TOTAL,
      bestLap: this.lapBest,
      trialBest: this.timeTrial.best,
    };
  }

  /** T 键昼夜轮换（旧版 y6） */
  cycleTime() {
    this.timeIndex = (this.timeIndex + 1) % TIME_PRESETS.length;
    this.sky.setTime(TIME_PRESETS[this.timeIndex]);
    this.rebuildEnv();
    this.updateClockLabel();
    this.persist();
  }

  /** 时钟标签（旧版 BT；仅在初始与 T 键时刷新，与旧版行为一致） */
  private updateClockLabel() {
    const t = this.sky.time;
    const hh = Math.floor(t);
    const mm = Math.floor((t - hh) * 60);
    const phase = t > 17.2 ? "GOLDEN HOUR" : t > 11 ? "AFTERNOON" : "MORNING";
    liveHud.clock = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${phase}`;
  }

  toggleAudioPanel() {
    const store = useApp.getState();
    const next = !store.audioPanelOn;
    store.setAudioPanelOn(next);
    if (next) {
      this.audio.resume();
      store.setAudioUi({ track: this.audio.track });
    }
  }

  private syncInspectUi() {
    const snap = this.inspect.snapshot();
    useApp.getState().setInspectUi(snap);
  }

  /** HUD 每帧数值（旧版 m6） */
  private updateHudNumbers() {
    liveHud.speed = String(Math.round(Math.abs(this.driving.speed) * 3.6));
    liveHud.gear = this.driving.speed < -0.5 ? "R" : "D";
    const deg = ((-this.driving.yaw * 180) / Math.PI + 360) % 360;
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    liveHud.compass = `${dirs[Math.round(deg / 45) % 8]} · ${String(Math.round(deg)).padStart(3, "0")}°`;
  }

  /** 圈速逻辑（旧版 h6） */
  private updateLap() {
    const n = this.road.n;
    const idx = this.road.nearest(this.driving.pos.x, this.driving.pos.z);
    if (this.lastRoadIdx > n * 0.88 && idx < n * 0.12 && this.driving.speed > 0) {
      const lapSec = (performance.now() - this.lapStart) / 1000;
      if (lapSec > 60) {
        this.bestLap = Math.min(this.bestLap, lapSec);
        storeBridge.toast(`完成一圈 · ${fmtLap(lapSec)}（最佳 ${fmtLap(this.bestLap)}）`);
        this.lapStart = performance.now();
        this.persist();
        this.activities.reward("lap");
      }
    }
    this.lastRoadIdx = idx;
    if (!this.activities.active) storeBridge.setLap(fmtLap((performance.now() - this.lapStart) / 1000));
  }

  /** 主循环（旧版 IT） */
  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    try {
      const now = performance.now();
      const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;
      this.elapsed += dt;
      this.fpsFrames++;
      this.fpsAccum += dt;
      if (this.fpsAccum > 0.5) {
        this.fps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsFrames = 0;
        this.fpsAccum = 0;
      }

      if (this.entered) {
        this.input.pollDrive();
        if (this.activities.state === "fish" || this.activities.state === "camp") {
          this.input.clearDrive(this.driving);
        }
        this.activities.input = this.input.consumeAction();
      } else {
        this.input.drive.up = this.input.drive.down = this.input.drive.left = this.input.drive.right = false;
      }

      if (this.entered && !this.inspect.active) {
        this.driving.update(dt, this.input.drive);
        this.activities.update(dt, this.elapsed);
        this.timeTrial.update(dt);
        this.timeTrial.updateAmbient(this.elapsed);
        this.collectibles.update(dt, this.elapsed, this.driving.pos);
        this.audio.setSpeed(Math.abs(this.driving.speed) * 3.6);
        if (this.activities.cameraOverride) {
          this.activities.cameraOverride(dt);
        } else if (this.chase.mode === "intro") {
          this.introT += dt;
          this.chase.intro(dt, this.driving, this.introT);
          if (this.introT > 6.2) this.chase.mode = "chase";
        } else if (this.chase.mode === "cockpit") {
          // 旧版遗留分支（原版无入口，行为保真保留）
          this.car.seat.getWorldPosition(this.camera.position);
          this.car.seat.getWorldQuaternion(this.camera.quaternion);
          this.camera.rotateX(-0.055);
          if (Math.abs(this.camera.fov - 70) > 0.1) {
            this.camera.fov = 70;
            this.camera.updateProjectionMatrix();
          }
        } else {
          this.chase.update(dt, this.driving);
        }
        this.updateLap();
      } else if (this.inspect.active) {
        this.inspect.update(dt);
        this.driving.speed = 0;
        this.car.update(dt, 0);
      }

      this.sky.update(dt, this.camera);
      this.ocean.update(dt, this.sky);
      this.veg.update(dt);

      for (const bird of this.birds) {
        const p = bird.userData as { r: number; a: number; h: number; sp: number };
        p.a += p.sp * dt;
        bird.position.set(
          Math.cos(p.a) * p.r,
          p.h + Math.sin(this.elapsed * 0.6 + p.a * 3) * 3,
          Math.sin(p.a) * p.r,
        );
        bird.rotation.y = -p.a + Math.PI / 2;
        bird.rotation.z = Math.sin(this.elapsed * 6 + p.a) * 0.25;
      }

      const beam = this.lighthouse.getObjectByName("beam");
      if (beam) beam.rotation.y = this.elapsed * 0.55;

      const fire = (this.campGroup.userData as any).fire as
        | { flames: Group; light: { intensity: number } }
        | undefined;
      if (fire) {
        fire.light.intensity = (32 + Math.sin(this.elapsed * 13.1) * 6 + Math.sin(this.elapsed * 7.7) * 4) * (this.activities.fireBoost || 1);
        fire.flames.scale.y = 0.9 + Math.sin(this.elapsed * 9.3) * 0.12;
        fire.flames.rotation.y = this.elapsed * 0.6;
      }

      if (this.debugMode) {
        if (this.debugParams.has("ri")) {
          const i = Math.floor(Number(this.debugParams.get("ri")) || 0) % this.road.n;
          const j = (i + 12) % this.road.n;
          this.camera.position.set(this.road.x[i], this.road.y[i] + 2.2, this.road.z[i]);
          this.camera.lookAt(this.road.x[j], this.road.y[j] + 1, this.road.z[j]);
        } else {
          const num = (k: string, d: number) => (this.debugParams.has(k) ? Number(this.debugParams.get(k)) : d);
          this.camera.position.set(num("cx", -420), num("cy", 190), num("cz", -360));
          this.camera.lookAt(num("tx", 0), num("ty", 10), num("tz", 0));
        }
      }

      if (this.nofx) this.renderer.render(this.scene, this.camera);
      else this.postfx!.render(dt);

      if (this.entered) this.updateHudNumbers();
    } catch (err) {
      (window as any).__err = err instanceof Error ? err.stack : String(err);
      console.error("FRAME", err);
    }
  };

  /** 供音频面板调用的包装 */
  setVolume(which: "music" | "sfx" | "master", v: number) {
    this.audio.setVolume(which, v);
    useApp.getState().setAudioUi({ [which]: v } as any);
  }

  playTrack(name: string) {
    this.audio.resume();
    this.audio.playMusic(name);
    useApp.getState().setAudioUi({ track: name });
  }

  dispose() {
    this.disposed = true;
    removeEventListener("keydown", this.keydownHandler);
    removeEventListener("keyup", this.keyupHandler);
    removeEventListener("blur", this.blurHandler);
    removeEventListener("resize", this.resizeHandler);
    removeEventListener("pointerup", this.pointerUpHandler);
    const el = this.renderer.domElement;
    el?.removeEventListener("pointerdown", this.pointerDownHandler);
    el?.removeEventListener("pointermove", this.pointerMoveHandler);
    el?.removeEventListener("wheel", this.wheelHandler);
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}
