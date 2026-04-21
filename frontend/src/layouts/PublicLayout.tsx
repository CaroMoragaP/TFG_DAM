import { NavLink, Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <NavLink className="brand" to="/">
          Biblioteca Personal
        </NavLink>
        <nav className="public-nav" aria-label="Acceso">
          <NavLink className="ghost-link" to="/auth">
            Login
          </NavLink>
          <NavLink className="primary-link" to="/auth?tab=register">
            Crear cuenta
          </NavLink>
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>
    </div>
  );
}
