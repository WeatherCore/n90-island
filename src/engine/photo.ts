// 快门与相册：WebGL 画布只含 3D 画面（UI 是 DOM 覆盖层），截图天然干净。
// 照片存 IndexedDB（localStorage 容量不够放图片）。

export interface PhotoRecord {
  id: number;
  ts: number;
  dataUrl: string;
}

const DB_NAME = "n90-album";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function photoSave(dataUrl: string): Promise<PhotoRecord> {
  const rec: PhotoRecord = { id: Date.now(), ts: Date.now(), dataUrl };
  await withStore("readwrite", (s) => s.put(rec));
  return rec;
}

export async function photoAll(): Promise<PhotoRecord[]> {
  const all = await withStore<PhotoRecord[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.id - a.id);
}

export async function photoDelete(id: number): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

/** 从渲染器画布抓一帧（需在 rAF 帧后调用；preserveDrawingBuffer 已开启） */
export function captureFrame(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.88);
}

/** 分享海报：照片 + 标题条 + 时间戳，返回 PNG dataUrl */
export function composePoster(photo: HTMLImageElement): string {
  const w = 1280;
  const h = Math.round((photo.naturalHeight / photo.naturalWidth) * 1280) || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(photo, 0, 0, w, h);

  // 底部渐变标题条
  const grad = ctx.createLinearGradient(0, h - 190, 0, h);
  grad.addColorStop(0, "rgba(5,7,10,0)");
  grad.addColorStop(1, "rgba(5,7,10,0.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - 190, w, 190);

  ctx.fillStyle = "#d8a866";
  ctx.fillRect(60, h - 128, 44, 2);

  ctx.fillStyle = "#f3e9d7";
  ctx.font = "46px Georgia, 'Songti SC', serif";
  ctx.fillText("N90 · 环岛之旅", 60, h - 84);

  ctx.fillStyle = "rgba(232,220,198,.62)";
  ctx.font = "17px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  ctx.fillText(
    `SKYNOMAD ISLAND · ${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    60,
    h - 52,
  );

  ctx.fillStyle = "rgba(232,220,198,.4)";
  ctx.font = "14px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("ISLAND OF THE SKY NOMAD", w - 60, h - 52);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
