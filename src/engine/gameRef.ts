import type { Game } from "./game";

/** React 层与引擎实例的握手点（引擎仍保持无 React 依赖） */
export const gameRef: { current: Game | null } = { current: null };
