import { type ReactNode } from "react";
import { useApp } from "../state/store";
import { gameRef } from "../engine/gameRef";
import { useRafRender } from "./useRafRender";

function FishPanelBody() {
  useRafRender();
  const fish = gameRef.current?.activities.fish ?? null;
  if (!fish || fish.phase === "ready") {
    const power = fish ? fish.power : 0;
    return (
      <>
        <div style={{ letterSpacing: ".2em", fontSize: 11, color: "rgba(232,220,198,.55)" }}>按住 空格 蓄力，松开抛竿</div>
        <div style={{ marginTop: 18, height: 2, background: "rgba(232,220,198,.15)", position: "relative" }}>
          <i
            style={{
              position: "absolute",
              top: -4,
              left: `${(power * 100).toFixed(1)}%`,
              width: 2,
              height: 10,
              background: "#ffd79a",
            }}
          />
        </div>
      </>
    );
  }
  if (fish.phase === "cast") {
    return <div style={{ fontSize: 13 }}>浮标落在海面上，随波起伏…</div>;
  }
  if (fish.phase === "bite") {
    return (
      <>
        <div style={{ fontSize: 22, letterSpacing: ".2em", color: "#ffd79a" }}>咬 钩 了 !</div>
        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(232,220,198,.6)" }}>立刻按 空格 收线</div>
      </>
    );
  }
  return (
    <>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: ".2em", color: "rgba(232,220,198,.5)", marginBottom: 8 }}>
            张力 TENSION
          </div>
          <div style={{ height: 3, background: "rgba(232,220,198,.15)", position: "relative" }}>
            <i
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${(fish.tension * 100).toFixed(0)}%`,
                background: fish.tension > 0.8 ? "#e2704f" : "#ffd79a",
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: ".2em", color: "rgba(232,220,198,.5)", marginBottom: 8 }}>
            收线 REEL
          </div>
          <div style={{ height: 3, background: "rgba(232,220,198,.15)", position: "relative" }}>
            <i
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${(fish.reel * 100).toFixed(0)}%`,
                background: "#8fd6c2",
              }}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: "rgba(232,220,198,.5)" }}>按住 空格 收线，松手释放张力</div>
    </>
  );
}

function CampPanelBody() {
  // campDone 变化时引擎会 bumpPanel 触发重渲染；这里保持纯读
  const nonce = useApp((s) => s.panelNonce);
  void nonce;
  const done = gameRef.current?.activities.campDone ?? new Set<string>();
  const label = (k: string) => (done.has(k) ? "已完成" : "待体验");
  return (
    <>
      <div className="opt">
        <b>1</b>点燃篝火<em>{label("fire")}</em>
      </div>
      <div className="opt">
        <b>2</b>煮一壶咖啡<em>{label("coffee")}</em>
      </div>
      <div className="opt">
        <b>3</b>躺在草地上看星星<em>{label("stars")}</em>
      </div>
      <div style={{ marginTop: 18, fontSize: 11.5, color: "rgba(232,220,198,.5)", lineHeight: 1.9 }}>
        风穿过草地，帐篷的布面轻轻起伏。把三件事都做完，这一晚就完整了。
      </div>
    </>
  );
}

interface StaticSpec {
  sub: string;
  title: string;
  body: ReactNode;
  foot: string;
}

function StaticPanelBody({ spec }: { spec: StaticSpec }) {
  return <>{spec.body}</>;
}

const OFFROAD_SPEC: StaticSpec = {
  sub: "LIGHT OFF-ROAD",
  title: "林间 · 越野",
  body: (
    <div style={{ fontSize: 13, lineHeight: 2 }}>
      离开柏油路，沿着林间小径穿过五道发光门。
      <br />
      泥土、坡道与树影之间，N90 的底盘依然从容。
    </div>
  ),
  foot: "按 E 出发",
};

/** 面板与遮罩（旧版 #overlay / #panel 的 React 化） */
export function PanelOverlay() {
  const panel = useApp((s) => s.panel);
  const open = panel !== null;

  let spec: StaticSpec;
  let Body: () => ReactNode;
  if (panel?.kind === "fish") {
    spec = { sub: "SEA FISHING", title: "码头 · 海钓", body: null, foot: "空格 / E · 操作" };
    Body = FishPanelBody;
  } else if (panel?.kind === "camp") {
    spec = { sub: "GRASS CAMP", title: "草地 · 露营", body: null, foot: "按 1 – 3 行动 · E 结束" };
    Body = CampPanelBody;
  } else if (panel?.kind === "offroad") {
    spec = OFFROAD_SPEC;
    Body = () => <StaticPanelBody spec={OFFROAD_SPEC} />;
  } else if (panel?.kind === "custom") {
    spec = panel;
    Body = () => <StaticPanelBody spec={panel} />;
  } else {
    spec = { sub: "EXPERIENCE", title: "", body: null, foot: "" };
    Body = () => null;
  }

  return (
    <>
      <div id="overlay" className={open ? "on" : ""} />
      <div id="panel" className={open ? "on" : ""}>
        <div className="sub">{spec.sub}</div>
        <h2>{spec.title}</h2>
        <div className="body">{open ? <Body /> : null}</div>
        <div className="foot">{spec.foot}</div>
      </div>
    </>
  );
}
