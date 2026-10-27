import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

// 不用 StrictMode：世界生成是重操作，且 Game 持有全局监听，双挂载会产生双实例
createRoot(document.getElementById("root")!).render(<App />);
