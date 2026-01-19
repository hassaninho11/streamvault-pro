import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { measureColdStart, useMetricsStore } from "./data/stores/metricsStore";

// Record app start timestamp
useMetricsStore.getState().recordAppStart();

createRoot(document.getElementById("root")!).render(<App />);

// Measure cold start after DOM is interactive
measureColdStart();
