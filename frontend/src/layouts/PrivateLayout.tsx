import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

const navigationItems = [
  { to: "/bibliotecas", label: "Mis bibliotecas" },
  { to: "/catalogo", label: "Mi catalogo" },
  { to: "/listas", label: "Mis listas" },
  { to: "/lectura", label: "Mi lectura" },
  { to: "/stats", label: "Estadisticas" },
  { to: "/muro", label: "Comunidad" },
];

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.25 4A2.25 2.25 0 0 1 8.5 1.75h8.25A2.25 2.25 0 0 1 19 4v13.25a.75.75 0 0 1-1.23.57l-2.33-1.88a1 1 0 0 0-1.26 0l-1.55 1.24a1 1 0 0 1-1.25 0l-1.55-1.24a1 1 0 0 0-1.26 0l-2.33 1.88A.75.75 0 0 1 5 17.25V5.25A1.25 1.25 0 0 1 6.25 4Z"
        fill="currentColor"
      />
      <path
        d="M4 6.25a.75.75 0 0 0-1.5 0v11A4 4 0 0 0 6.5 21.25H15a.75.75 0 0 0 0-1.5H6.5A2.5 2.5 0 0 1 4 17.25v-11Z"
        fill="currentColor"
        opacity="0.42"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1-.75-.75Zm0 5.25a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1-.75-.75Zm.75 4.5a.75.75 0 0 0 0 1.5h13a.75.75 0 0 0 0-1.5h-13Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.72 6.72a.75.75 0 0 1 1.06 0L12 10.94l4.22-4.22a.75.75 0 1 1 1.06 1.06L13.06 12l4.22 4.22a.75.75 0 1 1-1.06 1.06L12 13.06l-4.22 4.22a.75.75 0 0 1-1.06-1.06L10.94 12 6.72 7.78a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PrivateLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="private-shell">
      <header className="private-header">
        <nav className="private-nav" aria-label="Principal">
          <NavLink className="landing-brand private-brand" to="/catalogo">
            <span className="landing-brand-icon">
              <BookIcon />
            </span>
            <span className="private-brand-copy">
              <strong className="landing-brand-copy">Mi Biblioteca</strong>
              <small>Zona privada</small>
            </span>
          </NavLink>

          <div className="private-nav-links" aria-label="Secciones privadas">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "private-nav-link active" : "private-nav-link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="private-header-actions">
            <details className="private-account">
              <summary className="private-account-trigger">
                <span className="private-account-avatar">
                  {user?.name?.slice(0, 1).toUpperCase() ?? "U"}
                </span>
                <span className="private-account-copy">
                  <strong>{user?.name ?? "Usuario"}</strong>
                  <small>{user?.email ?? "Sin email"}</small>
                </span>
              </summary>

              <div className="private-account-menu">
                <p className="eyebrow">Cuenta activa</p>
                <h3>{user?.name ?? "Usuario"}</h3>
                <p>{user?.email ?? "Sin email"}</p>
                <button
                  className="menu-button private-account-button"
                  type="button"
                  onClick={handleLogout}
                >
                  Cerrar sesion
                </button>
              </div>
            </details>

            <button
              className="landing-menu-button private-menu-button"
              type="button"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <span className="landing-menu-icon">
                {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </span>
            </button>
          </div>
        </nav>

        {isMobileMenuOpen ? (
          <div className="private-mobile-menu">
            <div className="private-mobile-links">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "private-mobile-link active" : "private-mobile-link"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="private-mobile-account">
              <div className="private-mobile-account-header">
                <span className="private-account-avatar">
                  {user?.name?.slice(0, 1).toUpperCase() ?? "U"}
                </span>
                <div className="private-account-copy">
                  <strong>{user?.name ?? "Usuario"}</strong>
                  <small>{user?.email ?? "Sin email"}</small>
                </div>
              </div>

              <button
                className="menu-button private-account-button"
                type="button"
                onClick={handleLogout}
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="private-content private-content-shell">
        <Outlet />
      </main>
    </div>
  );
}
