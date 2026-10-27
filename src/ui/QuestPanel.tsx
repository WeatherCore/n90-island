import { useApp } from "../state/store";
import { gameRef } from "../engine/gameRef";
import { useRafRender } from "./useRafRender";

const QUESTS: Array<{ id: string; name: string; desc: string }> = [
  { id: "fish", name: "码头 · 海钓", desc: "在码头甩出一竿" },
  { id: "camp", name: "草地 · 露营", desc: "把篝火、咖啡与星空都做完" },
  { id: "offroad", name: "林间 · 越野", desc: "穿过五道林间门" },
  { id: "trial", name: "环岛 · 计时赛", desc: "穿五道光门跑完整圈" },
  { id: "lap", name: "公路 · 环岛一圈", desc: "完整跑完一圈环岛公路" },
  { id: "motes", name: "光尘 · 全收集", desc: "拾取岛上全部 12 枚光尘" },
  { id: "photo", name: "旅途 · 留影", desc: "用快门记录一个瞬间" },
];

const fmt = (s: number | null) => {
  if (s == null) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/** 任务手册（J 键） */
export function QuestPanel() {
  const open = useApp((s) => s.questsOpen);
  const close = () => useApp.getState().setQuestsOpen(false);
  useRafRender();
  if (!open) return null;

  const snap = gameRef.current?.questSnapshot();
  const journal = new Set(snap?.journal ?? []);
  const doneCount = QUESTS.filter((q) => journal.has(q.id)).length;

  return (
    <div className="side-panel on">
      <div className="sub">FIELD JOURNAL</div>
      <h2>任务手册</h2>
      <div className="body">
        {QUESTS.map((q, i) => {
          const done = journal.has(q.id);
          return (
            <div className={`qrow${done ? " done" : ""}`} key={q.id}>
              <b>{i + 1}</b>
              {q.name}
              <em>{done ? "已完成" : q.desc}</em>
            </div>
          );
        })}
        <div className="q-stats">
          光尘 {snap?.motes ?? 0} / {snap?.motesTotal ?? 12} · 最佳圈速 {fmt(snap?.bestLap ?? null)} ·
          计时赛最佳 {fmt(snap?.trialBest ?? null)}
        </div>
      </div>
      <div className="foot">
        进度 {doneCount} / {QUESTS.length} · Esc 关闭
      </div>
      <button className="sp-close" onClick={close}>
        关闭 · ESC
      </button>
    </div>
  );
}
