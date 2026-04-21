import { Link } from "react-router-dom";

export function PublicHomePage() {
  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <p className="eyebrow">Fase 1</p>
        <h1>Gestiona tu biblioteca desde una zona privada con acceso real.</h1>
        <p className="lead">
          La base ya incorpora autenticación JWT, persistencia de sesión y un
          layout privado preparado para catálogo, seguimiento y estadísticas.
        </p>
        <div className="inline-actions">
          <Link className="primary-link" to="/auth?tab=register">
            Crear cuenta
          </Link>
          <Link className="ghost-link" to="/auth">
            Ya tengo acceso
          </Link>
        </div>
      </div>

      <div className="panel feature-panel">
        <h2>Zona privada lista</h2>
        <ul className="feature-list">
          <li>Registro y login conectados con FastAPI</li>
          <li>JWT persistido en navegador y validado al recargar</li>
          <li>Rutas privadas protegidas para catálogo y seguimiento</li>
        </ul>
      </div>
    </section>
  );
}
