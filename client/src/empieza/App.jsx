import "./styles.css";

export default function App() {
  return (
    <>
      <nav className="empieza-demo-bar">
        <span className="demo-label">DEMO MODE</span>
        <a className="active" href="/empieza.html">Empieza</a>
        <a href="/crece.html">Crece</a>
        <a href="/domina.html">Domina</a>
        <a className="back-link" href="/">&#8592; Sitio Principal</a>
      </nav>

      <div className="empieza-placeholder">
        <div className="empieza-placeholder-inner">
          <span className="plan-badge">Plan Empieza</span>
          <h1>Empieza placeholder</h1>
          <p>Aquí se colocará el sitio real de Empieza en el Paso 2.</p>
        </div>
      </div>
    </>
  );
}
