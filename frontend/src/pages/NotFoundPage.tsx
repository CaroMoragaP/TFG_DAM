import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="public-message-shell">
      <div className="panel centered-panel public-message-card">
        <p className="eyebrow">404</p>
        <h1>Ruta no encontrada</h1>
        <p>La página que buscas no existe dentro de la aplicación.</p>
        <Link className="landing-signup-link" to="/">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
