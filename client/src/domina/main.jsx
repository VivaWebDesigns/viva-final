import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "./App.tsx";
import "./index.css";

function DemoBar() {
  const linkStyle = {
    color: "#cbd5e1",
    textDecoration: "none",
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: 600,
  };
  const activeStyle = { ...linkStyle, background: "#0d9488", color: "#fff" };
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "#1e293b", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px", padding: "0 16px", height: "44px", fontFamily: "system-ui,sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
      <span style={{ background: "#f59e0b", color: "#1e293b", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", marginRight: "8px" }}>Modo Demo</span>
      <a href="/empieza.html" style={linkStyle}>Empieza</a>
      <a href="/crece.html" style={linkStyle}>Crece</a>
      <a href="/domina.html" style={activeStyle}>Domina</a>
      <a href="/" style={{ ...linkStyle, marginLeft: "auto", border: "1px solid #334155", color: "#94a3b8" }}>&#8592; Sitio Principal</a>
    </div>
  );
}

createRoot(document.getElementById("root-domina")).render(
  <StrictMode>
    <>
      <DemoBar />
      <div style={{ paddingTop: "44px" }}>
        <Router hook={useHashLocation}>
          <App />
        </Router>
      </div>
    </>
  </StrictMode>
);
