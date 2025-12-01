import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { initStatusBar, hideSplashScreen } from "./lib/capacitor";

// Global error logging to catch blank screen causes on mobile
window.addEventListener("error", (e) => {
  // eslint-disable-next-line no-console
  console.error("Global error:", e.error || e.message || e);
});
window.addEventListener("unhandledrejection", (e) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", e.reason);
});

// Initialize native features
initStatusBar();
hideSplashScreen();

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
