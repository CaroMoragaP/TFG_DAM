import { Link } from "react-router-dom";

export function RegisterPage() {
  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Registro</p>
      <h1>Registro placeholder</h1>
      <p>
        Esta pantalla queda reservada para el formulario de alta de usuarios de
        la biblioteca.
      </p>
      <div className="inline-actions">
        <Link className="primary-link" to="/login">
          Ir a login
        </Link>
        <Link className="ghost-link" to="/">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
