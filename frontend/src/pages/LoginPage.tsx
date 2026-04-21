import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Acceso</p>
      <h1>Login placeholder</h1>
      <p>
        La autenticación real llegará en fases posteriores. Esta vista deja la
        ruta preparada para iniciar sesión.
      </p>
      <div className="inline-actions">
        <Link className="primary-link" to="/app">
          Entrar en demo
        </Link>
        <Link className="ghost-link" to="/register">
          Ir a registro
        </Link>
      </div>
    </section>
  );
}
