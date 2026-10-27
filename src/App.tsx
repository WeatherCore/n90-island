import { useEffect, useRef, useState } from "react";
import { Game } from "./engine/game";
import { gameRef } from "./engine/gameRef";
import { useApp } from "./state/store";
import { AlbumPanel, ShutterFlash } from "./ui/AlbumPanel";
import { AudioPanel } from "./ui/AudioPanel";
import { Hud } from "./ui/Hud";
import { InspectPanel } from "./ui/InspectPanel";
import { LoadingScreen } from "./ui/LoadingScreen";
import { PanelOverlay } from "./ui/PanelOverlay";
import { QuestPanel } from "./ui/QuestPanel";
import { FilmLayers, Prompt, Toast } from "./ui/PromptToast";

// 每次挂载用全新 canvas，避免 HMR 重挂载时复用已被旧 WebGL 上下文占住的元素
let mountSeq = 0;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cine = useApp((s) => s.cine);
  const [canvasKey] = useState(() => ++mountSeq);

  useEffect(() => {
    document.body.classList.toggle("cine", cine);
  }, [cine]);

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return;
    const game = new Game(canvasRef.current);
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas id="scene" key={canvasKey} ref={canvasRef} />
      <Hud />
      <Prompt />
      <PanelOverlay />
      <QuestPanel />
      <AlbumPanel />
      <InspectPanel />
      <AudioPanel />
      <div className="letterbox top" />
      <div className="letterbox bot" />
      <FilmLayers />
      <Toast />
      <ShutterFlash />
      <LoadingScreen />
    </>
  );
}
