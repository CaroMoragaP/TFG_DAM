import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

const navigationItems = [
  { to: "/bibliotecas", label: "Mis bibliotecas" },
  { to: "/catalogo", label: "Mi catálogo" },
  { to: "/listas", label: "Mis Listas" },
  { to: "/lectura", label: "Mi registro de lectura" },
  { to: "/stats", label: "Estadística" },
  { to: "/muro", label: "Comunidad" },
];

export function PrivateLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="private-shell">
      <header className="private-header">
        <div className="private-header-main">
          <NavLink className="brand-mark" to="/catalogo">
            <span className="brand-icon">BP</span>
            <span>
              <strong>Biblioteca Personal</strong>
              <small>Zona privada</small>
            </span>
          </NavLink>

          <details className="user-menu">
            <summary className="user-summary">
              <span className="avatar-badge">
                {user?.name?.slice(0, 1).toUpperCase() ?? "U"}
              </span>
              <span className="user-summary-copy">
                <strong>{user?.name ?? "Usuario"}</strong>
                <small>{user?.email ?? "Sin email"}</small>
              </span>
            </summary>

            <div className="menu-card">
              <p className="eyebrow">Cuenta activa</p>
              <h3>{user?.name}</h3>
              <p>{user?.email}</p>
              <button className="menu-button" type="button" onClick={handleLogout}>
                Cerrar sesion
              </button>
            </div>
          </details>
        </div>

        <div className="private-nav-shell">
          <nav className="private-top-nav" aria-label="Secciones privadas">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="private-content private-content-shell">
        <Outlet />
      </main>
    </div>
  );
}
