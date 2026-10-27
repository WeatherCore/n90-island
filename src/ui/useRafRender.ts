import { useEffect, useState } from "react";

/** 挂载期间每帧强制重渲染（对应旧版每帧重写面板 innerHTML 的行为） */
export function useRafRender() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    let on = true;
    const cb = () => {
      if (!on) return;
      setTick((t) => t + 1);
      raf = requestAnimationFrame(cb);
    };
    raf = requestAnimationFrame(cb);
    return () => {
      on = false;
      cancelAnimationFrame(raf);
    };
  }, []);
}
