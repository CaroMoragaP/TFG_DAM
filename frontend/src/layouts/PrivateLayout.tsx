import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

const navigationItems = [
  { to: "/catalogo", label: "Catalogo" },
  { to: "/bibliotecas", label: "Mis bibliotecas" },
  { to: "/listas", label: "Mis listas" },
  { to: "/lectura", label: "Lectura" },
  { to: "/muro", label: "Muro" },
  { to: "/stats", label: "Estadisticas" },
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
      </header>

      <div className="private-body">
        <aside className="private-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Navegacion</p>
            <nav className="sidebar-nav" aria-label="Secciones privadas">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="private-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
