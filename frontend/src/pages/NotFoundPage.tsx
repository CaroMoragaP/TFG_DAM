import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel centered-panel">
      <p className="eyebrow">404</p>
      <h1>Ruta no encontrada</h1>
      <p>La página que buscas no existe dentro del setup inicial.</p>
      <Link className="primary-link" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}
