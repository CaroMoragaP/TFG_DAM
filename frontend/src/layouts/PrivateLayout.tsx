import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";

const navigationItems = [
  { to: "/catalogo", label: "Catálogo" },
  { to: "/bibliotecas", label: "Mis bibliotecas" },
  { to: "/listas", label: "Mis listas" },
  { to: "/leyendo", label: "Leyendo" },
  { to: "/leidos", label: "Leídos" },
  { to: "/pendiente", label: "Pendiente" },
  { to: "/resenas", label: "Reseñas" },
  { to: "/stats", label: "Stats" },
];

export function PrivateLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLibraryId, libraries, setActiveLibraryId } = useActiveLibrary();

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
            <label className="field-group compact-field">
              Biblioteca por defecto
              <select
                value={activeLibraryId ?? ""}
                onChange={(event) => setActiveLibraryId(Number(event.target.value))}
              >
                {libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </label>
            <p>Se usará como destino inicial al crear nuevos libros.</p>
            <button className="menu-button" type="button" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </details>
      </header>

      <div className="private-body">
        <aside className="private-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Navegación</p>
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
