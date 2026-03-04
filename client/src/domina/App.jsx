import "./styles.css";

export default function App() {
  return (
    <>
      <nav className="domina-demo-bar">
        <span className="demo-label">DEMO MODE</span>
        <a href="/empieza.html">Empieza</a>
        <a href="/crece.html">Crece</a>
        <a className="active" href="/domina.html">Domina</a>
        <a className="back-link" href="/">&#8592; Sitio Principal</a>
      </nav>

      <div className="domina-placeholder">
        <div className="domina-placeholder-inner">
          <span className="plan-badge">Plan Domina</span>
          <h1>Domina placeholder</h1>
          <p>Aquí se colocará el sitio real de Domina en el Paso 2.</p>
        </div>
      </div>
    </>
  );
}
