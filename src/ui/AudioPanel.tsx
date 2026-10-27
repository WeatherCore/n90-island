import { useApp } from "../state/store";
import { gameRef } from "../engine/gameRef";

const TRACK_BUTTONS: Array<[string, string]> = [
  ["sunny", "轻快 · 海岛晨光"],
  ["neon", "酷炫 · 霓虹夜驰"],
  ["areyouok", "彩蛋 · Are U OK"],
];

/** 音频面板（旧版 #audioPanel 的 React 化；音量持久化沿用 dsh-audio 键） */
export function AudioPanel() {
  const on = useApp((s) => s.audioPanelOn);
  const ui = useApp((s) => s.audioUi);
  const game = gameRef.current;

  return (
    <div id="audioPanel" className={on ? "on" : ""}>
      <div className="ap-title">音频</div>
      <div className="ap-row">
        <span>音乐</span>
        <input
          id="volMusic"
          type="range"
          min={0}
          max={100}
          value={Math.round(ui.music * 100)}
          onChange={(e) => game?.setVolume("music", Number(e.target.value) / 100)}
        />
      </div>
      <div className="ap-row">
        <span>音效</span>
        <input
          id="volSfx"
          type="range"
          min={0}
          max={100}
          value={Math.round(ui.sfx * 100)}
          onChange={(e) => game?.setVolume("sfx", Number(e.target.value) / 100)}
        />
      </div>
      <div className="ap-row">
        <span>总音量</span>
        <input
          id="volMaster"
          type="range"
          min={0}
          max={100}
          value={Math.round(ui.master * 100)}
          onChange={(e) => game?.setVolume("master", Number(e.target.value) / 100)}
        />
      </div>
      <div className="ap-tracks">
        {TRACK_BUTTONS.map(([id, label]) => (
          <button
            key={id}
            data-track={id}
            className={ui.track === id ? "on" : ""}
            onClick={() => game?.playTrack(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ap-hint">M 开关音频面板</div>
    </div>
  );
}
