import { useApp } from "../state/store";
import { gameRef } from "../engine/gameRef";

export function LoadingScreen() {
  const phase = useApp((s) => s.phase);
  const pct = useApp((s) => s.loadPct);
  const status = useApp((s) => s.loadStatus);
  const ready = pct >= 100;

  return (
    <div id="loading" className={phase === "entered" ? "hidden" : ""}>
      <div className="brand">XAOMI · SKYNOMAD</div>
      <div className="title">环岛之旅</div>
      <div className="subtitle">ISLAND&nbsp;&nbsp;OF&nbsp;&nbsp;THE&nbsp;&nbsp;SKY&nbsp;&nbsp;NOMAD</div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="status">{status}</div>
      <div className={`enter${ready ? " on" : ""}`}>
        <button onClick={() => gameRef.current?.enter()}>开 始 探 索</button>
      </div>
    </div>
  );
}
