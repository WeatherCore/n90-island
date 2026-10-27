import { useApp } from "../state/store";

export function Prompt() {
  const prompt = useApp((s) => s.prompt);
  return (
    <div id="prompt" className={prompt ? "on" : ""}>
      <div className="pill">
        <span className="key">E</span>
        <span className="txt">{prompt ?? "互动"}</span>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useApp((s) => s.toast);
  return (
    <div id="toast" className={toast ? "on" : ""}>
      {toast?.text ?? ""}
    </div>
  );
}

/** 暗角与胶片颗粒（常驻） */
export function FilmLayers() {
  return (
    <>
      <div className="vignette" />
      <div className="grain" />
    </>
  );
}
