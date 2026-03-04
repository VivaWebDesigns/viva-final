import "./styles.css";

export default function App() {
  return (
    <>
      <nav className="crece-demo-bar">
        <span className="demo-label">DEMO MODE</span>
        <a href="/empieza.html">Empieza</a>
        <a className="active" href="/crece.html">Crece</a>
        <a href="/domina.html">Domina</a>
        <a className="back-link" href="/">&#8592; Sitio Principal</a>
      </nav>

      <div className="crece-placeholder">
        <div className="crece-placeholder-inner">
          <span className="plan-badge">Plan Crece</span>
          <h1>Crece placeholder</h1>
          <p>Aquí se colocará el sitio real de Crece en el Paso 2.</p>
        </div>
      </div>
    </>
  );
}
