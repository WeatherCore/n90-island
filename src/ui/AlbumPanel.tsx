import { useEffect, useState } from "react";
import { useApp } from "../state/store";
import { composePoster, downloadDataUrl, loadImage, photoAll, photoDelete, type PhotoRecord } from "../engine/photo";

/** 相册（B 键）：IndexedDB 存储，支持原图下载 / 分享海报 / 删除 */
export function AlbumPanel() {
  const open = useApp((s) => s.albumOpen);
  const [photos, setPhotos] = useState<PhotoRecord[] | null>(null);
  const [selected, setSelected] = useState<PhotoRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    setPhotos(null);
    void photoAll().then(setPhotos);
  }, [open]);

  if (!open) return null;
  const close = () => useApp.getState().setAlbumOpen(false);

  const makePoster = async (rec: PhotoRecord) => {
    const img = await loadImage(rec.dataUrl);
    downloadDataUrl(composePoster(img), `n90-poster-${rec.id}.png`);
    useApp.getState().showToast("海报已生成，开始下载");
  };

  return (
    <div className="side-panel on">
      <div className="sub">ALBUM</div>
      <h2>{selected ? "照片" : "旅途相册"}</h2>
      <div className="body">
        {selected ? (
          <>
            <img className="album-full" src={selected.dataUrl} alt="photo" />
            <div className="sp-actions">
              <button onClick={() => void makePoster(selected)}>生成分享海报</button>
              <button onClick={() => downloadDataUrl(selected.dataUrl, `n90-photo-${selected.id}.jpg`)}>下载原图</button>
              <button
                onClick={() => {
                  void photoDelete(selected.id).then(() => {
                    setSelected(null);
                    void photoAll().then(setPhotos);
                    useApp.getState().showToast("照片已删除");
                  });
                }}
              >
                删除
              </button>
              <button onClick={() => setSelected(null)}>返回</button>
            </div>
          </>
        ) : photos == null ? (
          <div className="album-empty">正在翻阅相册…</div>
        ) : photos.length === 0 ? (
          <div className="album-empty">
            还没有照片。
            <br />
            随时按 <b>P</b> 快门，画面会存进这里。
          </div>
        ) : (
          <div className="album-grid">
            {photos.map((p) => (
              <img key={p.id} src={p.dataUrl} alt="thumb" onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>
      <div className="foot">
        {selected ? "P 继续拍照" : `共 ${photos?.length ?? 0} 张 · Esc 关闭`}
      </div>
      <button className="sp-close" onClick={close}>
        关闭 · ESC
      </button>
    </div>
  );
}

/** 快门白闪 */
export function ShutterFlash() {
  const nonce = useApp((s) => s.flashNonce);
  if (!nonce) return null;
  return <div key={nonce} className="shutter-flash" />;
}
