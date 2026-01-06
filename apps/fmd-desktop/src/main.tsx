import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const existingOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Unhandled error", { message, source, lineno, colno, error });
  if (typeof existingOnError === "function") {
    return existingOnError(message, source, lineno, colno, error);
  }
  return false;
};

const existingOnUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = (event) => {
  console.error("Unhandled promise rejection", event.reason);
  if (typeof existingOnUnhandledRejection === "function") {
    return existingOnUnhandledRejection.call(window, event);
  }
  return undefined;
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("App root element #root not found.");
  const fallback = document.createElement("div");
  fallback.style.cssText =
    "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding: 24px;";
  fallback.textContent = "App failed to mount: #root element not found.";
  document.body.appendChild(fallback);
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
