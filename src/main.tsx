import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { measureColdStart, useMetricsStore } from "./data/stores/metricsStore";
import { initializeStatusBar } from "./utils/statusBar";

// Record app start timestamp
useMetricsStore.getState().recordAppStart();

// Initialize status bar for native platforms (Android/iOS)
initializeStatusBar();

createRoot(document.getElementById("root")!).render(<App />);

// Measure cold start after DOM is interactive
measureColdStart();

