import { useApp } from "../state/store";
import { gameRef } from "../engine/gameRef";
import { PAINTS } from "../engine/config";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** 车辆检视面板（旧版 #inspect DOM 的 React 化） */
export function InspectPanel() {
  const on = useApp((s) => s.inspectOn);
  const ui = useApp((s) => s.inspectUi);
  const game = gameRef.current;
  const inspect = game?.inspect;

  const viewBtn = (view: string, label: string) => (
    <button
      key={view}
      data-view={view}
      className={ui.view === view ? "active" : ""}
      onClick={() => inspect?.setView(view)}
    >
      {label}
    </button>
  );

  return (
    <div id="inspect" className={on ? "on" : ""}>
      <div className="ins-top">
        <div className="ins-title">N90 MAX · 探索版</div>
        <div className="ins-tabs">
          <button className={ui.view === "orbit" ? "on" : ""} onClick={() => inspect?.setView("orbit")}>
            外观
          </button>
          <button className={ui.view !== "orbit" ? "on" : ""} onClick={() => inspect?.setView("driver")}>
            内饰
          </button>
        </div>
        <button className="ins-close" id="insClose" onClick={() => inspect?.exit()}>
          退出检视 · ESC
        </button>
      </div>
      <div className="ins-left">
        <button data-act="doors" className={ui.doorsOn ? "active" : ""} onClick={() => inspect?.action("doors")}>
          车门<i>{ui.doorsLabel}</i>
        </button>
        <button data-act="trunk" className={ui.trunkOn ? "active" : ""} onClick={() => inspect?.action("trunk")}>
          后备箱<i>{ui.trunkLabel}</i>
        </button>
        <button data-act="tent" className={ui.tentOn ? "active" : ""} onClick={() => inspect?.action("tent")}>
          车顶帐篷<i>{ui.tentLabel}</i>
        </button>
        <button data-act="all" onClick={() => inspect?.action("all")}>
          一键全部打开<i></i>
        </button>
      </div>
      <div className="ins-right">
        {viewBtn("driver", "驾驶位")}
        {viewBtn("passenger", "副驾")}
        {viewBtn("rear", "后排")}
        {viewBtn("orbit", "环车视角")}
      </div>
      <div className="ins-bottom">
        <div className="swatches" id="insSwatches">
          {PAINTS.map((p, i) => (
            <button
              key={p.name}
              data-paint={i}
              className={ui.paint === i ? "on" : ""}
              style={{ background: hex(p.color) }}
              title={p.name}
              onClick={() => {
                inspect?.setPaint(i);
                useApp.getState().setInspectUi({ paint: i });
                gameRef.current?.savePaint(i);
              }}
            />
          ))}
        </div>
        <div className="ins-hint">拖动旋转 · 滚轮缩放 · 点击车门直接开合</div>
      </div>
    </div>
  );
}
