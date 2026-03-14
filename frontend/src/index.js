import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
  document.documentElement.classList.add("electron");
  if (window.electronAPI?.isMac) {
    document.documentElement.classList.add("electron-mac");
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
