import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App.tsx";
import "./index.css";

const demoBase = window.location.pathname.startsWith("/demo") ? "/demo" : "/domina";

createRoot(document.getElementById("root-domina")).render(
  <StrictMode>
    <Router base={demoBase}>
      <App />
    </Router>
  </StrictMode>
);
