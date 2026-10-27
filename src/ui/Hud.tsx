import { useEffect, useRef } from "react";
import { liveHud, useApp } from "../state/store";

/** HUD：每帧数值走 rAF 直写 DOM（等价旧版 textContent 更新），任务文案走 store */
export function Hud() {
  const hudOn = useApp((s) => s.hudOn);
  const mission = useApp((s) => s.mission);
  const speedRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const lapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (speedRef.current) speedRef.current.textContent = liveHud.speed;
      if (gearRef.current) gearRef.current.textContent = liveHud.gear;
      if (compassRef.current) compassRef.current.textContent = liveHud.compass;
      if (clockRef.current) clockRef.current.textContent = liveHud.clock;
      if (lapRef.current) lapRef.current.textContent = liveHud.lap;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div id="hud" className={hudOn ? "on" : ""}>
      <div className="mission">
        <div className="k">Today's Journey</div>
        <div className="t">{mission.title}</div>
        <div className="d">{mission.desc}</div>
        <div className="line" />
      </div>
      <div className="compass">
        <div className="ang" ref={compassRef}>
          N · 000°
        </div>
        <div className="lbl" ref={clockRef}>
          15:12 AFTERNOON
        </div>
      </div>
      <div className="speed">
        <div className="v" ref={speedRef}>
          0
        </div>
        <div className="u">KM/H</div>
        <div className="gear" ref={gearRef}>
          D
        </div>
      </div>
      <div className="lap">
        <div className="k">LAP</div>
        <div className="v" ref={lapRef}>
          --:--
        </div>
      </div>
      <div className="hint">
        <b>W A S D</b> 驾驶 <b>E</b> 互动 <b>R</b> 回到公路 <b>T</b> 时间 <b>M</b> 音频
        <b>J</b> 手册 <b>B</b> 相册 <b>P</b> 快门
      </div>
    </div>
  );
}
